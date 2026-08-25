/** Library-only video types — omit `video/*` and `capture` so iOS prefers Photos over camera. */
export const LIBRARY_VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v';

const LIBRARY_VIDEO_NAME = /\.(mp4|mov|m4v|webm)$/i;

export function isLibraryVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  return LIBRARY_VIDEO_NAME.test(file.name);
}

/**
 * Open the device photo library for a single video.
 * Must run from a user gesture (button tap) so iOS presents the picker.
 */
export function pickLibraryVideoFile(): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = LIBRARY_VIDEO_ACCEPT;
    input.style.cssText =
      'position:fixed;left:-9999px;top:0;opacity:0;width:1px;height:1px;pointer-events:none;';
    input.setAttribute('aria-hidden', 'true');

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener('change', () => {
      finish(input.files?.[0] ?? null);
    });

    document.body.appendChild(input);

    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (!settled && !input.files?.length) finish(null);
      }, 400);
    };
    window.addEventListener('focus', onWindowFocus, { once: true });

    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.click();
      }
    } catch {
      input.click();
    }
  });
}
