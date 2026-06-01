import {
  ACR_MAX_SAMPLE_BYTES,
  MIN_IDENTIFY_SAMPLE_BYTES,
} from '@/shared/identify-music-limits';

/** First N bytes of a large WebM/MP4 usually include the mux header + several seconds of audio. */
export function sliceHeadForIdentify(
  source: Blob,
  maxBytes: number = ACR_MAX_SAMPLE_BYTES,
): Blob | null {
  if (source.size < MIN_IDENTIFY_SAMPLE_BYTES) return null;
  if (source.size <= maxBytes) return source;
  return source.slice(0, maxBytes, source.type || undefined);
}

/** Whether a head slice is likely a decodable container for ACR. */
export function headSliceLikelyValid(source: Blob, head: Blob): boolean {
  if (head.size < MIN_IDENTIFY_SAMPLE_BYTES) return false;
  const t = (source.type || head.type || '').toLowerCase();
  if (t.includes('webm') || t.includes('matroska')) return true;
  if (t.includes('mp4') || t.includes('quicktime') || t.includes('m4v')) return true;
  return head.size >= MIN_IDENTIFY_SAMPLE_BYTES;
}

const MAX_WEB_AUDIO_DECODE_BYTES = 22 * 1024 * 1024;

/**
 * Decode via Web Audio and export a short mono WAV (reliable when captureStream fails on large files).
 * Only used under ~22MB to avoid mobile OOM.
 */
export async function extractWavSnippetViaWebAudio(blob: Blob): Promise<Blob | null> {
  if (typeof AudioContext === 'undefined' || blob.size > MAX_WEB_AUDIO_DECODE_BYTES) {
    return null;
  }

  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioContext();
    const ab = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(ab.slice(0));
    const maxSec = 14;
    const duration = decoded.duration;
    if (!Number.isFinite(duration) || duration <= 0) return null;

    const recordSec = Math.min(maxSec, duration, Math.max(3, duration - 0.2));
    const startSec = duration > recordSec + 0.5 ? Math.max(0, duration / 2 - recordSec / 2) : 0;
    const startSample = Math.floor(startSec * decoded.sampleRate);
    const frameCount = Math.min(
      Math.floor(recordSec * decoded.sampleRate),
      decoded.length - startSample,
    );
    if (frameCount < decoded.sampleRate * 2) return null;

    const channels = decoded.numberOfChannels;
    const pcm = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      let sum = 0;
      for (let c = 0; c < channels; c++) {
        sum += decoded.getChannelData(c)[startSample + i] ?? 0;
      }
      pcm[i] = sum / channels;
    }

    const sampleRate = decoded.sampleRate;
    const wavBytes = encodeMonoWavPcm16(pcm, sampleRate);
    return new Blob([wavBytes], { type: 'audio/wav' });
  } catch {
    return null;
  } finally {
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        /* ignore */
      }
    }
  }
}

function encodeMonoWavPcm16(samples: Float32Array, sampleRate: number): Uint8Array {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}
