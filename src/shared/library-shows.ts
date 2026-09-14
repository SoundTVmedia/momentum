/** JamBase-shaped Find a Show row that came from Feedback clips, not JamBase. */
export const FEEDBACK_LIBRARY_SHOW_FLAG = 'x-feedbackLibrary';

export function isFeedbackLibraryShow(ev: Record<string, unknown>): boolean {
  return ev[FEEDBACK_LIBRARY_SHOW_FLAG] === true;
}
