import ExpoModulesCore
import AVFoundation
import CoreMedia
import ShazamKit

/**
 * ShazamKit song recognition for captured concert clips.
 *
 * Reads the audio track of a local video/audio file, generates a Shazam
 * signature with SHSignatureGenerator, and matches it against the Shazam
 * catalog via SHSession. Link the ShazamKit framework and enable the
 * ShazamKit App Service on the App ID in the Apple Developer portal.
 * Do not add com.apple.developer.shazamkit to entitlements — it is not a
 * real entitlement and breaks provisioning.
 *
 * Resolution contract (mirrors index.ts):
 *  - match        → dictionary with normalized metadata
 *  - no match     → nil
 *  - failure      → rejected promise with ERR_SHAZAMKIT_* code
 */
public class FeedbackShazamKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FeedbackShazamKit")

    Function("isSupported") { () -> Bool in
      if #available(iOS 15.0, *) {
        return true
      }
      return false
    }

    AsyncFunction("recognizeFromFile") { (fileUri: String, promise: Promise) in
      guard #available(iOS 15.0, *) else {
        promise.reject(
          "ERR_SHAZAMKIT_UNAVAILABLE",
          "ShazamKit requires iOS 15 or later."
        )
        return
      }
      FeedbackShazamKitRecognizer.recognize(fileUri: fileUri, promise: promise)
    }
  }
}

@available(iOS 15.0, *)
final class FeedbackShazamKitRecognizer: NSObject, SHSessionDelegate {
  /// Apple's SHSignature max duration is 12.000s; 12.09s is SHError 201.
  /// Cap at 11s so chunk size + 44.1k resample cannot overshoot.
  private static let maxSignatureSeconds: Double = 12
  private static let signatureAppendCapSeconds: Double = min(11, maxSignatureSeconds)
  private static let workQueue = DispatchQueue(
    label: "com.feedbacklive.shazamkit",
    qos: .default
  )
  /// Keeps recognizers (and their SHSession delegates) alive until resolution.
  private static var active: [FeedbackShazamKitRecognizer] = []
  private static let activeLock = NSLock()

  private let promise: Promise
  private var session: SHSession?
  private var settled = false

  private init(promise: Promise) {
    self.promise = promise
  }

  static func recognize(fileUri: String, promise: Promise) {
    let recognizer = FeedbackShazamKitRecognizer(promise: promise)
    activeLock.lock()
    active.append(recognizer)
    activeLock.unlock()
    workQueue.async {
      recognizer.run(fileUri: fileUri)
    }
  }

  private func run(fileUri: String) {
    guard let url = Self.fileUrl(from: fileUri) else {
      reject("ERR_SHAZAMKIT_BAD_FILE", "Invalid file URI: \(fileUri)")
      return
    }
    guard FileManager.default.fileExists(atPath: url.path) else {
      reject("ERR_SHAZAMKIT_FILE_NOT_FOUND", "Recorded file not found at \(url.path)")
      return
    }

    let signature: SHSignature
    do {
      signature = try Self.makeSignature(for: url)
    } catch let error as RecognizerError {
      reject(error.code, error.message)
      return
    } catch {
      reject(
        "ERR_SHAZAMKIT_SIGNATURE",
        "Could not generate an audio signature: \(error.localizedDescription)"
      )
      return
    }

    let session = SHSession()
    session.delegate = self
    self.session = session
    session.match(signature)
  }

  // MARK: - SHSessionDelegate

  func session(_ session: SHSession, didFind match: SHMatch) {
    guard let item = match.mediaItems.first else {
      resolve(nil)
      return
    }
    resolve([
      "title": item.title as Any,
      "artist": item.artist as Any,
      // SHMediaItem does not expose an album name; kept for a stable shape.
      "album": NSNull(),
      "genres": item.genres,
      "isrc": item.isrc as Any,
      "appleMusicId": item.appleMusicID as Any,
      "appleMusicUrl": item.appleMusicURL?.absoluteString as Any,
      "shazamId": item.shazamID as Any,
      // Public ShazamKit does not surface a confidence score.
      "confidence": NSNull(),
    ])
  }

  func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: Error?) {
    if let error {
      // Network / catalog problems surface here (e.g. SHError 202).
      reject(
        "ERR_SHAZAMKIT_MATCH_FAILED",
        "Shazam match attempt failed: \(error.localizedDescription)"
      )
      return
    }
    resolve(nil)
  }

  // MARK: - Resolution plumbing

  private func resolve(_ value: Any?) {
    settle { promise.resolve(value) }
  }

  private func reject(_ code: String, _ message: String) {
    settle { promise.reject(code, message) }
  }

  private func settle(_ complete: () -> Void) {
    Self.activeLock.lock()
    let alreadySettled = settled
    settled = true
    if !alreadySettled {
      Self.active.removeAll { $0 === self }
    }
    Self.activeLock.unlock()
    if !alreadySettled {
      complete()
    }
  }

  // MARK: - Audio → signature

  private struct RecognizerError: Error {
    let code: String
    let message: String
  }

  private static func fileUrl(from uri: String) -> URL? {
    if uri.hasPrefix("file://") {
      return URL(string: uri) ?? URL(fileURLWithPath: String(uri.dropFirst("file://".count)))
    }
    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }
    return URL(string: uri)
  }

  private static func makeSignature(for url: URL) throws -> SHSignature {
    let ext = url.pathExtension.lowercased()
    let isVideoContainer = ext == "mp4" || ext == "mov" || ext == "m4v"
    if !isVideoContainer {
      do {
        return try signatureFromAudioFile(url)
      } catch let error as RecognizerError {
        throw error
      } catch {
        return try signatureFromAssetReader(url)
      }
    }
    return try signatureFromAssetReader(url)
  }

  private static func signatureFromAudioFile(_ url: URL) throws -> SHSignature {
    let file = try AVAudioFile(forReading: url)
    let inFormat = file.processingFormat
    let maxFrames = AVAudioFrameCount(inFormat.sampleRate * signatureAppendCapSeconds)
    let framesToRead = min(maxFrames, AVAudioFrameCount(file.length))
    guard framesToRead >= AVAudioFrameCount(inFormat.sampleRate) else {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_NO_AUDIO_TRACK",
        message: "The recording's audio track was too short for song recognition."
      )
    }
    guard let input = AVAudioPCMBuffer(pcmFormat: inFormat, frameCapacity: framesToRead) else {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_SIGNATURE",
        message: "Could not allocate an audio buffer for signature generation."
      )
    }
    try file.read(into: input, frameCount: framesToRead)
    let generator = SHSignatureGenerator()
    var converter: AVAudioConverter?
    var converterInFormat: AVAudioFormat?
    guard let toAppend = convertForSignature(
      input,
      converter: &converter,
      converterInFormat: &converterInFormat
    ) else {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_SIGNATURE",
        message: "Could not convert the recording audio for signature generation."
      )
    }
    try generator.append(toAppend, at: nil)
    return generator.signature()
  }

  private static func signatureFromAssetReader(_ url: URL) throws -> SHSignature {
    let (asset, track) = try loadAudioTrack(url: url)

    let reader: AVAssetReader
    do {
      reader = try AVAssetReader(asset: asset)
    } catch {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_BAD_FILE",
        message: "Could not open the recording for reading: \(error.localizedDescription)"
      )
    }

    // Interleaved Int16 at the source rate/channels. Do not force float32/mono/44.1k
    // or set reader.timeRange — that combination yields "Invalid sample cursor".
    let outputSettingsCandidates: [[String: Any]] = [
      [
        AVFormatIDKey: Int(kAudioFormatLinearPCM),
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsBigEndianKey: false,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsNonInterleaved: false,
      ],
      [
        AVFormatIDKey: Int(kAudioFormatLinearPCM),
      ],
    ]

    var output: AVAssetReaderTrackOutput?
    for settings in outputSettingsCandidates {
      let candidate = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
      candidate.alwaysCopiesSampleData = true
      if reader.canAdd(candidate) {
        output = candidate
        break
      }
    }
    guard let output else {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_BAD_FILE",
        message: "Could not decode the recording's audio track."
      )
    }
    reader.add(output)

    guard reader.startReading() else {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_BAD_FILE",
        message: reader.error.map {
          "Could not read the recording: \($0.localizedDescription)"
        } ?? "Could not read the recording."
      )
    }

    let generator = SHSignatureGenerator()
    var appendedSeconds: Double = 0
    var converter: AVAudioConverter?
    var converterInFormat: AVAudioFormat?

    while let sampleBuffer = output.copyNextSampleBuffer() {
      guard let pcm = pcmBuffer(from: sampleBuffer) else { continue }
      guard let toAppend = convertForSignature(
        pcm,
        converter: &converter,
        converterInFormat: &converterInFormat
      ) else {
        continue
      }
      let outRate = toAppend.format.sampleRate
      guard outRate > 0 else { continue }
      let chunkSeconds = Double(toAppend.frameLength) / outRate
      if appendedSeconds + chunkSeconds > signatureAppendCapSeconds { break }
      do {
        try generator.append(toAppend, at: nil)
        appendedSeconds += chunkSeconds
      } catch {
        break
      }
    }

    if appendedSeconds >= 1 {
      return generator.signature()
    }

    if reader.status == .failed {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_BAD_FILE",
        message: reader.error.map {
          "Reading the recording failed: \($0.localizedDescription)"
        } ?? "Reading the recording failed."
      )
    }

    throw RecognizerError(
      code: "ERR_SHAZAMKIT_NO_AUDIO_TRACK",
      message: "The recording's audio track was too short for song recognition."
    )
  }

  private static func loadAudioTrack(url: URL) throws -> (AVURLAsset, AVAssetTrack) {
    let asset = AVURLAsset(url: url)
    let lock = DispatchSemaphore(value: 0)
    var nsError: NSError?
    var status: AVKeyValueStatus = .unknown
    asset.loadValuesAsynchronously(forKeys: ["tracks"]) {
      status = asset.statusOfValue(forKey: "tracks", error: &nsError)
      lock.signal()
    }
    if lock.wait(timeout: .now() + 20) == .timedOut {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_BAD_FILE",
        message: "Timed out loading the recording audio track."
      )
    }
    if status == .failed {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_BAD_FILE",
        message: nsError.map {
          "Could not load audio tracks: \($0.localizedDescription)"
        } ?? "Could not load audio tracks."
      )
    }
    guard let track = asset.tracks(withMediaType: .audio).first else {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_NO_AUDIO_TRACK",
        message: "The recording has no readable audio track."
      )
    }
    return (asset, track)
  }

  private static func signatureFormat() -> AVAudioFormat? {
    AVAudioFormat(
      commonFormat: .pcmFormatFloat32,
      sampleRate: 44_100,
      channels: 1,
      interleaved: false
    )
  }

  private static func formatsCompatible(_ a: AVAudioFormat, _ b: AVAudioFormat) -> Bool {
    a.sampleRate == b.sampleRate
      && a.channelCount == b.channelCount
      && a.commonFormat == b.commonFormat
      && a.isInterleaved == b.isInterleaved
  }

  private static func convertForSignature(
    _ input: AVAudioPCMBuffer,
    converter: inout AVAudioConverter?,
    converterInFormat: inout AVAudioFormat?
  ) -> AVAudioPCMBuffer? {
    let inFormat = input.format
    guard let outFormat = signatureFormat() else { return nil }
    if formatsCompatible(inFormat, outFormat) {
      return input
    }
    let needsNewConverter =
      converter == nil || converterInFormat.map { !formatsCompatible($0, inFormat) } ?? true
    if needsNewConverter {
      converter = AVAudioConverter(from: inFormat, to: outFormat)
      converterInFormat = inFormat
    }
    guard let converter else { return nil }
    let ratio = outFormat.sampleRate / inFormat.sampleRate
    let outFrames = AVAudioFrameCount(Double(input.frameLength) * ratio) + 256
    guard let converted = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: outFrames) else {
      return nil
    }
    var converterError: NSError?
    var consumed = false
    converter.convert(to: converted, error: &converterError) { _, status in
      if consumed {
        status.pointee = .noDataNow
        return nil
      }
      consumed = true
      status.pointee = .haveData
      return input
    }
    if converterError != nil { return nil }
    return converted
  }

  private static func pcmBuffer(from sampleBuffer: CMSampleBuffer) -> AVAudioPCMBuffer? {
    guard let formatDesc = CMSampleBufferGetFormatDescription(sampleBuffer) else {
      return nil
    }
    let format = AVAudioFormat(cmAudioFormatDescription: formatDesc)
    let frameCount = AVAudioFrameCount(CMSampleBufferGetNumSamples(sampleBuffer))
    guard frameCount > 0,
      let pcmBuffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount)
    else {
      return nil
    }
    pcmBuffer.frameLength = frameCount
    let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(
      sampleBuffer,
      at: 0,
      frameCount: Int32(frameCount),
      into: pcmBuffer.mutableAudioBufferList
    )
    guard status == noErr else {
      return nil
    }
    return pcmBuffer
  }
}
