/** Mime types for audio-only MediaRecorder (Safari needs audio/mp4; Chrome prefers webm). */
const AUDIO_RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'video/webm;codecs=opus',
  'video/webm',
] as const;

export function pickAudioRecorderMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mime of AUDIO_RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}
