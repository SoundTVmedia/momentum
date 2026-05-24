export const SAVED_CLIPS_CHANGED_EVENT = 'momentum:saved-clips-changed';

export function notifySavedClipsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SAVED_CLIPS_CHANGED_EVENT));
}
