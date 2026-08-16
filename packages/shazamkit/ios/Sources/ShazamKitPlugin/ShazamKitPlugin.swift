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
    private var durationSeconds: Double?
    private var windowRetryCount = 0
    private var sawCleanNoMatch = false
    private var sawTransientFailure = false
    private var preparedSignatures: [(start: Double, signature: SHSignature, rms: Double)] = []
    private var loudestStartSeconds: Double?
    private var loudestRms: Double?
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
            durationSeconds = Self.loadDurationSeconds(url: url)
            let planned = Self.scanWindowStarts(durationSeconds: durationSeconds)
            var prepared: [(start: Double, signature: SHSignature, rms: Double)] = []
            for start in planned {
                do {
                    let (signature, rms) = try Self.makeSignature(for: url, startSeconds: start)
                    prepared.append((start, signature, rms))
                } catch {
                    if prepared.isEmpty {
                        if let rec = error as? RecognizerError {
                            reject(rec.message, rec.code)
                        } else {
                            reject(
                                "Could not generate an audio signature: \(error.localizedDescription)",
                                "ERR_SHAZAMKIT_SIGNATURE"
                            )
                        }
                        return
                    }
                    break
                }
            }
            prepared.sort { $0.rms > $1.rms }
            preparedSignatures = prepared
            windowStarts = prepared.map(\.start)
            loudestStartSeconds = prepared.first?.start
            loudestRms = prepared.first?.rms
            print(
                "[shazamkit] scan duration=\(durationSeconds ?? -1) planned=\(planned) loudest-first=\(windowStarts) rms=\(prepared.map { String(format: "%.4f", $0.rms) })"
            )
        } else {
            windowStarts = [max(0, startSeconds ?? 0)]
            preparedSignatures = []
        }
        windowIndex = 0
        matchCurrentWindow()
    }

    /// Overlapping 11s windows that always include the last 11s when the clip
    /// is longer than one signature. Unknown duration probes every 8s.
    static func scanWindowStarts(durationSeconds: Double?) -> [Double] {
        let window = signatureAppendCapSeconds
        let maxWindows = 8
        let stepHint = 8.0
        guard let durationSeconds, durationSeconds.isFinite, durationSeconds > 0 else {
            return stride(from: 0.0, through: Double(maxWindows - 1) * stepHint, by: stepHint)
                .map { $0 }
        }
        let lastStart = max(0, durationSeconds - window)
        if lastStart <= 1.5 {
            return [0]
        }
        let count = min(maxWindows, max(2, Int((lastStart / stepHint).rounded()) + 1))
        let step = lastStart / Double(count - 1)
        return (0..<count).map { index in
            index == count - 1 ? lastStart : Double(index) * step
        }
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
        var seconds = CMTimeGetSeconds(asset.duration)
        if !(seconds.isFinite && seconds > 0) {
            if let track = asset.tracks(withMediaType: .audio).first {
                seconds = CMTimeGetSeconds(track.timeRange.duration)
            }
        }
        if !(seconds.isFinite && seconds > 0) {
            if let track = asset.tracks(withMediaType: .video).first {
                seconds = CMTimeGetSeconds(track.timeRange.duration)
            }
        }
        return seconds.isFinite && seconds > 0 ? seconds : nil
    }

    private func matchCurrentWindow() {
        let signature: SHSignature
        if preparedSignatures.indices.contains(windowIndex) {
            signature = preparedSignatures[windowIndex].signature
        } else {
            guard let url = matchFileURL else {
                reject("Audio file not found on device.", "ERR_SHAZAMKIT_BAD_FILE")
                return
            }
            let start = windowStarts.indices.contains(windowIndex) ? windowStarts[windowIndex] : 0
            do {
                let built = try Self.makeSignature(for: url, startSeconds: start)
                signature = built.0
            } catch let error as RecognizerError {
                if windowIndex == 0 {
                    reject(error.message, error.code)
                    return
                }
                resolveNoMatch()
                return
            } catch {
                if windowIndex == 0 {
                    reject(
                        "Could not generate an audio signature: \(error.localizedDescription)",
                        "ERR_SHAZAMKIT_SIGNATURE"
                    )
                    return
                }
                resolveNoMatch()
                return
            }
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
        var payload: [String: Any] = [
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
        ]
        payload.merge(scanMeta()) { _, new in new }
        resolve(payload)
    }

    func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: Error?) {
        if let error {
            if Self.isTransientMatchError(error) {
                if windowRetryCount < 1 {
                    windowRetryCount += 1
                    sawTransientFailure = true
                    Self.workQueue.asyncAfter(deadline: .now() + 1.2) { [weak self] in
                        self?.matchCurrentWindow()
                    }
                    return
                }
                // Keep scanning other windows — 202 on one offset is not final.
                sawTransientFailure = true
                windowRetryCount = 0
                advanceToNextWindowOrResolveNoMatch()
                return
            }
            reject(
                "Shazam match attempt failed: \(error.localizedDescription)",
                "ERR_SHAZAMKIT_MATCH_FAILED"
            )
            return
        }
        sawCleanNoMatch = true
        windowRetryCount = 0
        advanceToNextWindowOrResolveNoMatch()
    }

    private static func isTransientMatchError(_ error: Error) -> Bool {
        let nsError = error as NSError
        return nsError.code == 202 || nsError.localizedDescription.contains("202")
    }

    private func scanMeta() -> [String: Any] {
        [
            "windowsTried": windowIndex + 1,
            "windowCount": windowStarts.count,
            "durationSeconds": durationSeconds ?? NSNull(),
            "windowStarts": windowStarts,
            "loudestStartSeconds": loudestStartSeconds ?? NSNull(),
            "loudestRms": loudestRms ?? NSNull(),
        ]
    }

    private func writeLoudestWavIfNeeded() -> String? {
        guard let url = matchFileURL, let start = loudestStartSeconds, (loudestRms ?? 0) > 0.004 else {
            return nil
        }
        do {
            let wavURL = try Self.writeWavSnippet(from: url, startSeconds: start)
            return wavURL.absoluteString
        } catch {
            print("[shazamkit] loudest wav export failed: \(error.localizedDescription)")
            return nil
        }
    }

    private func resolveNoMatch() {
        if !sawCleanNoMatch && sawTransientFailure {
            reject(
                "Shazam match attempt failed: (com.apple.ShazamKit error 202.)",
                "ERR_SHAZAMKIT_MATCH_FAILED"
            )
            return
        }
        var payload: [String: Any] = ["match": NSNull()]
        payload.merge(scanMeta()) { _, new in new }
        if let wavPath = writeLoudestWavIfNeeded() {
            payload["wavPath"] = wavPath
        }
        resolve(payload)
    }

    private func advanceToNextWindowOrResolveNoMatch() {
        if windowIndex + 1 < windowStarts.count {
            windowIndex += 1
            windowRetryCount = 0
            Self.workQueue.async { [weak self] in
                self?.matchCurrentWindow()
            }
            return
        }
        resolveNoMatch()
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

    private static func makeSignature(for url: URL, startSeconds: Double = 0) throws -> (SHSignature, Double) {
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
    private static func signatureFromAudioFile(_ url: URL, startSeconds: Double = 0) throws -> (SHSignature, Double) {
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
        return (generator.signature(), rms(of: toAppend))
    }

    /// Do not set `reader.timeRange` to skip — that yields `Invalid sample cursor`
    /// on Capgo / Photos library MP4s. Discard sample buffers instead.
    private static func signatureFromAssetReader(_ url: URL, startSeconds: Double = 0) throws -> (SHSignature, Double) {
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
        var energy = 0.0
        var energyCount = 0
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
                let chunk = energyComponents(of: toAppend)
                energy += chunk.sumSquares
                energyCount += chunk.count
            } catch {
                break
            }
        }

        if appendedSeconds >= 1 {
            let rms = energyCount > 0 ? (energy / Double(energyCount)).squareRoot() : 0
            return (generator.signature(), rms)
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

    private static func energyComponents(of buffer: AVAudioPCMBuffer) -> (sumSquares: Double, count: Int) {
        let count = Int(buffer.frameLength)
        guard count > 0 else { return (0, 0) }
        if let floats = buffer.floatChannelData?[0] {
            var sum = 0.0
            for i in 0..<count {
                let sample = Double(floats[i])
                sum += sample * sample
            }
            return (sum, count)
        }
        if let ints = buffer.int16ChannelData?[0] {
            var sum = 0.0
            for i in 0..<count {
                let sample = Double(ints[i]) / 32768.0
                sum += sample * sample
            }
            return (sum, count)
        }
        return (0, 0)
    }

    private static func rms(of buffer: AVAudioPCMBuffer) -> Double {
        let parts = energyComponents(of: buffer)
        guard parts.count > 0 else { return 0 }
        return (parts.sumSquares / Double(parts.count)).squareRoot()
    }

    /// 11s 44.1kHz mono 16-bit WAV of the loudest window for Worker ACRCloud.
    private static func writeWavSnippet(from url: URL, startSeconds: Double) throws -> URL {
        let dest = url.deletingPathExtension().appendingPathExtension("loudest.wav")
        var samples: [Int16] = []
        samples.reserveCapacity(Int(44_100 * signatureAppendCapSeconds) + 1024)
        let (asset, track) = try loadAudioTrack(url: url)
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [
                AVFormatIDKey: Int(kAudioFormatLinearPCM),
                AVLinearPCMBitDepthKey: 16,
                AVLinearPCMIsBigEndianKey: false,
                AVLinearPCMIsFloatKey: false,
                AVLinearPCMIsNonInterleaved: false,
            ]
        )
        output.alwaysCopiesSampleData = true
        guard reader.canAdd(output) else {
            throw RecognizerError(code: "ERR_SHAZAMKIT_BAD_FILE", message: "Could not decode audio for WAV export.")
        }
        reader.add(output)
        guard reader.startReading() else {
            throw RecognizerError(code: "ERR_SHAZAMKIT_BAD_FILE", message: "Could not read audio for WAV export.")
        }
        var skipped: Double = 0
        var appended: Double = 0
        var converter: AVAudioConverter?
        var converterInFormat: AVAudioFormat?
        let skipNeed = max(0, startSeconds)
        while let sampleBuffer = output.copyNextSampleBuffer() {
            guard let pcm = pcmBuffer(from: sampleBuffer) else { continue }
            let inRate = pcm.format.sampleRate
            if skipNeed > 0, skipped < skipNeed {
                if inRate > 0 {
                    skipped += Double(pcm.frameLength) / inRate
                }
                continue
            }
            guard let toAppend = convertForSignature(
                pcm,
                converter: &converter,
                converterInFormat: &converterInFormat
            ) else { continue }
            let outRate = toAppend.format.sampleRate
            guard outRate > 0, let floats = toAppend.floatChannelData?[0] else { continue }
            let frames = Int(toAppend.frameLength)
            let chunkSeconds = Double(frames) / outRate
            if appended + chunkSeconds > signatureAppendCapSeconds { break }
            for i in 0..<frames {
                let clipped = max(-1.0, min(1.0, Double(floats[i])))
                samples.append(Int16(clipped * 32767.0))
            }
            appended += chunkSeconds
        }
        guard samples.count >= 44_100 else {
            throw RecognizerError(code: "ERR_SHAZAMKIT_NO_AUDIO_TRACK", message: "WAV export was too short.")
        }
        try writePcmWav(samples: samples, sampleRate: 44_100, to: dest)
        return dest
    }

    private static func writePcmWav(samples: [Int16], sampleRate: Int, to url: URL) throws {
        var data = Data()
        let dataSize = samples.count * 2
        func appendAscii(_ value: String) {
            data.append(contentsOf: value.utf8)
        }
        func appendU32(_ value: UInt32) {
            var little = value.littleEndian
            data.append(Data(bytes: &little, count: 4))
        }
        func appendU16(_ value: UInt16) {
            var little = value.littleEndian
            data.append(Data(bytes: &little, count: 2))
        }
        appendAscii("RIFF")
        appendU32(UInt32(36 + dataSize))
        appendAscii("WAVE")
        appendAscii("fmt ")
        appendU32(16)
        appendU16(1)
        appendU16(1)
        appendU32(UInt32(sampleRate))
        appendU32(UInt32(sampleRate * 2))
        appendU16(2)
        appendU16(16)
        appendAscii("data")
        appendU32(UInt32(dataSize))
        samples.withUnsafeBytes { raw in
            data.append(contentsOf: raw)
        }
        try data.write(to: url, options: .atomic)
    }
}
