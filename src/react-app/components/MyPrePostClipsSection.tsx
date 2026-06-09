import { MessageCircle } from 'lucide-react';
import PrePostClipsCarousel from '@/react-app/components/PrePostClipsCarousel';

type MyPrePostClipsSectionProps = {
  onUploadClick?: () => void;
};

export default function MyPrePostClipsSection({ onUploadClick }: MyPrePostClipsSectionProps) {
  return (
    <section aria-labelledby="my-pre-post-clips-heading">
      <div className="mb-4">
        <h3
          id="my-pre-post-clips-heading"
          className="text-lg sm:text-xl font-bold text-white flex items-center gap-2"
        >
          <MessageCircle className="w-5 h-5 text-momentum-flare shrink-0" aria-hidden />
          Pre & post show
        </h3>
        <p className="text-gray-400 text-sm mt-1">
          Your talking moments before and after the show — friends only, not on the main performance
          feed.
        </p>
      </div>

      <PrePostClipsCarousel
        scope="mine"
        ariaLabel="Your pre and post show moments"
        emptyMessage="No pre/post moments yet. Record a talking clip when there is no song match and clear speech is detected."
        edgeBleed
        edgeBleedScope="page"
      />

      {onUploadClick ? (
        <p className="text-gray-500 text-xs mt-3">
          Share a new moment from the capture button above when you are chatting before or after the
          set.
        </p>
      ) : null}
    </section>
  );
}
