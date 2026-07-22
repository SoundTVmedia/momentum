import ExpoModulesCore
import AVFoundation

/**
 * Port of Capacitor NativeAudioCapture AVAudioSession helpers for RN capture.
 * vision-camera owns muxed A/V recording; this module only manages session category.
 * Critical: restoreForMediaPlayback never calls setActive(false).
 */
public class FeedbackAudioSessionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FeedbackAudioSession")

    AsyncFunction("prepareForVideoCapture") { (promise: Promise) in
      AVCaptureDevice.requestAccess(for: .audio) { granted in
        if granted {
          promise.resolve(nil)
        } else {
          promise.reject("MicrophoneDenied", "Microphone permission denied")
        }
      }
    }

    AsyncFunction("prepareRecordingSessionRecovery") { () -> Void in
      let session = AVAudioSession.sharedInstance()
      let alreadyVideoRecording =
        session.category == .playAndRecord && session.mode == .videoRecording
      let inPlayback =
        session.category == .playback || session.category == .soloAmbient
      if alreadyVideoRecording || !inPlayback {
        return
      }
      try Self.configureCaptureSession(captureActive: false)
    }

    AsyncFunction("restoreForMediaPlayback") { () -> Void in
      let session = AVAudioSession.sharedInstance()
      do {
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try session.setActive(true)
        return
      } catch {
        // fall through
      }
      try session.setCategory(
        .playAndRecord,
        mode: .default,
        options: [.defaultToSpeaker, .allowBluetoothHFP, .mixWithOthers]
      )
      try session.setActive(true)
    }
  }

  private static func configureCaptureSession(captureActive: Bool) throws {
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
}
