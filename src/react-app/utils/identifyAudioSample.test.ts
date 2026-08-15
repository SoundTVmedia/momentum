import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractWavSnippetViaWebAudio,
  WEB_AUDIO_DECODE_TIMEOUT_MS,
} from './identifyAudioSample';

describe('extractWavSnippetViaWebAudio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns null when decodeAudioData never resolves', async () => {
    vi.useFakeTimers();
    class HangAudioContext {
      decodeAudioData() {
        return new Promise<AudioBuffer>(() => {});
      }
      close() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal('AudioContext', HangAudioContext);

    const pending = extractWavSnippetViaWebAudio(
      new Blob([new Uint8Array(8_000)], { type: 'audio/wav' }),
    );
    await vi.advanceTimersByTimeAsync(WEB_AUDIO_DECODE_TIMEOUT_MS + 50);
    await expect(pending).resolves.toBeNull();
  });
});
