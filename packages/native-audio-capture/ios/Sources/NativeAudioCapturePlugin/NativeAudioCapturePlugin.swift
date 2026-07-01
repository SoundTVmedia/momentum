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
                call.resolve()
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
                    try self.configureSession()
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

    private func configureSession() throws {
        let session = AVAudioSession.sharedInstance()
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
