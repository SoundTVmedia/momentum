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
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 text-center">
                  Latest from the{' '}
                  <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                    scene
                  </span>
                </h2>
                <p className="text-gray-400 text-sm sm:text-base mb-8 text-center max-w-2xl mx-auto">
                  Fresh moments from shows across the platform
                </p>
                <ConcertFeed
                  feedType="latest"
                  hideSectionHeader
                  edgeBleed
                  edgeBleedScope="page"
                />
              </section>
              <section>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 text-center">
                  <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                    Trending
                  </span>
                </h2>
                <p className="text-gray-400 text-sm sm:text-base mb-8 text-center max-w-2xl mx-auto">
                  What everyone&apos;s watching right now
                </p>
                <ConcertFeed
                  feedType="trending"
                  hideSectionHeader
                  edgeBleed
                  edgeBleedScope="page"
                />
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
