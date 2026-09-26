import { useEffect } from 'react'
import Header from '@/react-app/components/Header'
import HeroSection from '@/react-app/components/HeroSection'
import HeroSearchBar from '@/react-app/components/HeroSearchBar'
import Footer from '@/react-app/components/Footer'
import MainFeedStack from '@/react-app/components/MainFeedStack'
import ProductTourOverlay from '@/react-app/components/ProductTourOverlay'
import { Button, Card, Page, PageBody } from '@/react-app/components/ui'
import { useProductTour } from '@/react-app/hooks/useProductTour'
import { isTourPending } from '@/react-app/lib/productTour'
import { useAuth } from '@getmocha/users-service/react'

export default function Home() {
  const { user, isPending } = useAuth()
  const tour = useProductTour()

  useEffect(() => {
    if (isPending || !user) return
    if (!isTourPending()) return
    if (tour.active) return
    tour.startTour()
  }, [user, isPending, tour.active, tour.startTour])

  return (
    <Page>
      <Header />

      <div className="relative z-40 bg-momentum-ink pt-[0.43rem] pb-[0.58rem] md:hidden">
        <div className="mx-auto w-[95%]">
          <HeroSearchBar />
        </div>
      </div>

      <HeroSection onTakeTour={tour.startTour} tourActive={tour.active} />

      <div className="relative z-0 bg-gradient-to-b from-black via-slate-900 to-black">
        <MainFeedStack variant="home" defaultFeedType="latest" />
      </div>

      <ProductTourOverlay
        active={tour.active}
        step={tour.step}
        stepIndex={tour.stepIndex}
        stepCount={tour.steps.length}
        targetRect={tour.targetRect}
        onNext={tour.next}
        onBack={tour.back}
        onDismiss={tour.dismissTour}
      />

      {!user && (
        <section className="border-t border-white/10 py-10 sm:py-12">
          <PageBody>
            <Card tone="accent" className="text-center">
              <h2 className="fb-section-title">Make the feed yours</h2>
              <p className="fb-section-subtitle mx-auto mt-2 max-w-lg">
                Follow artists, save shows, and pick up where the night left off.
              </p>
              <div className="mt-5">
                <Button to="/auth?mode=signup" size="lg">
                  Create an account
                </Button>
              </div>
            </Card>
          </PageBody>
        </section>
      )}

      <Footer />
    </Page>
  )
}
