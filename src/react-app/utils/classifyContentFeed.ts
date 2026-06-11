import {
  extractMediaSnippetForAudDWithReason,
  type ExtractSnippetFailure,
} from '@/react-app/utils/extractMediaSnippetForAudD';
import {
  extractWavSnippetViaWebAudio,
  headSliceLikelyValid,
  sliceHeadForIdentify,
} from '@/react-app/utils/identifyAudioSample';
import { ACR_MAX_SAMPLE_BYTES } from '@/shared/identify-music-limits';
import {
  BYPASS_CONTENT_FEED_BIFURCATION,
  type ContentFeedClassification,
} from '@/shared/content-feed';

export type ClassifyContentFeedResult =
  | ({ ok: true } & ContentFeedClassification & { classification_id?: string })
  | { ok: false; error: string; skipped?: boolean; extractReason?: ExtractSnippetFailure };

async function audioBlobForClassify(
  video: Blob,
  captureAudio?: Blob | null,
): Promise<Blob | null> {
  if (captureAudio && captureAudio.size > 0) {
    return captureAudio;
  }

  const head = sliceHeadForIdentify(video, ACR_MAX_SAMPLE_BYTES);
  if (head && headSliceLikelyValid(video, head)) {
    return head;
  }

  const extracted = await extractMediaSnippetForAudDWithReason(video);
  if (extracted.blob) return extracted.blob;

  const wav = await extractWavSnippetViaWebAudio(video);
  if (wav) return wav;

  if (video.size > 0 && video.size <= ACR_MAX_SAMPLE_BYTES) {
    return video;
  }

  return null;
}

export async function classifyContentFeedForClip(opts: {
  video: Blob;
  captureAudio?: Blob | null;
  headlinerName: string | null;
}): Promise<ClassifyContentFeedResult> {
  const snippet = await audioBlobForClassify(opts.video, opts.captureAudio);
  if (!snippet) {
    return {
      ok: false,
      error: 'Could not extract audio from this clip for content classification.',
      skipped: true,
    };
  }

  const form = new FormData();
  form.append('file', snippet, 'classify-snippet.webm');
  if (opts.headlinerName?.trim()) {
    form.append('headliner_name', opts.headlinerName.trim());
  }

  const res = await fetch('/api/clips/classify-content', {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  if (!res.ok) {
    let msg = 'Content classification failed';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg };
  }

  const data = (await res.json()) as ContentFeedClassification & {
    classification_id?: string;
  };

  return { ok: true as const, ...data };
}

export function contentFeedUserMessage(
  result: ContentFeedClassification,
): { tone: 'success' | 'info' | 'error'; message: string } | null {
  if (result.content_feed === 'main') {
    if (result.acr_matched && !result.headliner_matched) {
      return {
        tone: 'success',
        message: BYPASS_CONTENT_FEED_BIFURCATION
          ? 'Performance clip — will appear on the main feed. Add or confirm artist, venue, and song details below.'
          : 'Performance clip — will appear on the main feed. Select the artist that matches the identified song.',
      };
    }
    if (!result.acr_matched) {
      return {
        tone: 'success',
        message:
          'Performance clip — will appear on the main feed. Add artist, venue, and song details below.',
      };
    }
    return {
      tone: 'success',
      message: 'Performance clip — will appear on the main public feed.',
    };
  }
  if (result.content_feed === 'pre_post') {
    return {
      tone: 'info',
      message: 'Pre/post moment — will appear on the friends-only feed.',
    };
  }
  if (result.content_feed === 'rejected') {
    return { tone: 'error', message: result.message };
  }
  return null;
}
