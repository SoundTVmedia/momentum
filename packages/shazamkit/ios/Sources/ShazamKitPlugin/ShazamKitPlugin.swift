import Foundation
import AVFoundation
import CoreMedia
import Capacitor
import ShazamKit

/**
 * On-device ShazamKit song recognition for captured clips (primary provider;
 * the Worker's ACRCloud endpoint stays as fallback).
 *
 * The WebView sends a base64 audio/video payload (wav / m4a / mp4). The
 * plugin writes it to a temp file, generates a Shazam signature from the
 * audio track with SHSignatureGenerator, and matches it via SHSession.
 *
 * Requires the ShazamKit framework (linked via the pod) and the ShazamKit
 * App Service enabled on the App ID in the Apple Developer portal.
 * Do not add com.apple.developer.shazamkit to App.entitlements — it is not a
 * real entitlement and breaks provisioning.
 */
@objc(ShazamKitPlugin)
public class ShazamKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShazamKitPlugin"
    public let jsName = "ShazamKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeFile", returnType: CAPPluginReturnPromise),
    ]

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 15.0, *) {
            call.resolve(["supported": true])
        } else {
            call.resolve(["supported": false])
        }
    }

    @objc func recognizeAudio(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.reject("ShazamKit requires iOS 15 or later.", "ERR_SHAZAMKIT_UNAVAILABLE")
            return
        }
        guard let base64 = call.getString("base64"), !base64.isEmpty else {
            call.reject("Missing base64 audio payload.", "ERR_SHAZAMKIT_BAD_FILE")
            return
        }
        let mimeType = call.getString("mimeType") ?? ""
        ShazamKitRecognizer.recognize(base64: base64, mimeType: mimeType, call: call)
    }

    @objc func recognizeFile(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.reject("ShazamKit requires iOS 15 or later.", "ERR_SHAZAMKIT_UNAVAILABLE")
            return
        }
        guard let path = call.getString("path"), !path.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            call.reject("Missing audio file path.", "ERR_SHAZAMKIT_BAD_FILE")
            return
        }
        let startSeconds = call.getDouble("startSeconds")
        let scanWindows = call.getBool("scanWindows") ?? false
        ShazamKitRecognizer.recognizeFile(
            path: path,
            startSeconds: startSeconds,
            scanWindows: scanWindows,
            call: call
        )
    }
}

@available(iOS 15.0, *)
final class ShazamKitRecognizer: NSObject, SHSessionDelegate {
    /// Apple's SHSignature max duration is 12.000s; 12.09s is SHError 201.
    /// Cap at 11s so chunk size + 44.1k resample cannot overshoot.
    private static let maxSignatureSeconds: Double = 12
    private static let signatureAppendCapSeconds: Double = min(11, maxSignatureSeconds)
    private static let workQueue = DispatchQueue(
        label: "com.feedback.shazamkit",
        qos: .default
    )
    /// Keeps recognizers (SHSession delegates) alive until the call settles.
    private static var active: [ShazamKitRecognizer] = []
    private static let activeLock = NSLock()

    private let call: CAPPluginCall
    private var session: SHSession?
    private var tempFileURL: URL?
    private var matchFileURL: URL?
    private var windowStarts: [Double] = [0]
    private var windowIndex = 0
    private var settled = false

    private init(call: CAPPluginCall) {
        self.call = call
    }

    static func recognize(base64: String, mimeType: String, call: CAPPluginCall) {
        let recognizer = ShazamKitRecognizer(call: call)
        activeLock.lock()
        active.append(recognizer)
        activeLock.unlock()
        workQueue.async {
            recognizer.run(base64: base64, mimeType: mimeType)
        }
    }

    static func recognizeFile(
        path: String,
        startSeconds: Double?,
        scanWindows: Bool,
        call: CAPPluginCall
    ) {
        let recognizer = ShazamKitRecognizer(call: call)
        activeLock.lock()
        active.append(recognizer)
        activeLock.unlock()
        workQueue.async {
            recognizer.runFile(path: path, startSeconds: startSeconds, scanWindows: scanWindows)
        }
    }

    private func run(base64: String, mimeType: String) {
        guard let data = Data(base64Encoded: base64, options: [.ignoreUnknownCharacters]),
              !data.isEmpty
        else {
            reject("Could not decode the audio payload.", "ERR_SHAZAMKIT_BAD_FILE")
            return
        }

        let ext = Self.fileExtension(for: mimeType, data: data)
        if Self.isUnsupportedOnIos(ext) {
            reject(
                "This audio format cannot be decoded on iOS (WebM/Opus).",
                "ERR_SHAZAMKIT_BAD_FILE"
            )
            return
        }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("shazamkit-\(UUID().uuidString)")
            .appendingPathExtension(ext)
        do {
            try data.write(to: url, options: [.atomic])
        } catch {
            reject(
                "Could not stage the audio for recognition: \(error.localizedDescription)",
                "ERR_SHAZAMKIT_BAD_FILE"
            )
            return
        }
        tempFileURL = url
        matchFileURL = url
        windowStarts = [0]
        windowIndex = 0
        matchCurrentWindow()
    }

    private func runFile(path: String, startSeconds: Double?, scanWindows: Bool) {
        let url = Self.fileURL(from: path)
        if !Self.isRemoteHttpURL(url) {
            guard FileManager.default.fileExists(atPath: url.path) else {
                reject("Audio file not found on device.", "ERR_SHAZAMKIT_BAD_FILE")
                return
            }
        }
        matchFileURL = url
        if scanWindows {
            let duration = Self.loadDurationSeconds(url: url)
            windowStarts = Self.scanWindowStarts(durationSeconds: duration)
        } else {
            windowStarts = [max(0, startSeconds ?? 0)]
        }
        windowIndex = 0
        matchCurrentWindow()
    }

    /// Start, mid, and last 11s. Library clips often put the song after talking.
    static func scanWindowStarts(durationSeconds: Double?) -> [Double] {
        var starts: [Double] = [0]
        guard let durationSeconds, durationSeconds.isFinite, durationSeconds > 0 else {
            return starts
        }
        let window = signatureAppendCapSeconds
        if durationSeconds > window + 5 {
            starts.append(max(0, durationSeconds / 2 - window / 2))
        }
        if durationSeconds > window * 2 {
            starts.append(max(0, durationSeconds - window))
        }
        var unique: [Double] = []
        for start in starts {
            if !unique.contains(where: { abs($0 - start) < 0.5 }) {
                unique.append(start)
            }
        }
        return unique
    }

    private static func loadDurationSeconds(url: URL) -> Double? {
        let asset = AVURLAsset(url: url)
        let lock = DispatchSemaphore(value: 0)
        var nsError: NSError?
        var status: AVKeyValueStatus = .unknown
        asset.loadValuesAsynchronously(forKeys: ["duration", "tracks"]) {
            status = asset.statusOfValue(forKey: "duration", error: &nsError)
            lock.signal()
        }
        let timeout: TimeInterval = isRemoteHttpURL(url) ? 45 : 20
        if lock.wait(timeout: .now() + timeout) == .timedOut {
            return nil
        }
        if status == .failed {
            return nil
        }
        let seconds = CMTimeGetSeconds(asset.duration)
        return seconds.isFinite && seconds > 0 ? seconds : nil
    }

    private func matchCurrentWindow() {
        guard let url = matchFileURL else {
            reject("Audio file not found on device.", "ERR_SHAZAMKIT_BAD_FILE")
            return
        }
        let start = windowStarts.indices.contains(windowIndex) ? windowStarts[windowIndex] : 0
        let signature: SHSignature
        do {
            signature = try Self.makeSignature(for: url, startSeconds: start)
        } catch let error as RecognizerError {
            if windowIndex == 0 {
                reject(error.message, error.code)
                return
            }
            advanceToNextWindowOrResolveNoMatch()
            return
        } catch {
            if windowIndex == 0 {
                reject(
                    "Could not generate an audio signature: \(error.localizedDescription)",
                    "ERR_SHAZAMKIT_SIGNATURE"
                )
                return
            }
            advanceToNextWindowOrResolveNoMatch()
            return
        }

        let session = SHSession()
        session.delegate = self
        self.session = session
        session.match(signature)
    }

    private static func isRemoteHttpURL(_ url: URL) -> Bool {
        let scheme = url.scheme?.lowercased() ?? ""
        return scheme == "http" || scheme == "https"
    }

    private static func fileURL(from path: String) -> URL {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: trimmed), let scheme = url.scheme?.lowercased(),
           ["http", "https", "file", "capgo", "capacitor"].contains(scheme)
        {
            return url
        }
        return URL(fileURLWithPath: trimmed)
    }

    // MARK: - SHSessionDelegate

    func session(_ session: SHSession, didFind match: SHMatch) {
        guard let item = match.mediaItems.first else {
            advanceToNextWindowOrResolveNoMatch()
            return
        }
        resolve([
            "match": [
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
            ] as [String: Any],
        ])
    }

    func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: Error?) {
        if let error {
            // Entitlement/network problems surface here (e.g. SHError 202
            // SHErrorCode.matchAttemptFailed when matching cannot complete.
            reject(
                "Shazam match attempt failed: \(error.localizedDescription)",
                "ERR_SHAZAMKIT_MATCH_FAILED"
            )
            return
        }
        advanceToNextWindowOrResolveNoMatch()
    }

    private func advanceToNextWindowOrResolveNoMatch() {
        if windowIndex + 1 < windowStarts.count {
            windowIndex += 1
            Self.workQueue.async { [weak self] in
                self?.matchCurrentWindow()
            }
            return
        }
        resolve([
            "match": NSNull(),
            "windowsTried": windowStarts.count,
        ])
    }

    // MARK: - Resolution plumbing

    private func resolve(_ payload: [String: Any]) {
        settle { call.resolve(payload) }
    }

    private func reject(_ message: String, _ code: String) {
        settle { call.reject(message, code) }
    }

    private func settle(_ complete: () -> Void) {
        Self.activeLock.lock()
        let alreadySettled = settled
        settled = true
        if !alreadySettled {
            Self.active.removeAll { $0 === self }
        }
        Self.activeLock.unlock()
        if alreadySettled { return }
        if let tempFileURL {
            try? FileManager.default.removeItem(at: tempFileURL)
        }
        complete()
    }

    // MARK: - Audio → signature

    private struct RecognizerError: Error {
        let code: String
        let message: String
    }

    private static func fileExtension(for mimeType: String, data: Data? = nil) -> String {
        if let data, let sniffed = sniffExtension(data) {
            return sniffed
        }
        let t = mimeType.lowercased()
        if t.contains("webm") || t.contains("matroska") { return "webm" }
        if t.contains("ogg") { return "ogg" }
        if t.contains("wav") || t.contains("wave") { return "wav" }
        if t.contains("m4a") || t.contains("x-m4a") { return "m4a" }
        if t.contains("mp4") || t.contains("quicktime") || t.contains("m4v") { return "mp4" }
        if t.contains("mpeg") || t.contains("mp3") { return "mp3" }
        if t.contains("caf") { return "caf" }
        if t.contains("aac") { return "aac" }
        return "m4a"
    }

    /// WebM/Opus/Ogg cannot be decoded by AVFoundation on iOS.
    private static func isUnsupportedOnIos(_ ext: String) -> Bool {
        ext == "webm" || ext == "ogg"
    }

    private static func sniffExtension(_ data: Data) -> String? {
        guard data.count >= 12 else { return nil }
        let prefix = [UInt8](data.prefix(16))
        if prefix[0] == 0x52, prefix[1] == 0x49, prefix[2] == 0x46, prefix[3] == 0x46,
           data.subdata(in: 8..<12) == Data("WAVE".utf8)
        {
            return "wav"
        }
        if data.subdata(in: 4..<8) == Data("ftyp".utf8) {
            if data.count >= 12 {
                let brand = String(data: data.subdata(in: 8..<12), encoding: .ascii) ?? ""
                if brand.hasPrefix("M4A") || brand.hasPrefix("M4B") { return "m4a" }
            }
            return "mp4"
        }
        if prefix[0] == 0x63, prefix[1] == 0x61, prefix[2] == 0x66, prefix[3] == 0x66 {
            return "caf"
        }
        if prefix[0] == 0x1A, prefix[1] == 0x45, prefix[2] == 0xDF, prefix[3] == 0xA3 {
            return "webm"
        }
        if prefix[0] == 0x4F, prefix[1] == 0x67, prefix[2] == 0x67, prefix[3] == 0x53 {
            return "ogg"
        }
        if prefix[0] == 0x49, prefix[1] == 0x44, prefix[2] == 0x33 {
            return "mp3"
        }
        return nil
    }

    private static func makeSignature(for url: URL, startSeconds: Double = 0) throws -> SHSignature {
        let ext = url.pathExtension.lowercased()
        let isVideoContainer = ext == "mp4" || ext == "mov" || ext == "m4v"
        if !isVideoContainer {
            do {
                return try signatureFromAudioFile(url, startSeconds: startSeconds)
            } catch let error as RecognizerError {
                throw error
            } catch {
                return try signatureFromAssetReader(url, startSeconds: startSeconds)
            }
        }
        return try signatureFromAssetReader(url, startSeconds: startSeconds)
    }

    /// WAV / CAF / M4A (and some AAC-in-MP4) via AVAudioFile.
    private static func signatureFromAudioFile(_ url: URL, startSeconds: Double = 0) throws -> SHSignature {
        let file = try AVAudioFile(forReading: url)
        let inFormat = file.processingFormat
        let maxFrames = AVAudioFrameCount(inFormat.sampleRate * signatureAppendCapSeconds)
        let skipFrames = AVAudioFramePosition(max(0, startSeconds) * inFormat.sampleRate)
        if skipFrames > 0, file.length > 0 {
            file.framePosition = min(skipFrames, max(0, file.length - 1))
        }
        let remaining = max(0, file.length - file.framePosition)
        let framesToRead = min(maxFrames, AVAudioFrameCount(remaining))
        guard framesToRead >= AVAudioFrameCount(inFormat.sampleRate) else {
            throw RecognizerError(
                code: "ERR_SHAZAMKIT_NO_AUDIO_TRACK",
                message: "The clip's audio was too short for song recognition."
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
                message: "Could not convert the clip audio for signature generation."
            )
        }
        try generator.append(toAppend, at: nil)
        return generator.signature()
    }

    /// Do not set `reader.timeRange` to skip — that yields `Invalid sample cursor`
    /// on Capgo / Photos library MP4s. Discard sample buffers instead.
    private static func signatureFromAssetReader(_ url: URL, startSeconds: Double = 0) throws -> SHSignature {
        let (asset, track) = try loadAudioTrack(url: url)

        let reader: AVAssetReader
        do {
            reader = try AVAssetReader(asset: asset)
        } catch {
            throw RecognizerError(
                code: "ERR_SHAZAMKIT_BAD_FILE",
                message: "Could not open the audio for reading: \(error.localizedDescription)"
            )
        }

        // Interleaved Int16 at the source rate/channel count. Forcing float32,
        // mono, 44.1 kHz, or a reader.timeRange is what produced
        // "Invalid sample cursor" on Capgo MP4s, AAC segments, and WAVs.
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
                message: "Could not decode the clip's audio track."
            )
        }
        reader.add(output)

        guard reader.startReading() else {
            throw RecognizerError(
                code: "ERR_SHAZAMKIT_BAD_FILE",
                message: reader.error.map {
                    "Could not read the clip audio: \($0.localizedDescription)"
                } ?? "Could not read the clip audio."
            )
        }

        let generator = SHSignatureGenerator()
        var skippedSeconds: Double = 0
        var appendedSeconds: Double = 0
        var converter: AVAudioConverter?
        var converterInFormat: AVAudioFormat?
        let skipNeed = max(0, startSeconds)

        while let sampleBuffer = output.copyNextSampleBuffer() {
            guard let pcm = pcmBuffer(from: sampleBuffer) else { continue }
            let inRate = pcm.format.sampleRate
            if skipNeed > 0, skippedSeconds < skipNeed {
                if inRate > 0 {
                    skippedSeconds += Double(pcm.frameLength) / inRate
                }
                continue
            }
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
                    "Reading the clip audio failed: \($0.localizedDescription)"
                } ?? "Reading the clip audio failed."
            )
        }

        throw RecognizerError(
            code: "ERR_SHAZAMKIT_NO_AUDIO_TRACK",
            message: "The clip's audio was too short for song recognition."
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
        let timeout: TimeInterval = isRemoteHttpURL(url) ? 45 : 20
        if lock.wait(timeout: .now() + timeout) == .timedOut {
            throw RecognizerError(
                code: "ERR_SHAZAMKIT_BAD_FILE",
                message: "Timed out loading the clip audio track."
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
                message: "The clip has no readable audio track."
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

    /// Build the PCM buffer from the sample's own format description — never a guessed layout.
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
