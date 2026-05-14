import Header from '@/react-app/components/Header';
import MainFeedStack from '@/react-app/components/MainFeedStack';

export default function Feed() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <Header />
      <MainFeedStack variant="page" defaultFeedType="latest" />
    </div>
  );
}
