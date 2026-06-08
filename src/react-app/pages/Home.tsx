import { Link } from 'react-router'
import Header from '@/react-app/components/Header'
import HeroSection from '@/react-app/components/HeroSection'
import Footer from '@/react-app/components/Footer'
import MainFeedStack from '@/react-app/components/MainFeedStack'
import { useAuth } from '@getmocha/users-service/react'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen text-white">
      <Header />

      <HeroSection />

      <div className="relative z-0 bg-gradient-to-b from-black via-slate-900 to-black">
        <MainFeedStack variant="home" defaultFeedType="latest" />
      </div>

      {!user && (
        <section className="border-t border-white/10 bg-gradient-to-b from-slate-950 to-black py-10 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Link
              to="/auth?mode=signup"
              className="inline-flex items-center justify-center px-8 py-3.5 momentum-grad-interactive rounded-xl text-white font-semibold text-lg hover:scale-[1.02] transition-transform shadow-lg shadow-momentum-ember/20"
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
