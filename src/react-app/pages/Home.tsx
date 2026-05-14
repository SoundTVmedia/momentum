import Header from '@/react-app/components/Header'
import HeroSection from '@/react-app/components/HeroSection'
import Footer from '@/react-app/components/Footer'
import NearbyShowsCTA from '@/react-app/components/NearbyShowsCTA'
import ConcertFeed from '@/react-app/components/ConcertFeed'
import MainFeedStack from '@/react-app/components/MainFeedStack'
import { useAuth } from '@getmocha/users-service/react'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <HeroSection />

      {!user && (
        <>
          <div className="bg-gradient-to-b from-black via-momentum-teal/8 to-slate-950 py-8 sm:py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <NearbyShowsCTA variant="banner" maxShows={1} />
            </div>
          </div>

          <div className="bg-gradient-to-b from-slate-950 via-black to-black pb-8 sm:pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
              <section>
                <h2 className="text-2xl sm:text-3xl font-headline text-white mb-2">Latest from the scene</h2>
                <p className="text-gray-400 text-sm sm:text-base mb-6">
                  Fresh moments from shows across the platform
                </p>
                <ConcertFeed feedType="latest" hideSectionHeader />
              </section>
              <section>
                <h2 className="text-2xl sm:text-3xl font-headline text-white mb-2">Trending</h2>
                <p className="text-gray-400 text-sm sm:text-base mb-6">
                  What everyone&apos;s watching right now
                </p>
                <ConcertFeed feedType="trending" hideSectionHeader />
              </section>
            </div>
          </div>
        </>
      )}

      {user && (
        <div className="bg-gradient-to-b from-black via-slate-900 to-black">
          <MainFeedStack variant="home" defaultFeedType="latest" />
        </div>
      )}

      <Footer />
    </div>
  )
}
