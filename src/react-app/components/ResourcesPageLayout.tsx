import { useLayoutEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import Header from '@/react-app/components/Header'
import Footer from '@/react-app/components/Footer'

type ResourcesPageLayoutProps = {
  children: ReactNode
}

export default function ResourcesPageLayout({ children }: ResourcesPageLayoutProps) {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [pathname])

  return (
    <div className="min-h-screen text-white">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {children}
      </main>
      <Footer />
    </div>
  )
}
