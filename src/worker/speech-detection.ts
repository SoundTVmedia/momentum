const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo' as const;

const MIN_SPEECH_WORDS = 2;

type WhisperOutput = {
  text?: string;
  word_count?: number;
  words?: { word?: string }[];
};

function countSpeechWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-zA-Z]{2,}/.test(w)).length;
}

/**
 * Uses Cloudflare Workers AI Whisper to detect intelligible speech in an audio snippet.
 * Requires `AI` binding on the Worker (see wrangler.json).
 */
export async function detectSpeechInAudio(
  ai: Ai,
  bytes: Uint8Array,
): Promise<{ hasSpeech: boolean; transcript: string | null; wordCount: number }> {
  if (bytes.byteLength === 0) {
    return { hasSpeech: false, transcript: null, wordCount: 0 };
  }

  try {
    const result = (await ai.run(WHISPER_MODEL, {
      audio: [...bytes],
      task: 'transcribe',
      vad_filter: true,
    })) as WhisperOutput;

    const transcript = typeof result.text === 'string' ? result.text.trim() : '';
    const wordCount =
      typeof result.word_count === 'number' && Number.isFinite(result.word_count)
        ? result.word_count
        : countSpeechWords(transcript);

    return {
      hasSpeech: wordCount >= MIN_SPEECH_WORDS,
      transcript: transcript || null,
      wordCount,
    };
  } catch (e) {
    console.error('[Whisper] speech detection failed', e);
    return { hasSpeech: false, transcript: null, wordCount: 0 };
  }
}

export function describeSpeechDetectionConfig(ai: Ai | undefined): {
  ready: boolean;
  model: string;
  hint: string | null;
} {
  if (!ai) {
    return {
      ready: false,
      model: WHISPER_MODEL,
      hint:
        'Workers AI is not bound. Add `"ai": { "binding": "AI" }` to wrangler.json and redeploy. Whisper runs on Cloudflare — no separate API key.',
    };
  }
  return { ready: true, model: WHISPER_MODEL, hint: null };
}
