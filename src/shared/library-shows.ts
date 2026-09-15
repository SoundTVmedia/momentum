/** JamBase-shaped Find a Show row that came from Feedback clips, not JamBase. */
export const FEEDBACK_LIBRARY_SHOW_FLAG = 'x-feedbackLibrary';

/** JamBase event that already has clips or a library stub in our database. */
export const ALREADY_IN_LIBRARY_FLAG = 'x-alreadyInLibrary';

export function isFeedbackLibraryShow(ev: Record<string, unknown>): boolean {
  return ev[FEEDBACK_LIBRARY_SHOW_FLAG] === true;
}

export function isAlreadyInLibraryShow(ev: Record<string, unknown>): boolean {
  return ev[ALREADY_IN_LIBRARY_FLAG] === true || isFeedbackLibraryShow(ev);
}
