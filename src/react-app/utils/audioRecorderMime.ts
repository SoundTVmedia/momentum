/** MediaRecorder MIME helpers. Safari/WKWebView need MP4; Chromium prefers WebM/Opus. */
const WEBM_AUDIO_RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'video/webm;codecs=opus',
  'video/webm',
] as const;

const MP4_AUDIO_RECORDER_MIME_CANDIDATES = [
  'audio/mp4',
  'audio/aac',
] as const;

const WEBM_VIDEO_RECORDER_MIME_CANDIDATES_WITH_AUDIO = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm;codecs=h264',
  'video/webm',
] as const;

const MP4_VIDEO_RECORDER_MIME_CANDIDATES_WITH_AUDIO = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=h264,aac',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
] as const;

const MP4_VIDEO_RECORDER_MIME_CANDIDATES_VIDEO_ONLY = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=h264',
  'video/mp4',
] as const;

export function isAppleMediaRecorderPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/(Chrome|CriOS|FxiOS|Edg|OPR|Android)/i.test(ua);
  return isiOS || isSafari;
}

function firstSupported(candidates: readonly string[]): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

export function pickAudioRecorderMime(): string | null {
  const candidates = isAppleMediaRecorderPlatform()
    ? [...MP4_AUDIO_RECORDER_MIME_CANDIDATES, ...WEBM_AUDIO_RECORDER_MIME_CANDIDATES]
    : [...WEBM_AUDIO_RECORDER_MIME_CANDIDATES, ...MP4_AUDIO_RECORDER_MIME_CANDIDATES];
  return firstSupported(candidates);
}

export function pickVideoRecorderMime(opts: {
  hasAudio: boolean;
  preferMp4?: boolean;
}): string | null {
  const mp4Candidates = opts.hasAudio
    ? MP4_VIDEO_RECORDER_MIME_CANDIDATES_WITH_AUDIO
    : MP4_VIDEO_RECORDER_MIME_CANDIDATES_VIDEO_ONLY;
  const candidates = opts.preferMp4
    ? [...mp4Candidates, ...WEBM_VIDEO_RECORDER_MIME_CANDIDATES_WITH_AUDIO]
    : [...WEBM_VIDEO_RECORDER_MIME_CANDIDATES_WITH_AUDIO, ...mp4Candidates];
  return firstSupported(candidates);
}
