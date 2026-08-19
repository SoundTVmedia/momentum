import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronDown, Loader2 } from 'lucide-react'
import ResourcesPageLayout from '@/react-app/components/ResourcesPageLayout'

const SUPPORT_EMAIL = 'support@soundtvmedia.com'

const link = 'text-momentum-flare hover:text-white transition-colors'

function MailLink({ address }: { address: string }) {
  return (
    <a href={`mailto:${address}`} className={link}>
      {address}
    </a>
  )
}

const CONTACT_ROWS: Array<{ label: string; value: ReactNode }> = [
  {
    label: 'General support',
    value: (
      <>
        <MailLink address={SUPPORT_EMAIL} /> — we reply within 1 business day
      </>
    ),
  },
  {
    label: 'Safety and content reports',
    value: '[SAFETY EMAIL] — reviewed within 24 hours, every day',
  },
  {
    label: 'Appeals',
    value: '[APPEALS EMAIL] — acknowledged within 24 hours, decided within 5 business days',
  },
  {
    label: 'Privacy and data requests',
    value: '[PRIVACY EMAIL] — acknowledged within 10 days, answered within 45',
  },
  {
    label: 'Copyright (DMCA) notices',
    value: (
      <>
        [DMCA EMAIL] — see the copyright section of our{' '}
        <Link to="/terms" className={link}>
          Terms of Service
        </Link>
      </>
    ),
  },
  { label: 'Legal notices', value: '[LEGAL EMAIL]' },
  { label: 'Press', value: '[PRESS EMAIL]' },
  {
    label: 'Mail',
    value: '[LEGAL ENTITY NAME], [STREET ADDRESS], Livingston, New Jersey [ZIP], USA',
  },
]

const SLA_ROWS: Array<{
  request: string
  acknowledged: string
  resolved: string
  note: string
}> = [
  {
    request: 'Content or user report',
    acknowledged: 'Immediately, automatically',
    resolved: 'First human review within 24 hours',
    note: 'Matches the Community Guidelines and the moderation SLA',
  },
  {
    request: 'Threats, minor safety, doxxing',
    acknowledged: 'Immediately',
    resolved: 'Prioritized ahead of the queue; usually within hours',
    note: 'Escalated to founder on-call',
  },
  {
    request: 'Appeal',
    acknowledged: '24 hours',
    resolved: '5 business days',
    note: "One appeal per decision, reviewed by someone who wasn't involved in the original call",
  },
  {
    request: 'General support email',
    acknowledged: '1 business day',
    resolved: '3 business days for most issues',
    note: '',
  },
  {
    request: 'Bug report',
    acknowledged: '1 business day',
    resolved: 'Triaged within 3 business days; fix timing depends on severity',
    note: 'Crash-level bugs jump the queue',
  },
  {
    request: 'Privacy request (access, correction, deletion)',
    acknowledged: '10 days',
    resolved: '45 days, extendable once by 45 with notice',
    note: 'Self-service in the app is instant',
  },
  {
    request: 'Subscription or refund question',
    acknowledged: '1 business day',
    resolved: 'Redirected to Apple with step-by-step instructions',
    note: "We can't issue refunds",
  },
  {
    request: 'DMCA notice',
    acknowledged: '1 business day',
    resolved: 'Acted on promptly on receipt of a complete notice',
    note: '',
  },
]

type Faq = { question: string; answer: ReactNode }
type FaqGroup = { heading: string; faqs: Faq[] }

const FAQ_GROUPS: FaqGroup[] = [
  {
    heading: 'Account',
    faqs: [
      {
        question: 'How do I change my display name or username?',
        answer:
          'Settings → Profile. Your display name can change any time. Usernames can change once every 30 days, since people follow you by it.',
      },
      {
        question: 'I forgot my password.',
        answer:
          "On the login screen tap Forgot password and enter your email. The reset link is good for one hour. If nothing arrives, check spam and confirm you're using the address you signed up with. If you signed up with Apple there's no password to reset — tap Continue with Apple instead.",
      },
      {
        question: 'I signed up with Apple and hid my email. Can you still reach me?',
        answer:
          'Yes. Apple gives us a private relay address that forwards to you. Everything we send still arrives.',
      },
      {
        question: 'Can I have two accounts?',
        answer:
          'No — one person, one account. Extra accounts get removed, and using them to influence ratings is a bannable offense.',
      },
      {
        question: 'How do I make my profile private?',
        answer:
          "Reviews on Feedback are public; that's the point of a review platform. You can control your display name, avatar, and bio in Settings → Profile, and you can post under a handle rather than your real name. Your email address and your exact location are never shown.",
      },
      {
        question: 'Why do you need my date of birth?',
        answer:
          'Only to confirm you’re 16 or older, which is our minimum age. After that we keep only the year.',
      },
    ],
  },
  {
    heading: 'Reviews and moderation',
    faqs: [
      {
        question: 'Do I have to have attended the show?',
        answer: (
          <>
            Yes. First-hand only. It’s the first rule in our{' '}
            <Link to="/community-guidelines" className={link}>
              Community Guidelines
            </Link>
            .
          </>
        ),
      },
      {
        question: 'Can I edit a review?',
        answer:
          'You can edit for 30 days after posting. After that you can delete it and post a new one if you had a new experience. Edits show an "edited" label.',
      },
      {
        question: 'Can I review a show I left early?',
        answer:
          'Yes — say so in the review. "Left after four songs, the sound was unlistenable from the balcony" is genuinely useful.',
      },
      {
        question: 'The event I went to isn’t listed.',
        answer:
          'Tap Add an event and give us the artist, venue, and date. New events appear right away and we clean up duplicates.',
      },
      {
        question: 'Why was my review removed?',
        answer:
          'We only remove content that breaks the Community Guidelines. The notice we sent names the specific rule. If you think we got it wrong, use the Appeal link in that notice — a person who wasn’t involved in the original decision re-reads it and decides within 5 business days.',
      },
      {
        question: 'What’s a strike?',
        answer:
          'Most violations follow a three-strike ladder within a rolling 12 months: strike one is content removal plus a written warning, strike two adds a 7-day posting suspension, and strike three suspends the account. Serious violations — content involving minors, credible threats, doxxing, ticket scams, coordinated review manipulation — skip the ladder entirely. Strikes expire 12 months after they’re issued.',
      },
      {
        question: 'How do I appeal?',
        answer:
          'Tap Appeal in the notice we sent you, or email [APPEALS EMAIL] with the notice ID, within 30 days. We acknowledge appeals within 24 hours and decide within 5 business days. If we got it wrong we restore your content and remove the strike.',
      },
      {
        question: 'Someone posted a fake review of a show they didn’t attend.',
        answer:
          'Report it: ··· → Report → "They weren’t at this show." A person reviews every report within 24 hours.',
      },
      {
        question: 'I work at a venue. Can I review shows there?',
        answer:
          'Not without disclosing it, and we’d rather you didn’t. If you do, put the relationship in the first line of the review. Undisclosed conflicts of interest are one of the fastest ways to lose an account.',
      },
      {
        question: 'A promoter offered me tickets to write a review. Is that allowed?',
        answer:
          'No, and please tell us who asked: [SAFETY EMAIL]. Accepting anything of value for a review is prohibited, and so is offering it. A reward tied to what your review says breaks our rules and federal law on consumer reviews — even if you disclose it. A venue may ask people for honest reviews; it may not buy the sentiment.',
      },
      {
        question: 'Can a venue get my negative review taken down?',
        answer:
          'No. Venues, artists, and promoters can report content, and we apply the same published rules to their reports as to anyone’s. A negative review that follows our Guidelines stays up, and nobody can pay us to remove it.',
      },
      {
        question: 'Someone’s harassing me.',
        answer: (
          <>
            Block them first — that’s instant and doesn’t need us — then report them.{' '}
            <Link to="/settings/blocked" className={link}>
              Blocked accounts
            </Link>{' '}
            shows everyone you’ve blocked. If there’s a threat, call the police and email [SAFETY
            EMAIL]; we’ll preserve the evidence and cooperate with a lawful request.
          </>
        ),
      },
      {
        question: 'Can I post my photos from a show?',
        answer:
          'Yes, if you took them. Don’t post press photos, promo images, or other people’s shots, don’t post full-set recordings, and follow the venue’s and artist’s photo policy. We remove location data from your photos automatically before publishing.',
      },
    ],
  },
  {
    heading: 'Premium, billing, and refunds',
    faqs: [
      {
        question: 'What do I get with Premium?',
        answer:
          '[LIST PREMIUM FEATURES]. Everything else on Feedback — searching, reviewing, following, alerts — stays free.',
      },
      {
        question: 'What does it cost?',
        answer:
          '$9.99 a month or $39.99 a year, with a 30-day free trial for eligible new subscribers. The price and what’s included are always shown in the app before you buy, and prices may vary by region.',
      },
      {
        question: 'When does the free trial charge me?',
        answer:
          'Your subscription converts to paid at the end of the 30 days, and Apple charges your Apple Account then. Cancel at least 24 hours before the trial ends to avoid the charge.',
      },
      {
        question: 'How do I cancel?',
        answer:
          'Apple manages subscriptions, so it happens in iOS Settings: Settings → tap your name → Subscriptions → Feedback → Cancel Subscription, and confirm. Or open Feedback → Settings → Manage Subscription, which takes you straight there. Cancel at least 24 hours before renewal. You keep Premium until the end of the period you already paid for.',
      },
      {
        question: 'I cancelled but I still have Premium. Did it work?',
        answer:
          'Yes. Cancelling stops the next charge; access continues to the end of the current period. In iOS Settings → Subscriptions you’ll see an expiry date instead of a renewal date — that’s the confirmation.',
      },
      {
        question: 'Can I get a refund?',
        answer: (
          <>
            Apple handles all App Store refunds; we can’t issue them. Go to{' '}
            <a
              href="https://reportaproblem.apple.com"
              target="_blank"
              rel="noreferrer"
              className={link}
            >
              reportaproblem.apple.com
            </a>
            , sign in with your Apple Account, find Feedback, and choose a reason. If Apple contacts
            us about your request, we’ll respond quickly and honestly.
          </>
        ),
      },
      {
        question: 'I was charged after I deleted my account.',
        answer: (
          <>
            Deleting a Feedback account doesn’t cancel an Apple subscription — only Apple can do
            that. Cancel in iOS Settings → your name → Subscriptions, then ask Apple for a refund of
            any charge you didn’t want at{' '}
            <a
              href="https://reportaproblem.apple.com"
              target="_blank"
              rel="noreferrer"
              className={link}
            >
              reportaproblem.apple.com
            </a>
            . Email us at <MailLink address={SUPPORT_EMAIL} /> and we’ll help you get to the right
            place.
          </>
        ),
      },
      {
        question: 'Does Premium work on my iPad too?',
        answer: 'Yes — a subscription works on every device signed in to the same Apple Account.',
      },
      {
        question: 'I already paid but Premium isn’t unlocked.',
        answer: (
          <>
            Open Settings → Restore Purchases. If that doesn’t fix it within a minute, email{' '}
            <MailLink address={SUPPORT_EMAIL} /> with the date of purchase and we’ll sort it out.
          </>
        ),
      },
    ],
  },
  {
    heading: 'Notifications and location',
    faqs: [
      {
        question: 'How do I stop getting notifications?',
        answer:
          'Feedback → Settings → Notifications, where you can turn off individual types — shows near you, replies, follows, weekly recap — or iOS Settings → Notifications → Feedback to turn everything off.',
      },
      {
        question: 'Why am I getting alerts for shows I don’t care about?',
        answer:
          'Rate a few more shows and it sharpens quickly. You can also narrow your area and your genres in Settings → Recommendations, or turn recommendations off entirely.',
      },
      {
        question: 'Feedback isn’t showing shows near me.',
        answer:
          'Either turn on location — iOS Settings → Privacy & Security → Location Services → Feedback — or set your city by hand in Settings → Location. Location is optional and the app works fully without it.',
      },
    ],
  },
  {
    heading: 'Privacy and your data',
    faqs: [
      {
        question: 'How do I download my data?',
        answer:
          'Settings → Privacy → Download my data. We email you a link, usually within a few minutes and always within 45 days. It includes your account details, reviews, ratings, comments, photos, and follow lists.',
      },
      {
        question: 'How do I delete my account?',
        answer:
          'Settings → Privacy → Delete my account. We ask you to re-authenticate, then confirm. Your profile and content stop being visible immediately and are deleted from our live systems within 30 days; backups cycle out within 90. Cancel any Premium subscription with Apple first — we can’t do it for you. Download your data first if you want to keep it. Deletion is permanent.',
      },
      {
        question: 'Do you sell my information?',
        answer: (
          <>
            No. We don’t sell personal information, we don’t share it for cross-context behavioral
            advertising, and we don’t track you across other companies’ apps. Details are in our{' '}
            <Link to="/privacy" className={link}>
              Privacy Policy
            </Link>
            .
          </>
        ),
      },
      {
        question: 'Do you strip location from my photos?',
        answer: 'Yes. We remove GPS metadata from uploads before publication.',
      },
      {
        question: 'Do I have to share my location?',
        answer:
          'No. Type a city, neighborhood, or ZIP code instead — everything works.',
      },
      {
        question: 'I want to correct information you hold about me.',
        answer:
          'Most of it is editable in Settings → Profile. For anything else, email [PRIVACY EMAIL] with the subject "Privacy Request." We acknowledge within 10 days and answer within 45.',
      },
    ],
  },
  {
    heading: 'Safety and reporting',
    faqs: [
      {
        question: 'How do I report something?',
        answer:
          'Use the ··· menu on any review, comment, photo, or profile and tap Report. Or email [SAFETY EMAIL] with a link. A person reviews every report within 24 hours.',
      },
      {
        question: 'How fast do you act?',
        answer:
          'A person reviews every report within 24 hours. Threats, content involving minors, and doxxing get looked at ahead of everything else.',
      },
      {
        question: 'Will the person know I reported them?',
        answer: 'No. Reports are confidential.',
      },
      {
        question: 'What happens after I report?',
        answer:
          'We review it against the Community Guidelines and take action — removal, a strike, a suspension, or a ban — and email you when we’ve decided. We won’t share details about someone else’s account.',
      },
      {
        question: 'Someone’s selling tickets in the comments.',
        answer:
          'Report it under "Selling or scalping tickets, or a scam." Treat any stranger offering tickets in Feedback as a scammer. We remove that content on sight and repeat offenders lose their account immediately.',
      },
      {
        question: 'Someone’s in danger right now.',
        answer:
          'Call 911 first. In the US, the Suicide & Crisis Lifeline is available 24/7 at 988, by call or text. Then report the content to us so we can act on the account.',
      },
    ],
  },
  {
    heading: 'Bugs and app problems',
    faqs: [
      {
        question: 'The app keeps crashing.',
        answer:
          'Update to the latest version in the App Store, then restart your iPhone. If it still crashes, send a bug report below with diagnostics attached. That’s the fastest path to a fix.',
      },
      {
        question: 'Photos won’t upload.',
        answer:
          'Check your connection, then iOS Settings → Feedback → Photos and confirm Feedback can access the photos you select. We use Apple’s photo picker, so you only ever share the specific photos you pick.',
      },
      {
        question: 'Search can’t find an artist.',
        answer: 'Try the venue and date instead, or add the event yourself with Add an event.',
      },
    ],
  },
]

const TOPICS: Array<{ value: string; label: string }> = [
  { value: 'general', label: 'General support' },
  { value: 'bug', label: 'Bug report' },
  { value: 'report', label: 'Safety or content report' },
  { value: 'privacy', label: 'Privacy or data request' },
  { value: 'billing', label: 'Subscription or billing' },
]

/** App and device only — no account data and no content. */
function collectDiagnostics(): string {
  return [
    `URL: ${window.location.origin}`,
    `User agent: ${navigator.userAgent}`,
    `Viewport: ${window.innerWidth}x${window.innerHeight}`,
    `Language: ${navigator.language}`,
  ].join('\n')
}

function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('general')
  const [message, setMessage] = useState('')
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          topic,
          message,
          diagnostics: includeDiagnostics ? collectDiagnostics() : undefined,
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'We could not send that just now.')
      }

      setSent(true)
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send that just now.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="glass-panel border border-white/10 rounded-xl p-5 sm:p-6 text-gray-300 leading-relaxed">
        Got it. We read every message. We’ll reply to {email || 'your email'} within 1 business day,
        and sooner if the app is crashing.
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="glass-panel border border-white/10 rounded-xl p-5 sm:p-6 space-y-4"
    >
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="support-name" className="mb-1 block text-sm font-medium text-gray-300">
            Your name
          </label>
          <input
            id="support-name"
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl glass-input px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="support-email" className="mb-1 block text-sm font-medium text-gray-300">
            Email we should reply to
          </label>
          <input
            id="support-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl glass-input px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="support-topic" className="mb-1 block text-sm font-medium text-gray-300">
          What’s this about?
        </label>
        <select
          id="support-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full rounded-xl glass-input px-3 py-2 text-white focus:border-momentum-flare focus:outline-none"
        >
          {TOPICS.map((option) => (
            <option key={option.value} value={option.value} className="bg-slate-900">
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="support-message" className="mb-1 block text-sm font-medium text-gray-300">
          What happened? What did you expect instead?
        </label>
        <textarea
          id="support-message"
          required
          rows={5}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-xl glass-input px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
        />
      </div>

      <label className="flex items-start gap-3 text-sm text-gray-400">
        <input
          type="checkbox"
          checked={includeDiagnostics}
          onChange={(e) => setIncludeDiagnostics(e.target.checked)}
          className="mt-1 accent-momentum-flare"
        />
        <span>
          Include diagnostics (app version, device, and browser). No personal information and no
          content is included.
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-xl momentum-grad-interactive px-6 py-3 font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Send message
      </button>
    </form>
  )
}

export default function HelpSupport() {
  useEffect(() => {
    document.title = 'Help & Support — Feedback'
    return () => {
      document.title = 'FEEDBACK - Where live music lives.'
    }
  }, [])

  return (
    <ResourcesPageLayout>
      <header className="text-center mb-14 sm:mb-16">
        <h1 className="fb-hero-title">Help</h1>
        <p className="fb-section-subtitle fb-section-subtitle--center mt-4 max-w-xl mx-auto text-base sm:text-lg">
          Something broken, confusing, or unsafe? Tell us. A real person reads every message — there
          are two of us, so we’re fast, and we’re honest about what we can fix.
        </p>
      </header>

      <section className="mb-14 sm:mb-16" aria-labelledby="get-help-now">
        <h2 id="get-help-now" className="fb-page-section-title mb-6">
          Get help now
        </h2>
        <ul className="space-y-3 text-gray-300 leading-relaxed">
          <li className="glass-panel border border-white/10 rounded-xl p-5">
            <a href="#faq" className="font-semibold text-white hover:text-momentum-flare">
              Browse help topics
            </a>{' '}
            — answers to the things people ask most
          </li>
          <li className="glass-panel border border-white/10 rounded-xl p-5">
            <span className="font-semibold text-white">Report content or a user</span> — tap the ···
            menu on any review, photo, comment, or profile and choose Report. Reports are
            confidential.
          </li>
          <li className="glass-panel border border-white/10 rounded-xl p-5">
            <a href="#contact-form" className="font-semibold text-white hover:text-momentum-flare">
              Report a bug
            </a>{' '}
            — something’s broken or the app crashed
          </li>
          <li className="glass-panel border border-white/10 rounded-xl p-5">
            <span className="font-semibold text-white">Email us</span> —{' '}
            <MailLink address={SUPPORT_EMAIL} />
          </li>
        </ul>
        <p className="mt-4 text-sm text-gray-400">
          Reports are reviewed by a person within 24 hours.
        </p>
      </section>

      <section className="mb-14 sm:mb-16" aria-labelledby="account-and-data">
        <h2 id="account-and-data" className="fb-page-section-title mb-6">
          Your account and data
        </h2>
        <ul className="space-y-3 text-gray-300 leading-relaxed">
          <li className="glass-panel border border-white/10 rounded-xl p-5">
            <span className="font-semibold text-white">Download my data</span> — Settings → Privacy
            → Download my data
          </li>
          <li className="glass-panel border border-white/10 rounded-xl p-5">
            <span className="font-semibold text-white">Manage subscription</span> — Apple handles
            billing: iOS Settings → your name → Subscriptions
          </li>
          <li className="glass-panel border border-white/10 rounded-xl p-5">
            <Link to="/settings/blocked" className="font-semibold text-white hover:text-momentum-flare">
              Blocked accounts
            </Link>{' '}
            — see and undo everyone you’ve blocked
          </li>
          <li className="glass-panel border border-white/10 rounded-xl p-5">
            <span className="font-semibold text-white">Delete my account</span> — Settings → Privacy
            → Delete my account
          </li>
        </ul>
        <p className="mt-4 text-sm text-gray-400">
          Deleting your Feedback account does not cancel an Apple subscription. Cancel with Apple
          first.
        </p>
      </section>

      <section className="mb-14 sm:mb-16" aria-labelledby="policies">
        <h2 id="policies" className="fb-page-section-title mb-4">
          Policies
        </h2>
        <p className="text-gray-300 leading-relaxed">
          <Link to="/community-guidelines" className={link}>
            Community Guidelines
          </Link>{' '}
          ·{' '}
          <Link to="/terms" className={link}>
            Terms of Service
          </Link>{' '}
          ·{' '}
          <Link to="/privacy" className={link}>
            Privacy Policy
          </Link>
        </p>
      </section>

      <section className="mb-14 sm:mb-16" aria-labelledby="contact">
        <h2 id="contact" className="fb-page-section-title mb-6">
          Contact Feedback
        </h2>
        <div className="space-y-3">
          {CONTACT_ROWS.map((row) => (
            <article
              key={row.label}
              className="glass-panel border border-white/10 rounded-xl p-5 sm:p-6"
            >
              <h3 className="font-headline font-bold text-white mb-1">{row.label}</h3>
              <p className="text-gray-300 leading-relaxed">{row.value}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 space-y-4 text-gray-300 leading-relaxed">
          <p>
            Billing and refunds are handled by Apple. We can’t see your payment details and we can’t
            issue refunds. Start at{' '}
            <a
              href="https://reportaproblem.apple.com"
              target="_blank"
              rel="noreferrer"
              className={link}
            >
              reportaproblem.apple.com
            </a>
            .
          </p>
          <p>
            Emergencies: if someone is in immediate danger, call 911. In the US, the Suicide &amp;
            Crisis Lifeline is 988, by call or text. Then report the content to us so we can act on
            it.
          </p>
        </div>
      </section>

      <section className="mb-14 sm:mb-16" aria-labelledby="response-times">
        <h2 id="response-times" className="fb-page-section-title mb-6">
          Response-time commitments
        </h2>
        <div className="space-y-3">
          {SLA_ROWS.map((row) => (
            <article
              key={row.request}
              className="glass-panel border border-white/10 rounded-xl p-5 sm:p-6"
            >
              <h3 className="font-headline font-bold text-white mb-2">{row.request}</h3>
              <p className="text-gray-300 leading-relaxed">
                <span className="text-gray-400">Acknowledged:</span> {row.acknowledged}
              </p>
              <p className="text-gray-300 leading-relaxed">
                <span className="text-gray-400">Resolved:</span> {row.resolved}
              </p>
              {row.note ? <p className="mt-2 text-sm text-gray-400">{row.note}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mb-14 sm:mb-16" id="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="fb-page-section-title mb-6">
          Frequently asked questions
        </h2>
        <div className="space-y-10">
          {FAQ_GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="text-lg font-headline font-bold text-white mb-4">{group.heading}</h3>
              <div className="space-y-3">
                {group.faqs.map((faq) => (
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
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14 sm:mb-16" id="contact-form" aria-labelledby="write-to-us">
        <h2 id="write-to-us" className="fb-page-section-title mb-2">
          Write to us
        </h2>
        <p className="fb-section-subtitle mb-6">
          You don’t need an account to use this form. It reaches the same inbox as{' '}
          {SUPPORT_EMAIL}.
        </p>
        <ContactForm />
      </section>

      <section className="border-t border-white/10 pt-10 text-center text-gray-400 text-sm">
        <p>[LEGAL ENTITY NAME], [MAILING ADDRESS], Livingston, NJ, USA</p>
      </section>
    </ResourcesPageLayout>
  )
}
