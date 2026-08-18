import type { ReactNode } from 'react'
import Header from '@/react-app/components/Header'
import Footer from '@/react-app/components/Footer'

type ResourcesPageLayoutProps = {
  children: ReactNode
}

export default function ResourcesPageLayout({ children }: ResourcesPageLayoutProps) {
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
