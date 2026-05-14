import Header from '@/react-app/components/Header'
import HeroSection from '@/react-app/components/HeroSection'
import DiscoverSection from '@/react-app/components/DiscoverSection'
import Footer from '@/react-app/components/Footer'
import NearbyShowsCTA from '@/react-app/components/NearbyShowsCTA'
import { useAuth } from '@getmocha/users-service/react'
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <HeroSection />

      {/* LiveBroadcast (Tonight's show / live pulse): hidden for now — re-add useLiveSession + isLive && <LiveBroadcast layoutMode="full" /> */}

      {user && (
        <div className="bg-gradient-to-b from-black via-momentum-teal/8 to-slate-950 py-8 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <PersonalizedConcerts />
          </div>
        </div>
      )}

      <div className="bg-gradient-to-b from-black via-momentum-teal/8 to-slate-950 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <NearbyShowsCTA variant="banner" maxShows={1} />
        </div>
      </div>

      <div className="bg-gradient-to-b from-slate-950 via-momentum-teal/6 to-black pb-12 sm:pb-16 md:pb-20">
        <DiscoverSection />
      </div>

      <Footer />
    </div>
  )
}
