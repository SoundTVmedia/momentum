import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Ban, Flag, Loader2, MoreHorizontal } from 'lucide-react';
import ReportContentModal, { type ReportTargetType } from './ReportContentModal';
import { dispatchUserBlocksChanged } from '@/react-app/lib/user-block-events';

type ContentActionsMenuProps = {
  targetType: ReportTargetType;
  targetId: string | number;
  /** Account that posted the item. Omitted for anonymous or system content. */
  authorId?: string | null;
  authorName?: string | null;
  /** Extra classes for the trigger button (icon size, colour). */
  buttonClassName?: string;
  /** Open the dropdown upward when the trigger sits near the bottom of the viewport. */
  openUp?: boolean;
  onBlocked?: (userId: string) => void;
};

/** The ··· menu the Community Guidelines and Help pages point people to. */
export default function ContentActionsMenu({
  targetType,
  targetId,
  authorId,
  authorName,
  buttonClassName = 'p-2 text-gray-400 hover:text-white transition-colors',
  openUp = false,
  onBlocked,
}: ContentActionsMenuProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isOwnContent =
    !!user && !!authorId && String(user.id).trim().toLowerCase() === authorId.trim().toLowerCase();

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (e.target instanceof Node && !containerRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  if (isOwnContent) {
    return null;
  }

  const requireAuth = () => {
    setOpen(false);
    navigate('/auth');
  };

  const handleBlock = async () => {
    if (!user) {
      requireAuth();
      return;
    }
    if (!authorId) return;

    setBlocking(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(authorId)}/block`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        setBlocked(true);
        dispatchUserBlocksChanged(authorId, true);
        onBlocked?.(authorId);
        setOpen(false);
      }
    } catch {
      /* leave the menu open so the person can retry */
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={buttonClassName}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open ? (
        <div
          className={`absolute right-0 z-[120] min-w-[190px] overflow-hidden rounded-lg glass-dropdown shadow-xl ${
            openUp ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (!user) {
                requireAuth();
                return;
              }
              setOpen(false);
              setReportOpen(true);
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-white transition-colors hover:bg-white/10"
          >
            <Flag className="h-4 w-4" />
            <span>Report</span>
          </button>

          {authorId ? (
            <button
              type="button"
              role="menuitem"
              disabled={blocking || blocked}
              onClick={() => void handleBlock()}
              className="flex w-full items-center gap-2 border-t border-white/10 px-4 py-3 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-60"
            >
              {blocking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              <span>{blocked ? 'Blocked' : `Block ${authorName || 'this account'}`}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {reportOpen ? (
        <ReportContentModal
          targetType={targetType}
          targetId={targetId}
          authorId={authorId}
          authorName={authorName}
          onClose={() => setReportOpen(false)}
          onBlocked={onBlocked}
        />
      ) : null}
    </div>
  );
}
