import type { AudDIdentifyResult } from '@/react-app/utils/auddIdentify';

/** Optional JamBase / setlist / manual priors — same normalization as live matches. */
export type SongPrior = {
  artist: string;
  title: string;
  /** Extra weight 0–1; defaults to 0.2 when matched. */
  weight?: number;
};

export type LiveSongStabilizerOptions = {
  /** Consecutive windows with the same new song before replacing the displayed title. */
  confirmWindows: number;
  /** Consecutive no-match / error windows before clearing the banner (avoids flicker on dropouts). */
  clearAfterNoMatchWindows: number;
  priors?: SongPrior[];
};

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[’']/g, "'");
}

export function normalizeSongKey(artist: string, title: string): string {
  return `${norm(artist)}::${norm(title)}`;
}

function priorBonusForKey(key: string, priors: SongPrior[] | undefined): number {
  if (!priors?.length) return 0;
  let max = 0;
  for (const p of priors) {
    const pk = normalizeSongKey(p.artist, p.title);
    if (pk === key) {
      const w = typeof p.weight === 'number' && Number.isFinite(p.weight) ? p.weight : 0.2;
      max = Math.max(max, Math.min(1, w));
    }
  }
  return max;
}

/**
 * Stabilizes noisy AudD windows: streak-based confirmation before switching or clearing,
 * with optional setlist / venue priors (reduces required confirmations when the match agrees).
 */
export class LiveSongStabilizer {
  private displayedKey: string | null = null;
  private displayedArtist = '';
  private displayedTitle = '';
  private pendingKey: string | null = null;
  private pendingStreak = 0;
  private noMatchStreak = 0;
  private readonly opts: LiveSongStabilizerOptions;

  constructor(opts?: Partial<LiveSongStabilizerOptions>) {
    this.opts = {
      confirmWindows: 2,
      clearAfterNoMatchWindows: 4,
      priors: undefined,
      ...opts,
    };
  }

  setPriors(priors: SongPrior[] | undefined) {
    this.opts.priors = priors;
  }

  reset() {
    this.displayedKey = null;
    this.displayedArtist = '';
    this.displayedTitle = '';
    this.pendingKey = null;
    this.pendingStreak = 0;
    this.noMatchStreak = 0;
  }

  private formatLine(): string | null {
    if (!this.displayedKey) return null;
    if (this.displayedTitle && this.displayedArtist) {
      return `${this.displayedTitle} — ${this.displayedArtist}`;
    }
    return this.displayedTitle || this.displayedArtist || null;
  }

  /**
   * Feed one sliding-window AudD result. Returns the line safe to show after hysteresis.
   */
  observe(r: AudDIdentifyResult): { line: string | null } {
    const match =
      r.status === 'match'
        ? {
            key: normalizeSongKey(r.artist, r.title),
            artist: r.artist.trim(),
            title: r.title.trim(),
          }
        : null;

    if (match && this.displayedKey && match.key === this.displayedKey) {
      this.pendingKey = null;
      this.pendingStreak = 0;
      this.noMatchStreak = 0;
      return { line: this.formatLine() };
    }

    if (!match) {
      this.pendingKey = null;
      this.pendingStreak = 0;
      this.noMatchStreak += 1;
      if (
        this.displayedKey !== null &&
        this.noMatchStreak >= this.opts.clearAfterNoMatchWindows
      ) {
        this.displayedKey = null;
        this.displayedArtist = '';
        this.displayedTitle = '';
      }
      return { line: this.formatLine() };
    }

    this.noMatchStreak = 0;

    const bonus = priorBonusForKey(match.key, this.opts.priors);
    const highConf =
      r.status === 'match' &&
      typeof r.confidence === 'number' &&
      Number.isFinite(r.confidence) &&
      r.confidence >= 0.86;
    const need = Math.max(
      1,
      Math.round(this.opts.confirmWindows - (bonus > 0 ? 1 : 0) - (highConf ? 1 : 0)),
    );

    if (match.key === this.pendingKey) {
      this.pendingStreak += 1;
    } else {
      this.pendingKey = match.key;
      this.pendingStreak = 1;
    }

    if (this.pendingStreak >= need) {
      this.displayedKey = match.key;
      this.displayedArtist = match.artist;
      this.displayedTitle = match.title;
      this.pendingKey = null;
      this.pendingStreak = 0;
    }

    return { line: this.formatLine() };
  }
}
