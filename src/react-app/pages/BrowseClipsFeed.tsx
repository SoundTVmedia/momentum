import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import Header from '@/react-app/components/Header';
import ClipsInfiniteGrid from '@/react-app/components/ClipsInfiniteGrid';
import { useClips } from '@/react-app/hooks/useClips';
import { getFeedFilterMeta, type FeedFilterValue } from '@/react-app/lib/feedFilterMeta';

function parseFeedType(param: string | undefined): FeedFilterValue | null {
  if (param === 'latest' || param === 'trending') return param;
  if (param === 'most-liked') return 'most_liked';
  return null;
}

export default function BrowseClipsFeedPage() {
  const navigate = useNavigate();
  const { feedType: feedTypeParam } = useParams<{ feedType: string }>();
  const feedType = useMemo(() => parseFeedType(feedTypeParam), [feedTypeParam]);
  const { label, description } = getFeedFilterMeta(feedType ?? 'latest');

  const { clips, loading, hasMore, loadMore } = useClips({
    feedType: feedType ?? 'latest',
    limit: 24,
  });

  if (!feedType) {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-400 mb-6">Unknown feed type.</p>
          <Link to="/" className="text-momentum-flare hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to feed</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-white">{label}</h1>
          <p className="mt-2 text-gray-400">{description}</p>
        </div>

        <ClipsInfiniteGrid
          clips={clips}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
      </div>
    </div>
  );
}
