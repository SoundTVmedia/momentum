import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@getmocha/users-service/react'
import { Check, ChevronDown, MapPin, Search, Star, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import ResourcesPageLayout from '@/react-app/components/ResourcesPageLayout'

const STEPS: Array<{
  number: string
  title: string
  body: string
  icon: LucideIcon
}> = [
  {
    number: '1',
    title: 'Find the show you went to',
    body: "Search any concert, festival set, or club night in the NYC and NJ area. If it happened, it's probably here. If it isn't, add it in about ten seconds.",
    icon: Search,
  },
  {
    number: '2',
    title: "Rate it while it's fresh",
    body: 'Give it one to five stars and say what stood out: the sound, the crowd, the setlist, the room. Two sentences is a real review. Photos welcome.',
    icon: Star,
  },
  {
    number: '3',
    title: 'Follow people whose taste you trust',
    body: 'Follow friends and strangers who go to the same kind of shows. Their ratings shape what you see, so your feed sounds like your city, not a billboard.',
    icon: Users,
  },
  {
    number: '4',
    title: 'Hear about the next one first',
    body: "Feedback learns from the shows you rate and tells you when something you'd actually like is announced nearby. Tap through to buy tickets from the seller of your choice.",
    icon: MapPin,
  },
]

const RULES = [
  'You had to be there. Reviews come from people who attended. No armchair takes.',
  "Nobody can buy a rating. Venues, promoters, and artists can't pay for stars or pay to delete a bad night.",
  "We don't sell tickets, so we don't need you to like everything. Ticket links go out to third-party sellers, and we say so every time.",
  'Reports get looked at within 24 hours. By a person.',
  "Your data isn't the product. We don't sell your personal information, and we don't track you across other companies' apps.",
]

const FAQS: Array<{ question: string; answer: ReactNode }> = [
  {
    question: 'Do I have to have gone to the show to review it?',
    answer:
      "Yes. Feedback reviews are first-hand only. Rate shows you actually attended — that's the whole point, and it's what makes the ratings mean anything.",
  },
  {
    question: 'Is Feedback free?',
    answer:
      "Yes. Finding shows, posting reviews, following people, and getting alerts are all free. Feedback Premium is optional — $9.99 a month or $39.99 a year after a 30-day free trial — and you'll never be charged without choosing it first.",
  },
  {
    question: 'How does Feedback decide what to show me?',
    answer:
      'It learns from the shows you rate and the people you follow. Rate a few gigs and your feed sharpens fast. You can always browse everything by date, venue, or artist instead.',
  },
  {
    question: 'Do you sell tickets?',
    answer:
      'No. When you tap a ticket link, you leave Feedback and buy from a third-party seller. We may earn a commission on some of those links, and we label them. It never changes your price.',
  },
  {
    question: 'Can venues or artists get bad reviews taken down?',
    answer: (
      <>
        No. We remove reviews that break our{' '}
        <Link to="/community-guidelines" className="text-momentum-flare hover:text-white transition-colors">
          Community Guidelines
        </Link>{' '}
        — not reviews that someone dislikes. Nobody can pay us to remove a rating.
      </>
    ),
  },
  {
    question: 'Who can see my reviews?',
    answer:
      'Anyone using Feedback, along with your display name and photo. Your email address, your date of birth, and your exact location are never shown on your profile.',
  },
  {
    question: 'How old do I have to be?',
    answer: "16 or older. That's our minimum age, and it's the App Store rating too.",
  },
]

export default function HowItWorks() {
  const { user } = useAuth()
  const rateFirstShowHref = user ? '/discover' : '/auth?mode=signup'

  useEffect(() => {
    document.title = 'How It Works — Feedback'
    return () => {
      document.title = 'FEEDBACK - Where live music lives.'
    }
  }, [])

  return (
    <ResourcesPageLayout>
      <header className="text-center mb-14 sm:mb-16">
        <h1 className="fb-hero-title">Every show, remembered.</h1>
        <p className="fb-section-subtitle fb-section-subtitle--center mt-4 max-w-xl mx-auto text-base sm:text-lg">
          Feedback is where live-music fans say what a show was really like — and find the next one
          worth leaving the house for.
        </p>
      </header>

      <section className="mb-14 sm:mb-16" aria-labelledby="how-feedback-works">
        <h2 id="how-feedback-works" className="fb-page-section-title mb-6">
          How Feedback works
        </h2>
        <ol className="space-y-4">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <li
                key={step.number}
                className="glass-panel border border-white/10 rounded-xl p-5 sm:p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-momentum-flare/15 text-momentum-flare">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-momentum-flare mb-1">
                      Step {step.number}
                    </p>
                    <h3 className="text-lg font-headline font-bold text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-gray-300 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="mb-14 sm:mb-16" aria-labelledby="four-rules">
        <h2 id="four-rules" className="fb-page-section-title mb-2">
          Four rules we don't bend
        </h2>
        <p className="fb-section-subtitle mb-6">Real fans. Real shows. Real takes.</p>
        <ul className="space-y-3">
          {RULES.map((rule) => (
            <li
              key={rule}
              className="flex items-start gap-3 glass-panel border border-white/10 rounded-xl p-4 sm:p-5"
            >
              <Check className="h-5 w-5 shrink-0 text-momentum-ember mt-0.5" aria-hidden />
              <span className="text-gray-300 leading-relaxed">{rule}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-14 sm:mb-16" aria-labelledby="how-it-works-faq">
        <h2 id="how-it-works-faq" className="fb-page-section-title mb-6">
          Common questions
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group glass-panel border border-white/10 rounded-xl"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-white [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="px-5 pb-4 text-gray-300 leading-relaxed">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="text-center border-t border-white/10 pt-10">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to={rateFirstShowHref}
            className="inline-flex items-center justify-center px-6 py-3 momentum-grad-interactive rounded-xl text-white font-semibold hover:scale-[1.02] transition-transform"
          >
            Rate your first show
          </Link>
          <Link
            to="/browse/shows/nearby"
            className="inline-flex items-center justify-center px-6 py-3 glass-input rounded-xl text-white hover:bg-white/10 transition-colors"
          >
            Browse shows near me
          </Link>
        </div>
      </section>
    </ResourcesPageLayout>
  )
}
