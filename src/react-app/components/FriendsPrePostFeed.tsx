import { MessageCircle } from 'lucide-react';
import ConcertFeed from '@/react-app/components/ConcertFeed';
import DiscoverSectionTitle from '@/react-app/components/DiscoverSectionTitle';
import { HOME_FEED_SECTION_CLASS } from '@/react-app/lib/homeFeedLayout';

type FriendsPrePostFeedProps = {
  edgeBleed?: boolean;
};

export default function FriendsPrePostFeed({ edgeBleed = false }: FriendsPrePostFeedProps) {
  return (
    <section className={edgeBleed ? HOME_FEED_SECTION_CLASS : 'mb-8'}>
      <div className="mb-4 sm:mb-5">
        <DiscoverSectionTitle
          icon={MessageCircle}
          title="Pre & post show"
          subtitle="Talking moments from people you follow — friends only, not on the main performance feed"
        />
      </div>
      <ConcertFeed
        feedType="latest"
        feedScope="pre_post"
        hideSectionHeader
        edgeBleed={edgeBleed}
        edgeBleedScope="page"
      />
    </section>
  );
}
