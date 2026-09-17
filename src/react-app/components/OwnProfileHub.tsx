import { type ReactNode } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { Loader2 } from 'lucide-react';
import MyClipsSection from '@/react-app/components/MyClipsSection';
import SavedClipsSection from '@/react-app/components/SavedClipsSection';
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts';
import MyGoingShowsSection from '@/react-app/components/MyGoingShowsSection';

/**
 * Signed-in profile hub: clips and shows from favorite artists.
 */
type OwnProfileHubProps = {
  onOpenCapture: () => void;
  children?: ReactNode;
};

export default function OwnProfileHub({ onOpenCapture, children }: OwnProfileHubProps) {
  const { user, isPending } = useAuth();

  if (isPending) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-10 h-10 text-momentum-flare animate-spin" />
      </div>
    );
  }

  return (
    <div className="mb-10">
      {children}

      <div className="space-y-10">
        {user ? (
          <>
            <MyClipsSection onUploadClick={onOpenCapture} />
            <SavedClipsSection />
          </>
        ) : null}
        <MyGoingShowsSection variant="profile" />
        <PersonalizedConcerts />
      </div>
    </div>
  );
}
