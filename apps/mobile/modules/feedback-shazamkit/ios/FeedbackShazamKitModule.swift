import ExpoModulesCore
import AVFoundation
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
  /// Seconds of audio fed into the signature. Shazam matches reliably on
  /// ~10-15s; capping keeps signature generation fast for 60s clips.
  private static let maxSignatureSeconds: Double = 15
  private static let workQueue = DispatchQueue(
    label: "com.feedbacklive.shazamkit",
    qos: .userInitiated
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
    let asset = AVURLAsset(url: url)
    guard let track = asset.tracks(withMediaType: .audio).first else {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_NO_AUDIO_TRACK",
        message: "The recording has no readable audio track."
      )
    }

    let reader: AVAssetReader
    do {
      reader = try AVAssetReader(asset: asset)
    } catch {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_BAD_FILE",
        message: "Could not open the recording for reading: \(error.localizedDescription)"
      )
    }

    let sampleRate: Double = 44_100
    let outputSettings: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVSampleRateKey: sampleRate,
      AVNumberOfChannelsKey: 1,
      AVLinearPCMBitDepthKey: 32,
      AVLinearPCMIsFloatKey: true,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsNonInterleaved: false,
    ]
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: outputSettings)
    output.alwaysCopiesSampleData = false
    guard reader.canAdd(output) else {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_BAD_FILE",
        message: "Could not decode the recording's audio track."
      )
    }
    reader.add(output)
    reader.timeRange = CMTimeRange(
      start: .zero,
      duration: CMTime(seconds: maxSignatureSeconds, preferredTimescale: 600)
    )

    guard
      let format = AVAudioFormat(
        commonFormat: .pcmFormatFloat32,
        sampleRate: sampleRate,
        channels: 1,
        interleaved: false
      )
    else {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_SIGNATURE",
        message: "Could not prepare the audio format for signature generation."
      )
    }

    guard reader.startReading() else {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_BAD_FILE",
        message: reader.error.map {
          "Could not read the recording: \($0.localizedDescription)"
        } ?? "Could not read the recording."
      )
    }

    let generator = SHSignatureGenerator()
    var appendedFrames: AVAudioFrameCount = 0

    while let sampleBuffer = output.copyNextSampleBuffer() {
      guard let pcmBuffer = pcmBuffer(from: sampleBuffer, format: format) else {
        continue
      }
      try generator.append(pcmBuffer, at: nil)
      appendedFrames += pcmBuffer.frameLength
    }

    if reader.status == .failed {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_BAD_FILE",
        message: reader.error.map {
          "Reading the recording failed: \($0.localizedDescription)"
        } ?? "Reading the recording failed."
      )
    }

    // Require ~1s of audio; Shazam cannot match shorter fragments.
    guard appendedFrames >= AVAudioFrameCount(sampleRate) else {
      throw RecognizerError(
        code: "ERR_SHAZAMKIT_NO_AUDIO_TRACK",
        message: "The recording's audio track was too short for song recognition."
      )
    }

    return generator.signature()
  }

  private static func pcmBuffer(
    from sampleBuffer: CMSampleBuffer,
    format: AVAudioFormat
  ) -> AVAudioPCMBuffer? {
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
