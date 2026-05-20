import { Link } from 'react-router'
import Header from '@/react-app/components/Header'
import HeroSection from '@/react-app/components/HeroSection'
import Footer from '@/react-app/components/Footer'
import ConcertFeed from '@/react-app/components/ConcertFeed'
import MainFeedStack from '@/react-app/components/MainFeedStack'
import PersonalizedConcerts from '@/react-app/components/PersonalizedConcerts'
import SectionHeading from '@/react-app/components/SectionHeading'
import { useAuth } from '@getmocha/users-service/react'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <HeroSection />

      {!user && (
        <>
          <div className="bg-gradient-to-b from-slate-950 via-black to-black pb-8 sm:pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
              <section className="pt-6 md:pt-8">
                <SectionHeading
                  title="Latest Feedback"
                  subtitle="Fresh moments from shows across the platform"
                  align="center"
                  size="page"
                  className="mb-6"
                />
                <ConcertFeed
                  feedType="latest"
                  hideSectionHeader
                  edgeBleed
                  edgeBleedScope="page"
                  suppressBottomPadding
                />
              </section>
              <section className="pt-6 md:pt-8">
                <SectionHeading
                  title="Trending"
                  subtitle="What everyone&apos;s watching right now"
                  align="center"
                  size="page"
                  className="mb-6"
                />
                <ConcertFeed
                  feedType="trending"
                  hideSectionHeader
                  edgeBleed
                  edgeBleedScope="page"
                  suppressBottomPadding
                />
              </section>

              <section className="pt-6 md:pt-8">
                <PersonalizedConcerts
                  carouselBleedScope="page"
                  headingVariant="page"
                  mode="nearby"
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
