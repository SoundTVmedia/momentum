import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import Header from '@/react-app/components/Header'
import Footer from '@/react-app/components/Footer'

type ResourcesPageLayoutProps = {
  children: ReactNode
}

function scrollWindowToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

export default function ResourcesPageLayout({ children }: ResourcesPageLayoutProps) {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    scrollWindowToTop()
    mainRef.current?.focus({ preventScroll: true })
    return () => {
      history.scrollRestoration = previous
    }
  }, [pathname])

  useEffect(() => {
    scrollWindowToTop()
    const frame = requestAnimationFrame(() => {
      scrollWindowToTop()
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <div className="min-h-screen text-white">
      <Header />
      <main
        ref={mainRef}
        tabIndex={-1}
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 outline-none"
      >
        {children}
      </main>
      <Footer />
    </div>
  )
}
