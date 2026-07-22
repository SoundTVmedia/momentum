import Foundation
import AVFoundation
import Capacitor

/**
 * Emits rolling mic segments (m4a) for live song identification while the camera preview runs.
 * Uses AVAudioRecorder with a timer-driven segment loop.
 */
@objc(NativeAudioCapturePlugin)
public class NativeAudioCapturePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAudioCapturePlugin"
    public let jsName = "NativeAudioCapture"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepareForVideoCapture", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareRecordingSessionRecovery", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareForRecordingCapture", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restoreForMediaPlayback", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private var recorder: AVAudioRecorder?
    private var segmentDuration: TimeInterval = 5.0
    private var segmentWorkItem: DispatchWorkItem?
    private var isActive = false
    private var currentFileURL: URL?
    private let queue = DispatchQueue(label: "com.feedback.native-audio-capture")

    @objc func prepareForVideoCapture(_ call: CAPPluginCall) {
        queue.async {
            self.requestMicrophonePermission { granted in
                guard granted else {
                    call.reject("Microphone permission denied")
                    return
                }
                // Capgo AVCaptureSession owns AVAudioSession via automaticallyConfiguresApplicationAudioSession.
                call.resolve()
            }
        }
    }

    /// After caption/feed playback the session is `.playback` — reset before Capgo start (capture not running).
    @objc func prepareRecordingSessionRecovery(_ call: CAPPluginCall) {
        queue.async {
            let session = AVAudioSession.sharedInstance()
            let alreadyVideoRecording =
                session.category == .playAndRecord && session.mode == .videoRecording
            let inPlayback =
                session.category == .playback || session.category == .soloAmbient
            if alreadyVideoRecording || !inPlayback {
                call.resolve()
                return
            }
            do {
                try self.configureSession(captureActive: false)
                call.resolve()
            } catch {
                call.reject("Failed to recover recording audio session: \(error.localizedDescription)")
            }
        }
    }

    /// Upgrade to videoRecording while AVCaptureSession is running — never deactivate the session.
    @objc func prepareForRecordingCapture(_ call: CAPPluginCall) {
        queue.async {
            do {
                try self.configureSession(captureActive: true)
                call.resolve()
            } catch {
                call.reject("Failed to prepare recording capture audio: \(error.localizedDescription)")
            }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        let segmentMs = call.getInt("segmentDurationMs") ?? 5000
        segmentDuration = max(1.0, Double(segmentMs) / 1000.0)

        queue.async {
            self.requestMicrophonePermission { granted in
                guard granted else {
                    call.reject("Microphone permission denied")
                    return
                }
                do {
                    if self.isActive {
                        call.resolve()
                        return
                    }
                    try self.configureSession(captureActive: false)
                    self.isActive = true
                    try self.beginSegment()
                    call.resolve()
                } catch {
                    self.isActive = false
                    call.reject("Failed to start native audio capture: \(error.localizedDescription)")
                }
            }
        }
    }

    @objc func restoreForMediaPlayback(_ call: CAPPluginCall) {
        queue.async {
            let session = AVAudioSession.sharedInstance()
            // Avoid setActive(false) — it poisons the next Capgo capture session / movie audio mux.
            do {
                try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
                try session.setActive(true)
                call.resolve()
                return
            } catch {
                /* fall through — camera may leave the session in an unusual state */
            }

            do {
                try session.setCategory(
                    .playAndRecord,
                    mode: .default,
                    options: [.defaultToSpeaker, .allowBluetoothHFP, .mixWithOthers]
                )
                try session.setActive(true)
                call.resolve()
            } catch {
                call.reject("Failed to restore playback audio session: \(error.localizedDescription)")
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        queue.async {
            self.isActive = false
            self.cancelSegmentTimer()
            self.recorder?.stop()
            self.recorder = nil
            self.cleanupCurrentFile()
            call.resolve()
        }
    }

    private func requestMicrophonePermission(completion: @escaping (Bool) -> Void) {
        let session = AVAudioSession.sharedInstance()
        switch session.recordPermission {
        case .granted:
            completion(true)
        case .denied:
            completion(false)
        case .undetermined:
            session.requestRecordPermission { granted in
                completion(granted)
            }
        @unknown default:
            completion(false)
        }
    }

    private func configureSession(captureActive: Bool) throws {
        let session = AVAudioSession.sharedInstance()
        let alreadyVideoRecording =
            session.category == .playAndRecord && session.mode == .videoRecording
        if alreadyVideoRecording {
            try session.setActive(true)
            return
        }
        if captureActive {
            try session.setCategory(
                .playAndRecord,
                mode: .videoRecording,
                options: [.defaultToSpeaker, .allowBluetoothHFP]
            )
            try session.setActive(true)
            return
        }
        try? session.setActive(false, options: [.notifyOthersOnDeactivation])
        try session.setCategory(
            .playAndRecord,
            mode: .videoRecording,
            options: [.defaultToSpeaker, .allowBluetoothHFP]
        )
        try session.setActive(true)
    }

    private func beginSegment() throws {
        cancelSegmentTimer()

        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let fileName = "audd_segment_\(UUID().uuidString).m4a"
        let fileURL = cacheDir.appendingPathComponent(fileName)
        try? FileManager.default.removeItem(at: fileURL)
        currentFileURL = fileURL

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]

        let rec = try AVAudioRecorder(url: fileURL, settings: settings)
        rec.isMeteringEnabled = false
        guard rec.record() else {
            throw NSError(
                domain: "NativeAudioCapture",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "AVAudioRecorder.record() returned false"]
            )
        }
        recorder = rec

        let work = DispatchWorkItem { [weak self] in
            self?.finishSegmentAndContinue()
        }
        segmentWorkItem = work
        queue.asyncAfter(deadline: .now() + segmentDuration, execute: work)
    }

    private func finishSegmentAndContinue() {
        guard isActive else { return }

        recorder?.stop()
        recorder = nil

        guard let url = currentFileURL else {
            if isActive { try? beginSegment() }
            return
        }

        let data = (try? Data(contentsOf: url)) ?? Data()
        cleanupCurrentFile()

        if data.count >= 4096 {
            let payload: [String: Any] = [
                "mimeType": "audio/mp4",
                "base64": data.base64EncodedString(),
                "byteLength": data.count,
            ]
            DispatchQueue.main.async {
                self.notifyListeners("audioSegment", data: payload)
            }
        }

        guard isActive else { return }
        do {
            try beginSegment()
        } catch {
            print("NativeAudioCapture: failed to start next segment:", error)
            isActive = false
        }
    }

    private func cancelSegmentTimer() {
        segmentWorkItem?.cancel()
        segmentWorkItem = nil
    }

    private func cleanupCurrentFile() {
        if let url = currentFileURL {
            try? FileManager.default.removeItem(at: url)
            currentFileURL = nil
        }
    }
}
