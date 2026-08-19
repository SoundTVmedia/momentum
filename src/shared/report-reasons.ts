/**
 * Report taxonomy. These strings are the stored moderation reasons — the same values appear in
 * the reporting UI, the `*_flags` tables, and the admin queue. Changing a label changes stored
 * data, so add new codes instead of rewording existing ones.
 */

export type ReportReasonCode =
  | 'not_at_show'
  | 'incentivized'
  | 'spam'
  | 'ticket_scam'
  | 'harassment'
  | 'threats'
  | 'hate_speech'
  | 'doxxing'
  | 'sexual_content'
  | 'minor'
  | 'self_harm'
  | 'impersonation'
  | 'copyright'
  | 'other';

export type ReportReason = {
  code: ReportReasonCode;
  label: string;
};

export const REPORT_REASONS: ReportReason[] = [
  { code: 'not_at_show', label: "They weren't at this show / the review isn't real" },
  { code: 'incentivized', label: 'Paid, incentivized, or conflict-of-interest review' },
  { code: 'spam', label: 'Spam, ads, or follower farming' },
  { code: 'ticket_scam', label: 'Selling or scalping tickets, or a scam' },
  { code: 'harassment', label: 'Harassment or bullying' },
  { code: 'threats', label: 'Threats or violence' },
  { code: 'hate_speech', label: 'Hate speech' },
  { code: 'doxxing', label: 'Private information (doxxing)' },
  { code: 'sexual_content', label: 'Sexual content' },
  { code: 'minor', label: 'Content involving a minor' },
  { code: 'self_harm', label: 'Self-harm or someone in crisis' },
  { code: 'impersonation', label: 'Impersonation' },
  { code: 'copyright', label: 'Copyright — this is my photo or video' },
  { code: 'other', label: 'Something else' },
];

export const REPORT_REASON_CODES = REPORT_REASONS.map((reason) => reason.code);

export const MAX_REPORT_DETAILS_LENGTH = 500;

export function isReportReasonCode(value: unknown): value is ReportReasonCode {
  return typeof value === 'string' && REPORT_REASON_CODES.includes(value as ReportReasonCode);
}

export function reportReasonLabel(code: string): string {
  return REPORT_REASONS.find((reason) => reason.code === code)?.label ?? code;
}

/** Removed from view on receipt, ahead of human review, and emailed to the founders. */
export function reasonRequiresImmediateRemoval(code: string): boolean {
  return code === 'minor';
}

/** Jumps the queue and is emailed to the founders, but is not auto-removed. */
export function reasonRequiresUrgentReview(code: string): boolean {
  return (
    code === 'minor' || code === 'self_harm' || code === 'threats' || code === 'doxxing'
  );
}
