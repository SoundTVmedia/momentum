import { Link } from 'react-router'
import Header from '@/react-app/components/Header'
import HeroSection from '@/react-app/components/HeroSection'
import Footer from '@/react-app/components/Footer'
import NearbyShowsCTA from '@/react-app/components/NearbyShowsCTA'
import ConcertFeed from '@/react-app/components/ConcertFeed'
import MainFeedStack from '@/react-app/components/MainFeedStack'
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts'
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
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
              <section>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 text-center">
                  Latest{' '}
                  <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                    Feedback
                  </span>
                </h2>
                <p className="text-gray-400 text-sm sm:text-base mb-6 text-center max-w-2xl mx-auto">
                  Fresh moments from shows across the platform
                </p>
                <ConcertFeed
                  feedType="latest"
                  hideSectionHeader
                  edgeBleed
                  edgeBleedScope="page"
                  suppressBottomPadding
                />
              </section>
              <section>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 text-center">
                  <span className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal bg-clip-text text-transparent">
                    Trending
                  </span>
                </h2>
                <p className="text-gray-400 text-sm sm:text-base mb-6 text-center max-w-2xl mx-auto">
                  What everyone&apos;s watching right now
                </p>
                <ConcertFeed
                  feedType="trending"
                  hideSectionHeader
                  edgeBleed
                  edgeBleedScope="page"
                  suppressBottomPadding
                />
              </section>

              <section>
                <PersonalizedConcerts carouselBleedScope="page" headingVariant="page" />
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

      {!user && (
        <section className="border-t border-white/10 bg-gradient-to-b from-slate-950 to-black py-10 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Link
              to="/auth?mode=signup"
              className="inline-flex items-center justify-center px-8 py-3.5 momentum-grad-interactive rounded-xl text-white font-semibold text-lg hover:scale-[1.02] transition-transform shadow-lg shadow-momentum-teal/20"
            >
              Create an account
            </Link>
          </div>
        </section>
      )}

      <Footer />
    </div>
  )
}
