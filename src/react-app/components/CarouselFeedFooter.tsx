import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';

type CarouselFeedFooterProps = {
  loading?: boolean;
  hasMore?: boolean;
  viewAllHref?: string;
  viewAllLabel?: string;
  showEndMessage?: boolean;
};

export default function CarouselFeedFooter({
  loading = false,
  hasMore = false,
  viewAllHref,
  viewAllLabel = 'View all',
  showEndMessage = true,
}: CarouselFeedFooterProps) {
  const showFooter = loading || viewAllHref || (showEndMessage && !hasMore && !loading);

  if (!showFooter) return null;

  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-2 min-h-[2rem]">
      {loading ? (
        <p className="inline-flex items-center gap-2 text-momentum-flare text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Loading more…
        </p>
      ) : null}

      {viewAllHref ? (
        <Link
          to={viewAllHref}
          className="inline-flex items-center justify-center rounded-full border border-momentum-ember/40 bg-black/45 px-5 py-2 text-sm font-semibold text-white transition-colors hover:border-momentum-flare/50 hover:bg-black/65"
        >
          {viewAllLabel}
        </Link>
      ) : null}

      {showEndMessage && !loading && !hasMore && !viewAllHref ? (
        <p className="text-gray-500 text-sm">You&apos;ve reached the end</p>
      ) : null}
    </div>
  );
}
