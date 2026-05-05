import { Heart, Sparkles } from 'lucide-react';
import { usePersonalizedFeed } from '@/react-app/hooks/usePersonalizedFeed';
import DashboardClipsGrid, { type DashboardGridClip } from '@/react-app/components/DashboardClipsGrid';

export default function PersonalizedFeed() {
  const { clips, loading, error, personalized, hasMore, loadMore, refresh } = usePersonalizedFeed();

  if (loading && clips.length === 0) {
    return (
      <DashboardClipsGrid
        title="For You"
        subtitle="Moments from artists you love and shows near you"
        headerIcon={<Heart className="w-6 h-6 text-pink-400" />}
        clips={[]}
        loading
        error={null}
        emptyContent={null}
        hasMore={false}
        loadMore={() => {}}
        refresh={refresh}
        initialLoadingLabel="Loading your personalized feed..."
      />
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <p className="text-red-400 text-center">{error}</p>
      </div>
    );
  }

  if (!personalized || clips.length === 0) {
    return (
      <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-lg border border-purple-500/20 rounded-xl p-8">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Personalize Your Feed</h3>
          <p className="text-gray-300 mb-4">
            Complete your profile with favorite artists and home location to see personalized content!
          </p>
          <a
            href="/dashboard"
            className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-semibold hover:scale-105 transition-transform"
          >
            Update Preferences
          </a>
        </div>
      </div>
    );
  }

  return (
    <DashboardClipsGrid
      title="For You"
      subtitle="Moments from artists you love and shows near you"
      headerIcon={<Heart className="w-6 h-6 text-pink-400" />}
      clips={clips as DashboardGridClip[]}
      loading={loading}
      error={null}
      emptyContent={null}
      hasMore={hasMore}
      loadMore={loadMore}
      refresh={refresh}
      initialLoadingLabel="Loading your personalized feed..."
      showPersonalizationBadge={(clip) => !!(clip.artist_score || clip.location_score)}
    />
  );
}
