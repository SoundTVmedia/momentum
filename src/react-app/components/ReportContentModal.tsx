import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import {
  MAX_REPORT_DETAILS_LENGTH,
  REPORT_REASONS,
  type ReportReasonCode,
} from '@/shared/report-reasons';
import { dispatchUserBlocksChanged } from '@/react-app/lib/user-block-events';

export type ReportTargetType = 'clip' | 'comment' | 'profile';

type ReportContentModalProps = {
  targetType: ReportTargetType;
  /** Clip id, comment id, or the reported account's user id. */
  targetId: string | number;
  /** Account that posted the reported thing, so we can offer Block on the confirmation. */
  authorId?: string | null;
  authorName?: string | null;
  onClose: () => void;
  /** Called after a successful block so the caller can refresh its list. */
  onBlocked?: (userId: string) => void;
};

const TARGET_NOUN: Record<ReportTargetType, string> = {
  clip: 'clip',
  comment: 'comment',
  profile: 'profile',
};

function reportEndpoint(targetType: ReportTargetType, targetId: string | number): string {
  if (targetType === 'clip') return `/api/clips/${targetId}/report`;
  if (targetType === 'comment') return `/api/comments/${targetId}/report`;
  return `/api/users/${encodeURIComponent(String(targetId))}/report`;
}

export default function ReportContentModal({
  targetType,
  targetId,
  authorId,
  authorName,
  onClose,
  onBlocked,
}: ReportContentModalProps) {
  const [step, setStep] = useState<'reason' | 'details' | 'sent'>('reason');
  const [reason, setReason] = useState<ReportReasonCode | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const submitReport = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(reportEndpoint(targetType, targetId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Could not send that report. Try again in a moment.');
      }

      setStep('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that report.');
    } finally {
      setSubmitting(false);
    }
  };

  const blockAuthor = async () => {
    if (!authorId) return;
    setBlocking(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(authorId)}/block`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Could not block that account.');
      }
      setBlocked(true);
      dispatchUserBlocksChanged(authorId, true);
      onBlocked?.(authorId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not block that account.');
    } finally {
      setBlocking(false);
    }
  };

  const noun = TARGET_NOUN[targetType];

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center glass-modal-overlay px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl glass-dropdown">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 glass-chrome px-5 py-4">
          <h2 id="report-modal-title" className="text-lg font-bold text-white">
            {step === 'sent' ? 'Report received' : `Report this ${noun}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {step === 'reason' ? (
            <>
              <p className="text-sm text-gray-400">
                Reports are confidential. We never tell someone who reported them.
              </p>
              <div className="space-y-1">
                {REPORT_REASONS.map((option) => (
                  <label
                    key={option.code}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      reason === option.code
                        ? 'border-momentum-flare/60 bg-momentum-flare/10 text-white'
                        : 'border-white/10 text-gray-300 hover:border-white/25 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={option.code}
                      checked={reason === option.code}
                      onChange={() => setReason(option.code)}
                      className="mt-1 accent-momentum-flare"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={!reason}
                onClick={() => setStep('details')}
                className="w-full rounded-xl momentum-grad-interactive px-4 py-2.5 font-medium text-white transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
              >
                Continue
              </button>
            </>
          ) : null}

          {step === 'details' ? (
            <>
              <p className="text-sm font-medium text-white">
                Anything else we should know? (optional)
              </p>
              <p className="text-sm text-gray-400">
                Tell us what we’re looking at — it speeds things up. If you have a ticket or order
                confirmation showing this person wasn’t there, don’t upload the barcode; a redacted
                screenshot is fine.
              </p>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, MAX_REPORT_DETAILS_LENGTH))}
                rows={4}
                maxLength={MAX_REPORT_DETAILS_LENGTH}
                className="w-full rounded-xl glass-input px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
                placeholder="Add context (optional)"
              />
              <p className="text-right text-xs text-gray-500">
                {details.length}/{MAX_REPORT_DETAILS_LENGTH}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('reason')}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submitReport()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl momentum-grad-interactive px-4 py-2.5 font-medium text-white transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send report
                </button>
              </div>
            </>
          ) : null}

          {step === 'sent' ? (
            <>
              {reason === 'minor' ? (
                <div className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>
                    Thank you for reporting this. We treat this as our highest priority. We remove
                    this content immediately and report it to the National Center for Missing &amp;
                    Exploited Children and to law enforcement, as we’re required to. Please don’t
                    screenshot, share, or reply to it.
                  </p>
                </div>
              ) : null}

              {reason === 'self_harm' ? (
                <div className="rounded-xl border border-momentum-flare/40 bg-momentum-flare/10 p-4 text-sm text-gray-100">
                  Thanks for looking out for someone. We’ll review this right away and send them
                  support resources. If you think they’re in immediate danger, call 911. In the US,
                  the Suicide &amp; Crisis Lifeline is available 24/7 at 988, by call or text.
                </div>
              ) : null}

              {reason === 'copyright' ? (
                <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-gray-200">
                  Copyright reports need a formal notice. So we can act — and so you keep your legal
                  options — send a DMCA notice to [DMCA EMAIL].{' '}
                  <Link
                    to="/terms"
                    className="text-momentum-flare transition-colors hover:text-white"
                  >
                    Read the copyright section
                  </Link>
                  .
                </div>
              ) : null}

              <div className="flex gap-3 text-sm text-gray-300">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                <p>
                  Report received. A person will look at this within 24 hours. We’ll email you when
                  we’ve made a decision. In the meantime, you can block this account so you don’t
                  see their content.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {authorId ? (
                  <button
                    type="button"
                    disabled={blocking || blocked}
                    onClick={() => void blockAuthor()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-60"
                  >
                    {blocking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {blocked
                      ? `Blocked ${authorName || 'this account'}`
                      : `Block ${authorName || 'this account'}`}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl momentum-grad-interactive px-4 py-2.5 font-medium text-white transition-transform hover:scale-[1.01]"
                >
                  Done
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
