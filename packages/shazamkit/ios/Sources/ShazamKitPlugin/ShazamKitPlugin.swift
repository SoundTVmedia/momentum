import Foundation
import AVFoundation
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
 * Requires the com.apple.developer.shazamkit entitlement
 * (ios/App/App/App.entitlements) and the ShazamKit app service enabled on
 * the App ID in the Apple Developer portal.
 */
@objc(ShazamKitPlugin)
public class ShazamKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShazamKitPlugin"
    public let jsName = "ShazamKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeAudio", returnType: CAPPluginReturnPromise),
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
}

@available(iOS 15.0, *)
final class ShazamKitRecognizer: NSObject, SHSessionDelegate {
    /// Seconds of audio fed into the signature — Shazam matches reliably on ~10-15s.
    private static let maxSignatureSeconds: Double = 15
    private static let workQueue = DispatchQueue(
        label: "com.feedback.shazamkit",
        qos: .userInitiated
    )
    /// Keeps recognizers (SHSession delegates) alive until the call settles.
    private static var active: [ShazamKitRecognizer] = []
    private static let activeLock = NSLock()

    private let call: CAPPluginCall
    private var session: SHSession?
    private var tempFileURL: URL?
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

    private func run(base64: String, mimeType: String) {
        guard let data = Data(base64Encoded: base64, options: [.ignoreUnknownCharacters]),
              !data.isEmpty
        else {
            reject("Could not decode the audio payload.", "ERR_SHAZAMKIT_BAD_FILE")
            return
        }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("shazamkit-\(UUID().uuidString)")
            .appendingPathExtension(Self.fileExtension(for: mimeType))
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

        let signature: SHSignature
        do {
            signature = try Self.makeSignature(for: url)
        } catch let error as RecognizerError {
            reject(error.message, error.code)
            return
        } catch {
            reject(
                "Could not generate an audio signature: \(error.localizedDescription)",
                "ERR_SHAZAMKIT_SIGNATURE"
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
            resolve(["match": NSNull()])
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
            // matchAttemptFailed when com.apple.developer.shazamkit is missing).
            reject(
                "Shazam match attempt failed: \(error.localizedDescription)",
                "ERR_SHAZAMKIT_MATCH_FAILED"
            )
            return
        }
        resolve(["match": NSNull()])
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

    private static func fileExtension(for mimeType: String) -> String {
        let t = mimeType.lowercased()
        if t.contains("wav") { return "wav" }
        if t.contains("aac") || t.contains("m4a") || t.contains("x-m4a") { return "m4a" }
        if t.contains("mp4") || t.contains("quicktime") { return "mp4" }
        if t.contains("mpeg") || t.contains("mp3") { return "mp3" }
        if t.contains("caf") { return "caf" }
        return "m4a"
    }

    private static func makeSignature(for url: URL) throws -> SHSignature {
        let asset = AVURLAsset(url: url)
        guard let track = asset.tracks(withMediaType: .audio).first else {
            throw RecognizerError(
                code: "ERR_SHAZAMKIT_NO_AUDIO_TRACK",
                message: "The clip has no readable audio track."
            )
        }

        let reader: AVAssetReader
        do {
            reader = try AVAssetReader(asset: asset)
        } catch {
            throw RecognizerError(
                code: "ERR_SHAZAMKIT_BAD_FILE",
                message: "Could not open the audio for reading: \(error.localizedDescription)"
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
                message: "Could not decode the clip's audio track."
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
                    "Could not read the clip audio: \($0.localizedDescription)"
                } ?? "Could not read the clip audio."
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
                    "Reading the clip audio failed: \($0.localizedDescription)"
                } ?? "Reading the clip audio failed."
            )
        }

        // Require ~1s of audio; Shazam cannot match shorter fragments.
        guard appendedFrames >= AVAudioFrameCount(sampleRate) else {
            throw RecognizerError(
                code: "ERR_SHAZAMKIT_NO_AUDIO_TRACK",
                message: "The clip's audio was too short for song recognition."
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
