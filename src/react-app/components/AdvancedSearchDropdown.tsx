import { useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MapPin, Music, Ticket } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { ClipWithUser } from '@/shared/types';
import { artistPath, venuePath } from '@/shared/app-paths';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
import {
  advancedSearchHasHits,
  jamBaseEventTicket,
  type AdvancedSearchPayload,
} from '@/react-app/lib/advanced-search';

type Props = {
  query: string;
  open: boolean;
  loading: boolean;
  results: AdvancedSearchPayload | null;
  onClose: () => void;
  onDiscoverAll: () => void;
  onClipSelect: (clip: ClipWithUser, feed: ClipWithUser[]) => void;
  /** `header` = fixed width panel; `hero` = portaled fixed panel under search bar */
  variant?: 'header' | 'hero';
  /** Hero home search: anchor for fixed positioning (escapes hero stacking context). */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Optional ref on the dropdown root (for outside-click handling when portaled). */
  dropdownRef?: RefObject<HTMLDivElement | null>;
};

type PanelProps = {
  loading: boolean;
  results: AdvancedSearchPayload | null;
  onClose: () => void;
  onDiscoverAll: () => void;
  onClipSelect: (clip: ClipWithUser, feed: ClipWithUser[]) => void;
  className: string;
};

function SearchDropdownPanel({
  loading,
  results,
  onClose,
  onDiscoverAll,
  onClipSelect,
  className,
}: PanelProps) {
  const navigate = useNavigate();
  const hasHits = advancedSearchHasHits(results);

  return (
    <div className={className} role="listbox" aria-label="Search suggestions">
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-momentum-flare" />
          Searching…
        </div>
      )}
      {!loading && results && !hasHits && (
        <div className="p-4 text-center text-gray-400 text-sm">
          No matches yet — press Enter for full Discover search
        </div>
      )}
      {!loading && hasHits && results && (
        <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
          {results.clips.length > 0 && (
            <div className="border-b border-white/10">
              <div className="px-3 py-2 text-xs font-semibold text-momentum-flare/90 uppercase tracking-wide">
                Clips
              </div>
              {results.clips.map((clip, index) => (
                <button
                  key={clipListItemKey(clip, index)}
                  type="button"
                  onClick={() => {
                    const feed = results.clips.slice();
                    onClipSelect(clip, feed.length > 1 ? feed : [clip]);
                    onClose();
                  }}
                  className="w-full p-3 hover:bg-white/5 transition-colors text-left flex gap-3"
                >
                  <img
                    src={
                      clip.thumbnail_url ||
                      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop'
                    }
                    alt=""
                    className="w-14 h-14 rounded object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium truncate">
                      {clip.artist_name || 'Clip'}
                    </div>
                    <div className="text-gray-400 text-xs truncate">
                      {clip.venue_name || clip.location || '—'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {results.artists.length > 0 && (
            <div className="border-b border-white/10">
              <div className="px-3 py-2 text-xs font-semibold text-momentum-rose/80/90 uppercase tracking-wide flex items-center gap-1">
                <Music className="w-3.5 h-3.5" /> Artists (Feedback)
              </div>
              {results.artists.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(artistPath(a.name));
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 truncate"
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
          {results.venues.length > 0 && (
            <div className="border-b border-white/10">
              <div className="px-3 py-2 text-xs font-semibold text-blue-300/90 uppercase tracking-wide flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Venues (Feedback)
              </div>
              {results.venues.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(venuePath(v.name));
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 truncate"
                >
                  {v.name}
                  {v.location ? <span className="text-gray-500"> · {v.location}</span> : null}
                </button>
              ))}
            </div>
          )}
          {results.users.length > 0 && (
            <div className="border-b border-white/10">
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Creators
              </div>
              {results.users.map((u) => (
                <button
                  key={u.mocha_user_id}
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/users/${u.mocha_user_id}`);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 truncate"
                >
                  {u.display_name || 'User'}
                </button>
              ))}
            </div>
          )}
          {results.jambase &&
            (results.jambase.artists.length > 0 ||
              results.jambase.venues.length > 0 ||
              results.jambase.events.length > 0) && (
              <div className="bg-momentum-ink/40">
                <div className="px-3 py-2 text-xs font-semibold text-momentum-glacier/90 uppercase tracking-wide flex items-center gap-1">
                  <Ticket className="w-3.5 h-3.5" /> JamBase
                </div>
                {results.jambase.artists.map((a) => {
                  const name = typeof a.name === 'string' ? a.name : 'Artist';
                  return (
                    <button
                      key={typeof a.identifier === 'string' ? a.identifier : name}
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(artistPath(name));
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 truncate"
                    >
                      {name}
                    </button>
                  );
                })}
                {results.jambase.venues.map((v) => {
                  const name = typeof v.name === 'string' ? v.name : 'Venue';
                  return (
                    <button
                      key={typeof v.identifier === 'string' ? v.identifier : name}
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(venuePath(name));
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 truncate"
                    >
                      {name}
                    </button>
                  );
                })}
                {results.jambase.events.slice(0, 4).map((ev) => {
                  const id =
                    typeof ev.identifier === 'string' ? ev.identifier : String(ev.startDate);
                  const title = typeof ev.name === 'string' ? ev.name : 'Show';
                  const ticket = jamBaseEventTicket(ev);
                  return (
                    <div
                      key={id}
                      className="px-3 py-2 border-t border-white/5 flex items-center gap-2"
                    >
                      <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">{title}</span>
                      {ticket ? (
                        <a
                          href={ticket}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                          className="text-xs text-momentum-glacier hover:underline flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Tickets
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          <button
            type="button"
            onClick={onDiscoverAll}
            className="w-full py-2.5 text-center text-xs text-momentum-flare hover:bg-white/5 border-t border-white/10"
          >
            See all results on Discover →
          </button>
        </div>
      )}
    </div>
  );
}

const HERO_PANEL_CLASS =
  'glass-dropdown rounded-2xl overflow-hidden shadow-2xl shadow-black/60';

const HEADER_PANEL_CLASS =
  'absolute top-full mt-2 w-[28rem] max-w-[90vw] z-[100] glass-dropdown rounded-xl overflow-hidden shadow-xl shadow-momentum-ink/40';

export default function AdvancedSearchDropdown({
  query,
  open,
  loading,
  results,
  onClose,
  onDiscoverAll,
  onClipSelect,
  variant = 'header',
  anchorRef,
  dropdownRef,
}: Props) {
  const [portalStyle, setPortalStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || variant !== 'hero' || !anchorRef?.current) {
      setPortalStyle(null);
      return;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPortalStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, variant, anchorRef, query]);

  if (!open || query.trim().length < 2) return null;

  const panelProps = {
    loading,
    results,
    onClose,
    onDiscoverAll,
    onClipSelect,
  };

  if (variant === 'hero' && anchorRef && portalStyle) {
    return createPortal(
      <div
        ref={dropdownRef}
        className="fixed z-[200]"
        style={{
          top: portalStyle.top,
          left: portalStyle.left,
          width: portalStyle.width,
        }}
      >
        <SearchDropdownPanel {...panelProps} className={HERO_PANEL_CLASS} />
      </div>,
      document.body,
    );
  }

  if (variant === 'hero') {
    return null;
  }

  return (
    <SearchDropdownPanel
      {...panelProps}
      className={HEADER_PANEL_CLASS}
    />
  );
}
