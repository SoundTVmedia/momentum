import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import AmbassadorApplicationForm from '@/react-app/components/program-applications/AmbassadorApplicationForm';
import InfluencerApplicationForm from '@/react-app/components/program-applications/InfluencerApplicationForm';

type BecomeProgram = 'ambassador' | 'influencer';

type BecomeProgramPageProps = {
  program: BecomeProgram;
};

export default function BecomeProgramPage({ program }: BecomeProgramPageProps) {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, isPending, navigate]);

  if (isPending || !user) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
      </div>
    );
  }

  if (program === 'ambassador') {
    return <AmbassadorApplicationForm />;
  }

  return <InfluencerApplicationForm />;
}
