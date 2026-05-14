import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Loader2 } from 'lucide-react';

/** Legacy `/dashboard` URL — profile and account tools live on your public profile page. */
export default function DashboardRedirect() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
    navigate(`/users/${user.id}`, { replace: true });
  }, [user, isPending, navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
    </div>
  );
}
