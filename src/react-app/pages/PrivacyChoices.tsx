import { useEffect } from 'react'
import { Link } from 'react-router'
import ResourcesPageLayout from '@/react-app/components/ResourcesPageLayout'

export default function PrivacyChoices() {
  useEffect(() => {
    document.title = 'Privacy Choices — Feedback'
    return () => {
      document.title = 'FEEDBACK - Where live music lives.'
    }
  }, [])

  return (
    <ResourcesPageLayout>
      <header className="text-center mb-10">
        <h1 className="fb-hero-title">Privacy choices</h1>
      </header>
      <div className="space-y-4 text-gray-300 leading-relaxed">
        <p>
          Feedback does not sell personal information, share it for cross-context behavioral
          advertising, serve targeted advertising, or carry out profiling that produces legal or
          similarly significant effects. There is nothing to opt out of.
        </p>
        <p>
          We honor Global Privacy Control and other recognized universal opt-out signals. They do
          not change how Feedback works, because we do not track you across other companies’ apps
          or websites.
        </p>
        <p>
          Your other privacy rights — access, correction, deletion, and appeals — are described in
          our{' '}
          <Link to="/privacy" className="text-momentum-flare hover:text-white transition-colors">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </ResourcesPageLayout>
  )
}
