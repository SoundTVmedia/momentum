import { formatShowCardDate } from '@/shared/show-timestamp';

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso?.trim()) return '';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function clipPostedAt(clip: {
  created_at?: string | null;
  timestamp?: string | null;
}): string {
  return clip.created_at?.trim() || clip.timestamp?.trim() || '';
}

export function formatShowDate(iso: string | null | undefined): string {
  return formatShowCardDate(iso, 'short');
}
