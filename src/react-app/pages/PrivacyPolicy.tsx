import { useEffect } from 'react'
import { Link } from 'react-router'
import ResourcesPageLayout from '@/react-app/components/ResourcesPageLayout'

const EFFECTIVE_DATE = 'August 18, 2026'
const LAST_UPDATED = 'August 18, 2026'

const PROCESSORS = [
  {
    what: 'Cloud hosting and databases',
    data: 'All account, content, and log data',
    notes: 'Cloudflare, US regions',
  },
  {
    what: 'Image storage and delivery',
    data: 'Photos you upload',
    notes: 'Cloudflare',
  },
  {
    what: 'Transactional email',
    data: 'Email address, message content',
    notes: '[EMAIL PROVIDER]',
  },
  {
    what: 'Push notification delivery',
    data: 'Device push token',
    notes: 'Apple Push Notification service',
  },
  {
    what: 'Crash and performance reporting',
    data: 'Device and diagnostic data, installation ID',
    notes: '[CRASH/ANALYTICS PROVIDER]',
  },
  {
    what: 'Product analytics',
    data: 'In-app events tied to account ID',
    notes: '[ANALYTICS PROVIDER]',
  },
  {
    what: 'Customer support tooling',
    data: 'Support messages, email address',
    notes: '[SUPPORT TOOL]',
  },
  {
    what: 'Event and venue data',
    data: 'Event metadata (not your personal data)',
    notes: 'JamBase',
  },
]

const RETENTION = [
  {
    what: 'Account record (email, display name, year of birth)',
    howLong: 'While your account is open; deleted within 30 days of a deletion request',
  },
  {
    what: 'Reviews, ratings, comments, photos',
    howLong:
      'While your account is open, or until you delete them. On account deletion, removed from Feedback within 30 days; backups purge within 90 days',
  },
  {
    what: 'Password hash',
    howLong: 'Until deletion; rotated on change',
  },
  {
    what: 'Location you shared',
    howLong:
      'Used at the time of the query; not stored as a location history. Coarse region kept in logs per the log row below',
  },
  {
    what: 'Server and security logs',
    howLong: '90 days, then deleted or aggregated',
  },
  {
    what: 'Crash and performance data',
    howLong: '12 months',
  },
  {
    what: 'Product analytics events',
    howLong: '24 months, then aggregated and de-identified',
  },
  {
    what: 'Support and report correspondence',
    howLong: '24 months after the ticket closes',
  },
  {
    what: 'Moderation records (strikes, removals, appeals, ban evidence)',
    howLong: '3 years after the final decision, so that suspensions can be enforced and appeals reviewed',
  },
  {
    what: 'Records of banned accounts (hashed email, hashed device signal)',
    howLong: 'Retained on a suppression list to stop ban evasion; [RETENTION PERIOD — attorney decision]',
  },
  {
    what: 'Subscription and transaction records from Apple',
    howLong: '7 years, for tax and accounting',
  },
  {
    what: 'Proof of your consents, including age, location, terms acceptance, and the subscription disclosure you saw',
    howLong: '3 years, or 1 year after your account closes, whichever is longer',
  },
]

const CHOICES = [
  { want: 'Edit or delete a review, comment, or photo', where: 'The ··· menu on the item' },
  { want: 'Change what’s public on your profile', where: 'Settings → Profile' },
  { want: 'Turn location off', where: 'Settings → Location, or iOS Settings' },
  { want: 'Turn notifications off', where: 'Settings → Notifications, or iOS Settings' },
  { want: 'Turn off recommendations', where: 'Settings → Recommendations' },
  { want: 'Block or unblock someone', where: 'The ··· menu, or Settings → Blocked accounts' },
  { want: 'Download a copy of your data', where: 'Settings → Privacy → Download my data' },
  { want: 'Delete your account', where: 'Settings → Privacy → Delete my account' },
  { want: 'Withdraw a consent you gave', where: 'Settings → Privacy → Consents' },
  {
    want: 'Cancel Premium',
    where: 'iOS Settings → your name → Subscriptions (Apple handles subscriptions)',
  },
]

const LEGAL_BASES = [
  {
    purpose: 'Create accounts, publish your content, provide Premium',
    data: 'Account, content, subscription status',
    basis: 'Contract',
  },
  {
    purpose: 'Show events near you using device location',
    data: 'Approximate location',
    basis: 'Consent — revocable at any time',
  },
  {
    purpose: 'Send push notifications you asked for',
    data: 'Notification token',
    basis: 'Consent',
  },
  {
    purpose: 'Rank your feed and recommend shows',
    data: 'In-app activity',
    basis: 'Legitimate interests — making the feed useful; you can object, see §10',
  },
  {
    purpose: 'Analytics, debugging, security, anti-abuse, moderation',
    data: 'Device, usage, and moderation data',
    basis: 'Legitimate interests — running a safe, working service',
  },
  {
    purpose: 'Age screening, legal requests, tax and accounting records',
    data: 'Account, subscription',
    basis: 'Legal obligation',
  },
  {
    purpose: 'Responding to threats to someone’s life or safety, including child-safety reporting',
    data: 'Content, account',
    basis: 'Legal obligation / vital interests',
  },
]

function PolicyCard({
  title,
  rows,
}: {
  title?: string
  rows: Array<{ label: string; value: string }>
}) {
  return (
    <article className="glass-panel border border-white/10 rounded-xl p-5 sm:p-6">
      {title ? <h3 className="font-headline font-bold text-white mb-3">{title}</h3> : null}
      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-sm uppercase tracking-wide text-momentum-flare mb-1">{row.label}</dt>
            <dd className="text-gray-300 leading-relaxed">{row.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = 'Privacy Policy — Feedback'
    return () => {
      document.title = 'FEEDBACK - Where live music lives.'
    }
  }, [])

  return (
    <ResourcesPageLayout>
      <header className="text-center mb-14 sm:mb-16">
        <h1 className="fb-hero-title">Privacy Policy</h1>
        <p className="fb-section-subtitle fb-section-subtitle--center mt-4">
          Effective date: {EFFECTIVE_DATE}. Last updated: {LAST_UPDATED}. Previous versions:{' '}
          [ARCHIVE URL]
        </p>
      </header>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">The short version</h2>
        <p>
          Feedback is an app for finding live music and reviewing shows you attended. To do that we
          need your account details, the reviews and photos you choose to post, rough location if
          you want local events, and basic information about how the app performs. We do not sell
          your personal information. We do not track you across other companies’ apps or websites.
          We do not show you third-party ads. You can download your data or delete your account
          from inside the app at any time.
        </p>
        <p>This summary is for orientation. The full policy below is what governs.</p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">1. Who we are and who this covers</h2>
        <p>
          Feedback (“Feedback,” “we,” “us”) is operated by [LEGAL ENTITY NAME], [ENTITY TYPE, e.g. a
          Delaware limited liability company], with its principal place of business at [STREET
          ADDRESS], Livingston, New Jersey [ZIP], USA. We are the controller of the personal data
          described here.
        </p>
        <p>
          This policy covers the Feedback iOS app, [DOMAIN], and any email or notifications we send
          you. It does not cover third-party sites you reach through Feedback — including ticket
          sellers — which have their own policies.
        </p>
        <p>
          Contact us about privacy: [PRIVACY EMAIL] Mail: [LEGAL ENTITY NAME], Attn: Privacy,
          [MAILING ADDRESS], Livingston, NJ [ZIP]
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">2. Age requirement</h2>
        <p>
          Feedback is for people 16 and older. We ask your date of birth once, at sign-up, in a
          neutral form with nothing pre-filled and no hint at the answer. If you tell us you’re under
          16 we won’t create the account, and we delete the date of birth and any information from
          that attempt. We don’t knowingly collect personal information from anyone under 16. If
          you believe someone under 16 has an account, email [PRIVACY EMAIL] and we will delete it
          and the data associated with it. See §12.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-6 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">3. What we collect, and why</h2>
        <p>
          We’ve organized this by what you do, not by database table. We collect only what is
          reasonably necessary to run the service you asked for.
        </p>

        <div>
          <h3 className="text-lg font-headline font-bold text-white mb-3">
            a) When you create an account
          </h3>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li>
              Email address, and a password (stored only as a salted hash) — or, if you use Sign in
              with Apple, the identifier Apple gives us and the email address you choose to share,
              including Apple’s private relay address if you hide your real one.
            </li>
            <li>Display name and username.</li>
            <li>
              Date of birth, used once to confirm you’re 16 or older, then reduced to a stored year
              of birth.
            </li>
          </ul>
          <p>
            Why: to create and secure your account, to let people find you, and to enforce our age
            requirement. Legal basis (EEA/UK): performance of a contract; legal obligation for age
            assurance.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-headline font-bold text-white mb-3">b) When you post</h3>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li>Reviews, star ratings, comments and replies, and the shows you mark as attended.</li>
            <li>Profile bio and avatar.</li>
            <li>
              Photos you upload. We strip location metadata (EXIF GPS) from your photos on upload,
              before publication. That embedded location is processed only in order to remove it. We
              keep the capture time where it exists, because it helps us confirm a review is
              first-hand. If a photo you choose to upload contains other information in its
              metadata, we may retain it in the original file we hold, and we do not publish it.
            </li>
            <li>Follows, followers, likes, and saved shows.</li>
          </ul>
          <p>
            Why: to publish what you asked us to publish, to build your feed, and to keep the
            community honest. Legal basis: performance of a contract; our legitimate interest in
            preventing fraudulent reviews. Be aware: reviews, ratings, photos, display name,
            username, avatar, bio, and your follow lists are public by default and visible to anyone
            using Feedback, including people who aren’t logged in if we publish web pages for shows.
            Public means public — don’t post anything you wouldn’t want indexed, screenshotted, or
            quoted.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-headline font-bold text-white mb-3">
            c) When you look for shows near you
          </h3>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li>With your permission, your device’s location, at the precision you allow.</li>
            <li>
              If you’d rather not share location, you can type a city, neighborhood, or ZIP code
              instead — the app works fine that way.
            </li>
          </ul>
          <p>
            How precise: we ask for approximate (“coarse”) location for local discovery. We request
            precise location only if you use a feature that needs it, and we tell you at the moment
            we ask. We do not keep a history of where you’ve been. Why: to show events near you and
            to rank local results. Legal basis: consent. You can turn location off at any time in iOS
            Settings → Privacy & Security → Location Services → Feedback, or in Feedback → Settings
            → Location. Note: precise geolocation is treated as sensitive data under New Jersey and
            several other state privacy laws, which is why it is consent-only, never sold, and never
            shared for advertising.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-headline font-bold text-white mb-3">
            d) Your device and how the app performs
          </h3>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li>
              Device model, OS version, app version, language, time zone, coarse IP-derived region,
              crash reports, performance data, and in-app events such as screens viewed and
              features used, tied to your account ID.
            </li>
            <li>
              A random installation identifier we generate. We do not access Apple’s Advertising
              Identifier (IDFA), and we do not fingerprint your device.
            </li>
          </ul>
          <p>
            Why: to fix crashes, to measure whether features work, and to detect abuse, spam, and
            review manipulation. Legal basis: legitimate interests in operating and securing the
            service.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-headline font-bold text-white mb-3">e) Recommendations</h3>
          <p>
            Feedback learns from the shows you rate, the shows you save, and the people you follow
            to decide what to show you and when to notify you. This is automated, and it uses only
            what you do inside Feedback — we don’t buy data about you and we don’t watch what you
            do in other apps. It does not make decisions with legal or similarly significant effects
            about you; it only orders content. You can turn recommendations off in Settings →
            Recommendations and browse by date, venue, and artist instead. Legal basis: performance
            of a contract and legitimate interests; consent where required.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-headline font-bold text-white mb-3">f) Notifications</h3>
          <p>
            If you allow notifications, Apple gives us a push token for your device. Why: to send
            the alerts you asked for — replies, new followers, shows near you, and service notices.
            Legal basis: consent. Turn them off per type in Feedback → Settings → Notifications, or
            entirely in iOS Settings.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-headline font-bold text-white mb-3">g) Feedback Premium</h3>
          <p>
            Subscriptions are sold and billed by Apple, through the App Store. Apple processes your
            payment; we never see or receive your card number, bank details, or billing address. We
            receive from Apple a transaction identifier, the product you bought, and your
            subscription’s status and renewal or expiry dates, so we can unlock features and honor
            cancellations. We also keep our own timestamped record of which version of the
            subscription disclosure screen you saw and when you agreed to it. Why: to provide what
            you paid for, to prove what we told you before you were charged, and for our records.
            Legal basis: performance of a contract; legal obligation (tax, accounting, and
            consumer-law record-keeping).
          </p>
        </div>

        <div>
          <h3 className="text-lg font-headline font-bold text-white mb-3">h) Ticket links</h3>
          <p>
            When you tap a ticket link you leave Feedback and go to a third-party seller. We record
            that a tap happened and which event and partner it related to, and our affiliate partners
            may attribute a resulting purchase to us. We do not receive your name, payment details,
            or the contents of your order, and we do not pass your identity to the seller. What
            happens next is governed by that seller’s own privacy policy.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-headline font-bold text-white mb-3">
            i) When you contact support or report content
          </h3>
          <p>
            The content of your message, your email address, and — for reports — the item reported
            and any evidence you send. We also keep records of reports you file, blocks you set,
            content our filter flags, and enforcement history on your account. Why: to answer you,
            to enforce our{' '}
            <Link
              to="/community-guidelines"
              className="text-momentum-flare hover:text-white transition-colors"
            >
              Community Guidelines
            </Link>
            , and to meet our 24-hour report-response commitment. Legal basis: legitimate
            interests; legal obligation where a report concerns illegal content.
          </p>
        </div>

        <p>
          What we never collect: we don’t ask for or store your contacts, your microphone, your
          health data, your precise location in the background, your payment card details,
          government ID, or biometric identifiers. We don’t buy personal information about you from
          data brokers. We don’t collect browsing history from outside the app.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">4. How we use your information</h2>
        <p>
          To provide and operate Feedback; to publish what you post; to build and rank your feed and
          recommendations; to send notifications you asked for; to run Feedback Premium; to keep
          reviews honest and detect fake or incentivized reviews, spam, bots, and follower
          manipulation; to enforce our Guidelines and Terms; to respond to support requests and
          reports; to fix bugs and improve features; to produce aggregate, de-identified statistics
          about shows and venues; to comply with law; and to protect the rights and safety of our
          users, the public, and ourselves.
        </p>
        <p>
          We do not use your information to: sell it, show you third-party advertising, build
          cross-app advertising profiles, or train any third-party or general-purpose AI model.
          Content you post publicly may be used to improve Feedback’s own recommendation and safety
          systems.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">5. When we share information, and with whom</h2>
        <p>
          Publicly, at your direction. Your reviews, ratings, comments, photos, display name,
          username, avatar, bio, and follow lists are public. Anything you post publicly should be
          treated as permanently public even after deletion, because other people may have seen,
          copied, or saved it.
        </p>
        <p>
          With service providers who work for us. We use a small number of vendors, each under a
          written contract limiting them to processing data on our instructions:
        </p>
        <div className="space-y-3">
          {PROCESSORS.map((row) => (
            <PolicyCard
              key={row.what}
              title={row.what}
              rows={[
                { label: 'Data they handle', value: row.data },
                { label: 'Notes', value: row.notes },
              ]}
            />
          ))}
        </div>
        <p>A current list of our processors is also available on request at [PRIVACY EMAIL].</p>
        <p>
          We confirm that every third party with whom we share user data — including analytics
          tools, third-party SDKs, and any parent, subsidiary, or related entity with access to user
          data — is contractually required to provide the same or equal protection of your data as is
          stated in this policy.
        </p>
        <p>
          With Apple, for subscription billing, sign-in, and push notification delivery, as described
          above. With affiliate ticket partners, only the fact of a click and the associated event or
          campaign — not your identity. For legal reasons: to comply with valid legal process, to
          enforce our Terms, to investigate fraud or review manipulation, or where we believe in
          good faith it’s necessary to prevent imminent harm to someone’s life or safety. We report
          content that sexualizes a minor to the National Center for Missing & Exploited Children
          and to law enforcement. Where we are lawfully permitted to, we will tell you about a legal
          demand for your data. In a corporate transaction: if Feedback is acquired or merges, your
          information may transfer, subject to this policy or a successor policy with at least
          equivalent protections, and we will tell you before any material change applies to you.
        </p>
        <p>We do not disclose personal data to anyone else.</p>
        <p>
          We do not sell personal information, and we do not share it for cross-context behavioral
          advertising, as those terms are used in the California Consumer Privacy Act as amended by
          the California Privacy Rights Act, or their equivalents in other state privacy laws. We
          have not sold or shared personal information for those purposes in the preceding 12
          months, including the personal information of anyone we know to be a minor.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">6. Tracking and advertising</h2>
        <p>
          We don’t track you. In Apple’s terms, we do not link data collected in Feedback with data
          collected about you from other companies’ apps, websites, or offline properties for
          advertising or advertising measurement, and we do not share your data with data brokers.
          Because of that, Feedback does not show Apple’s tracking permission prompt and does not
          access your device’s Advertising Identifier. If that ever changes, we will ask for your
          permission through Apple’s prompt first, and we will update this policy before we do.
        </p>
        <p>
          We honor Global Privacy Control and other recognized universal opt-out signals on [DOMAIN].
          We also honor Do Not Track signals to the extent they reach us, though in our case they
          change nothing, because we don’t track.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">7. How long we keep things</h2>
        <div className="space-y-3">
          {RETENTION.map((row) => (
            <PolicyCard
              key={row.what}
              title={row.what}
              rows={[{ label: 'How long', value: row.howLong }]}
            />
          ))}
        </div>
        <p>
          Where we must keep something to comply with a legal obligation, resolve a dispute, or
          enforce our agreements, we keep only what’s needed for that purpose and delete the rest.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">8. How we protect your information</h2>
        <p>
          Data is encrypted in transit (TLS) and at rest. Passwords are stored only as salted hashes.
          Access to production data is limited to the people who need it, requires multi-factor
          authentication, and is logged. We keep backups and test restores. We use automated
          content filtering plus human moderation to enforce our Guidelines. We maintain a written
          information security program and an incident-response plan, and where the law requires it
          we will notify you and the relevant regulators of a data breach without undue delay. No
          system is perfectly secure, so please use a unique password and turn on two-factor
          authentication when we offer it.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">9. Your choices in the app</h2>
        <div className="space-y-3">
          {CHOICES.map((row) => (
            <PolicyCard
              key={row.want}
              title={row.want}
              rows={[{ label: 'Where', value: row.where }]}
            />
          ))}
        </div>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">10. Your privacy rights</h2>
        <p>
          Depending on where you live, you may have some or all of the following rights. We honor
          these requests for everyone, in every US state, regardless of whether your state has a
          privacy law — it’s simpler, and it’s the right default.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Know / access what we collect, use, and disclose, and the categories of third parties involved.</li>
          <li>Get a copy of your data in a portable format.</li>
          <li>Correct inaccurate personal information.</li>
          <li>Delete your personal information.</li>
          <li>
            Opt out of sale, sharing for cross-context behavioral advertising, targeted advertising,
            and profiling in furtherance of decisions with legal or similarly significant effects. We
            don’t do any of these, so there is nothing to opt out of — but the switch exists at{' '}
            <Link to="/privacy-choices" className="text-momentum-flare hover:text-white transition-colors">
              [DOMAIN]/privacy-choices
            </Link>{' '}
            anyway.
          </li>
          <li>Limit the use of sensitive personal information.</li>
          <li>Non-discrimination — using a privacy right will never change your access to Feedback or your price.</li>
          <li>Appeal a decision we make about your request.</li>
          <li>
            Authorized agents may submit requests on your behalf; we’ll need to verify their
            authority and your identity.
          </li>
          <li>
            EEA, UK, and Switzerland: you additionally have the right to object to processing based
            on legitimate interests, the right to restriction of processing, the right to withdraw
            consent at any time, and the right to lodge a complaint with your supervisory authority.
          </li>
        </ul>
        <p>
          How to exercise them: the fastest route is in-app — Settings → Privacy, where Download my
          data and Delete my account are self-service. You can also email [PRIVACY EMAIL] with the
          subject line “Privacy Request,” or write to us at the address in §1.
        </p>
        <p>
          What happens next: we acknowledge within 10 days. We verify who you are — usually by
          confirming control of your account’s email address; for a deletion or access request we
          may ask you to confirm from inside the app. We respond substantively within 45 days, and
          if we need longer we’ll tell you why and take at most another 45. There’s no charge unless
          a request is excessive or repetitive, in which case we’ll tell you before doing anything.
        </p>
        <p>
          If we say no, we’ll explain why and how to appeal. Appeals go to [PRIVACY EMAIL] with the
          subject “Privacy Appeal,” are decided by someone other than the person who made the
          original decision, and are answered within 45 days. If we deny the appeal we will tell you
          how to contact your state attorney general — in New Jersey, the Division of Consumer
          Affairs — or, in the EEA or UK, your data protection authority.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">11. Legal bases for processing (EEA and UK users)</h2>
        <p>Where the EU or UK GDPR applies to our processing, we rely on the following legal bases:</p>
        <div className="space-y-3">
          {LEGAL_BASES.map((row) => (
            <PolicyCard
              key={row.purpose}
              title={row.purpose}
              rows={[
                { label: 'Data', value: row.data },
                { label: 'Legal basis', value: row.basis },
              ]}
            />
          ))}
        </div>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">12. Deleting your account — what actually happens</h2>
        <ol className="list-decimal pl-5 space-y-3">
          <li>Settings → Privacy → Delete my account. We ask you to re-authenticate, then to confirm.</li>
          <li>
            If you have an active Premium subscription, cancel it first in iOS Settings → your name
            → Subscriptions. Deleting your Feedback account does not cancel an Apple subscription,
            and we can’t cancel it for you — only Apple can. We show you this warning and a direct
            link before you proceed.
          </li>
          <li>
            Your account is deactivated immediately: your profile, reviews, ratings, comments, and
            photos stop being visible to anyone.
          </li>
          <li>
            Within 30 days we delete your account record and your content from our live systems.
            Backups cycle out within 90 days.
          </li>
          <li>
            What survives, and why: transaction records we must retain for tax and accounting;
            moderation records where we need them to keep a suspension enforceable or to defend a
            legal claim; and de-identified, aggregated statistics that can no longer be linked to
            you.
          </li>
          <li>
            This is permanent. If you want a copy of your reviews and photos, run Download my data
            first — we offer you that option inside the flow.
          </li>
        </ol>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">13. Children’s privacy</h2>
        <p>
          Feedback is not directed to children, is rated 16+ on the App Store, and requires users to
          be 16 or older. We do not knowingly collect personal information from anyone under 16, and
          we do not sell or share the personal information of minors. If we learn that someone under
          16 has created an account, we will terminate it and delete the associated data. Parents
          and guardians can email [PRIVACY EMAIL] to have an underage account and its data removed;
          we’ll confirm when it’s done. We ask date of birth in a neutral way — nothing is
          pre-filled and we don’t hint at an answer.
        </p>
        <p>
          We do not serve targeted advertising to anyone, we do not sell personal data, and we do
          not carry out profiling that produces legal or similarly significant effects — so the
          heightened protections that state privacy laws give to minors are satisfied by how the
          product is built, not just by policy.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">14. International transfers</h2>
        <p>
          We operate from the United States and store data in the United States. If you use Feedback
          from outside the US, your information will be transferred to and processed in the US, where
          privacy laws differ from those in your country. For transfers of personal data from the
          EEA, UK, or Switzerland we rely on the European Commission’s Standard Contractual Clauses
          (and the UK Addendum or UK International Data Transfer Agreement, as applicable), together
          with additional safeguards. You can request a copy of the relevant transfer mechanism at
          [PRIVACY EMAIL].
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">15. Notice of changes</h2>
        <p>
          If we change this policy we’ll update the “Last updated” date and post the new version. For
          any material change — a new category of data, a new purpose, a new category of recipient,
          or anything that would newly permit tracking, sale, or sharing — we will notify you in the
          app and by email at least 14 days before it takes effect, and where the law requires
          consent we will ask for it before the change applies to you. Previous versions stay
          available at [ARCHIVE URL].
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">16. California-specific disclosures</h2>
        <p>
          For California residents, the categories in the CCPA as amended by the CPRA map to §3
          above as follows: identifiers (name, username, email, account ID, IP address, installation
          ID); commercial information (subscription status and purchase history from Apple); internet
          or other electronic network activity (in-app events, searches, screens viewed); geolocation
          data (approximate, and precise only with consent); audio, electronic, visual, or similar
          information (photos you upload); inferences (taste and recommendation signals derived from
          your ratings and follows); and sensitive personal information, limited to precise
          geolocation, which we process only with your consent and only to serve your request. We
          disclose these categories to the service providers listed in §5 for the business purposes
          listed in §4. We do not sell personal information and we do not share it for
          cross-context behavioral advertising. We do not use or disclose sensitive personal
          information for purposes beyond those permitted without an option to limit. To exercise
          any California right, see §10.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">17. Contact</h2>
        <p>
          [LEGAL ENTITY NAME] · [MAILING ADDRESS], Livingston, New Jersey [ZIP], USA · [PRIVACY
          EMAIL] · [SUPPORT EMAIL] This policy is also available at [DOMAIN]/privacy and inside the
          app at Settings → Privacy → Privacy Policy.
        </p>
      </section>

      <p className="text-center border-t border-white/10 pt-10">
        <Link
          to="/community-guidelines"
          className="text-momentum-flare hover:text-white transition-colors"
        >
          Community Guidelines
        </Link>
      </p>
    </ResourcesPageLayout>
  )
}
