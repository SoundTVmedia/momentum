import type { ClipShareMeta } from '@/shared/clip-share-meta';

const META_TAG_NAMES = [
  'og:title',
  'og:description',
  'og:image',
  'og:url',
  'twitter:title',
  'twitter:description',
  'twitter:image',
] as const;

function upsertMetaTag(name: string, content: string): void {
  const selector = `meta[property="${name}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Update document meta for in-app share sheets (best-effort; crawlers use server HTML). */
export function applyClipShareMetaToDocument(meta: ClipShareMeta): () => void {
  const previousTitle = document.title;
  const previousMeta = new Map<string, string | null>();
  for (const name of META_TAG_NAMES) {
    const el = document.head.querySelector(`meta[property="${name}"]`) as HTMLMetaElement | null;
    previousMeta.set(name, el?.getAttribute('content') ?? null);
  }

  document.title = meta.title;
  for (const name of META_TAG_NAMES) {
    const content =
      name === 'og:title' || name === 'twitter:title'
        ? meta.title
        : name === 'og:description' || name === 'twitter:description'
          ? meta.description
          : name === 'og:image' || name === 'twitter:image'
            ? meta.image
            : meta.url;
    upsertMetaTag(name, content);
  }

  return () => {
    document.title = previousTitle;
    for (const name of META_TAG_NAMES) {
      const prev = previousMeta.get(name);
      if (prev == null) {
        document.head.querySelector(`meta[property="${name}"]`)?.remove();
      } else {
        upsertMetaTag(name, prev);
      }
    }
  };
}
