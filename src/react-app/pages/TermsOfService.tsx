import { useEffect } from 'react'
import { Link } from 'react-router'
import ResourcesPageLayout from '@/react-app/components/ResourcesPageLayout'

const EFFECTIVE_DATE = 'August 18, 2026'
const LAST_UPDATED = 'August 18, 2026'

const guidelinesLink = (
  <Link
    to="/community-guidelines"
    className="text-momentum-flare hover:text-white transition-colors"
  >
    Community Guidelines
  </Link>
)

const privacyLink = (
  <Link to="/privacy" className="text-momentum-flare hover:text-white transition-colors">
    Privacy Policy
  </Link>
)

export default function TermsOfService() {
  useEffect(() => {
    document.title = 'Terms of Service — Feedback'
    return () => {
      document.title = 'FEEDBACK - Where live music lives.'
    }
  }, [])

  return (
    <ResourcesPageLayout>
      <div className="mb-8 rounded-xl border border-momentum-flare/40 bg-momentum-flare/10 px-4 py-3 text-center text-sm text-gray-200">
        Draft — pending attorney review.
      </div>

      <header className="text-center mb-14 sm:mb-16">
        <h1 className="fb-hero-title">Terms of Service</h1>
        <p className="fb-section-subtitle fb-section-subtitle--center mt-4">
          Effective {EFFECTIVE_DATE}. Last updated {LAST_UPDATED}. Previous versions: [ARCHIVE URL]
        </p>
      </header>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <p>
          Please read this. These Terms are a contract between you and [LEGAL ENTITY NAME]. They
          include a limitation of our liability (§14), an agreement to bring claims individually rather
          than as part of a class action (§16), and a New Jersey governing-law and Essex County venue
          clause (§16). If you don’t agree to these Terms, don’t use Feedback.
        </p>
        <p>
          Plain-language summary — the Terms below control. You must be 16 or older. Be honest and
          be decent: we have zero tolerance for objectionable content and abusive users. You own
          your reviews and photos, and you license us to display them. Feedback Premium is billed by
          Apple and renews until you cancel with Apple. Ticket links take you to third-party sellers,
          and some of them pay us a commission. We host other people’s opinions; we’re not the
          author of them. Disputes go to New Jersey courts.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">1. Who we are</h2>
        <p>
          Feedback is operated by [LEGAL ENTITY NAME], [ENTITY TYPE], [STREET ADDRESS],
          Livingston, New Jersey [ZIP], USA. “Feedback,” “we,” “us,” and “our” mean that company.
          “You” means you. “Service” means the Feedback iOS app, [DOMAIN], and everything we
          provide through them.
        </p>
        <p>
          Contact: [SUPPORT EMAIL] · legal notices: [LEGAL EMAIL] · mail to the address above. We
          publish this contact information so you can always reach a person here.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">2. Accepting these Terms</h2>
        <p>
          You accept these Terms by creating an account or using the Service. Our {guidelinesLink} and{' '}
          {privacyLink} are part of these Terms. If we change these Terms we’ll post the new version
          with a new date and, for material changes, notify you in the app or by email at least 14 days
          before they take effect. If you keep using Feedback after that, you’ve accepted the change.
          If you don’t agree, stop using Feedback and delete your account.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">3. Who can use Feedback</h2>
        <p>
          You must be at least 16 years old. By using Feedback you confirm that you are 16 or older,
          that you have the legal capacity to enter this contract, that you’re not barred from using
          the Service under US law or the laws where you live, and that we haven’t previously
          terminated your account. One person, one account. Accounts aren’t transferable. You’re
          responsible for what happens under your account and for keeping your password secure —
          tell us right away at [SUPPORT EMAIL] if you think someone else has access. Keep your
          account information accurate and current.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">4. What Feedback is — and what it isn’t</h2>
        <p>
          Feedback is a place to find live events and to read and post first-hand reviews of shows
          people attended.
        </p>
        <p>
          Feedback does not sell tickets and is not a ticket seller, box office, promoter, venue, or
          agent for any of them. Event listings, dates, times, lineups, prices, and venue details come
          from third parties and from users, and they change constantly. We don’t guarantee that any
          event listing is accurate, that any event will happen, or that any ticket will be honored.
          Always check with the venue or the official ticket seller before you make plans or spend
          money.
        </p>
        <p>
          Reviews and ratings on Feedback are the opinions of the people who wrote them. They are
          not our opinions, we don’t endorse them, and we don’t verify attendance or every factual
          claim in them. Ratings are aggregated automatically from user submissions.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">
          5. Ticket links and affiliate relationships — disclosure
        </h2>
        <p>
          Some links in Feedback take you to third-party ticket sellers and other merchants. When you
          buy something after following one of those links, we may earn a commission or referral fee,
          at no additional cost to you. We label these links in the app.
        </p>
        <p>
          We also want to be clear about what that money does and doesn’t buy: commission
          relationships never affect ratings, review visibility, the ranking of reviews, or moderation
          decisions. We won’t remove or bury a bad review of a show because of a commercial
          relationship with a ticket seller, a venue, or a promoter.
        </p>
        <p>
          Your purchase is a contract between you and that seller, under their terms and their privacy
          policy. We’re not a party to it. We are not responsible for tickets, fees, delivery, entry,
          cancellations, postponements, refunds, or anything else about a purchase you make from a
          third party. Take those issues to the seller.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">6. Your content, and the license you give us</h2>
        <p>
          You keep ownership of what you post. Your reviews, ratings, comments, photos, and profile
          information are yours (“Your Content”).
        </p>
        <p>
          To operate Feedback, you grant us a worldwide, non-exclusive, royalty-free, sublicensable,
          transferable license to host, store, reproduce, modify (for formatting, resizing, transcoding,
          and moderation), publish, publicly display and perform, distribute, and create derivative
          works of Your Content, in connection with operating, promoting, and improving the Service.
          This license lasts as long as your content is on Feedback and, for content others have
          interacted with or that exists in backups, for a reasonable period after removal while we
          complete deletion.
        </p>
        <p>
          Promotion: we may feature excerpts of public reviews, with your display name, in Feedback’s
          own marketing, on our website, on social media, and in the App Store. If you’d rather we
          didn’t, email [SUPPORT EMAIL] and we’ll stop using yours.
        </p>
        <p>
          What we don’t do: we don’t sell Your Content to third parties, we don’t license it to
          advertisers, and we don’t license it for training third-party or general-purpose AI models.
          We do use content posted on Feedback to operate and improve Feedback’s own
          recommendation and safety systems.
        </p>
        <p>
          You promise that: you own or have the rights to everything you post; you actually attended
          the shows you review; Your Content doesn’t infringe anyone’s copyright, trademark, privacy,
          or publicity rights; and Your Content doesn’t break these Terms, the {guidelinesLink}, or the
          law.
        </p>
        <p>
          When you delete something, we remove it from the Service, though copies may persist
          briefly in backups and may remain where others have republished it. Aggregate ratings and
          de-identified statistics that no longer identify you may remain.
        </p>
        <p>
          Feedback’s own material — our name, logo, app design, and the software — belongs to us
          and our licensors, and nothing here gives you a license to it.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">7. Community rules, and our zero-tolerance policy</h2>
        <p>You agree to follow the {guidelinesLink} in full. Read them; they’re short.</p>
        <p>
          We have zero tolerance for objectionable content and abusive behavior. That includes
          content that is illegal, defamatory, harassing, threatening, hateful, obscene, sexually
          explicit, invasive of privacy, fraudulent, or that exploits or endangers a minor, and it
          includes spam, impersonation, and doxxing.
        </p>
        <p>
          Content that sexually exploits or endangers a minor results in immediate, permanent
          termination and a report to the National Center for Missing & Exploited Children and to law
          enforcement.
        </p>
        <p>
          To keep this enforceable rather than decorative, the Service includes: automated filtering of
          objectionable material; in-app reporting, with a person reviewing every report within 24
          hours; the ability to block any user, taking effect immediately and without our involvement;
          and published contact information for reaching us directly, in §1 above and on our support
          page.
        </p>
        <p>
          We may remove content, restrict features, limit visibility, suspend, or terminate any
          account for any violation of these Terms or the Guidelines, and we enforce them through the
          three-strike ladder and the reporting, blocking, and appeal mechanisms published in the
          Guidelines. We may also remove content or terminate accounts where we reasonably believe
          it’s necessary to comply with law, protect our users, or protect Feedback. Egregious
          violations — child sexual abuse material, credible threats, ticket-fraud schemes,
          coordinated review manipulation — result in an immediate permanent ban with no strikes
          and, where appropriate, a referral to law enforcement.
        </p>
        <p>
          Reviews specifically. You agree that you will not: post a review of an event you didn’t
          attend; accept or offer anything of value in exchange for posting, changing, or removing a
          review; post a review while you have an undisclosed relationship with the venue, artist,
          promoter, ticket seller, or their affiliates; use multiple or fake accounts to influence
          ratings; acquire or sell followers or other engagement; or use a review or a threatened
          review to extract money or benefits from anyone.
        </p>
        <p>
          And what we won’t do. We do not remove reviews because they are negative, and we do not
          accept payment to remove, bury, or reorder reviews. We apply our published {guidelinesLink}{' '}
          uniformly to every report, whoever makes it, and we apply the same criteria to positive and
          negative reviews alike.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">8. Things you may not do</h2>
        <p>
          You may not: break the law using Feedback; extract, harvest, or bulk-download the Service
          or use automated means to access it without our written permission; reverse-engineer,
          decompile, or disassemble the app except as applicable law allows; interfere with or
          overload our systems; probe or breach security or authentication; access another user’s
          account; resell or commercially exploit the Service; use Feedback to sell, resell, or
          advertise tickets or any other goods or services; use our name or brand without permission;
          remove or obscure any proprietary notice; or help anyone else do these things.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">
          9. Feedback Premium: billing, free trial, and cancellation
        </h2>
        <p>
          Feedback’s core features are free. Feedback Premium is optional and unlocks [LIST PREMIUM
          FEATURES — must be real, ongoing value].
        </p>
        <p>
          Price and terms. $9.99 per month or $39.99 per year, in US dollars, charged to your Apple
          Account. A 30-day free trial is available to eligible new subscribers. Your subscription
          renews automatically at the end of each term, at the then-current price, and continues until
          you cancel. When the free trial ends, your subscription automatically converts to a paid
          subscription and your Apple Account is charged $9.99 per month — or $39.99 per year, if
          you chose the annual plan — unless you cancel at least 24 hours before the trial ends.
          Prices may vary by region and are shown in the app before you buy. The exact price, the
          length of the term, and the renewal price are displayed on the purchase screen immediately
          next to the purchase button, and we ask you to confirm before anything is charged. We keep
          a dated record of the disclosure you were shown and of your confirmation.
        </p>
        <p>
          Apple bills you, not us. All purchases are processed by Apple through In-App Purchase.
          Payment is charged to your Apple Account at confirmation of purchase. Your Apple Account
          is charged for renewal within 24 hours before the end of the current period. We never see
          your payment card details.
        </p>
        <p>How to cancel — this is the important part. You can cancel at any time, and it takes about four taps:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Open the Settings app on your iPhone.</li>
          <li>Tap your name at the top, then Subscriptions.</li>
          <li>Tap Feedback.</li>
          <li>Tap Cancel Subscription, and confirm.</li>
        </ol>
        <p>
          You can also do this from Feedback → Settings → Manage Subscription, which opens the same
          Apple screen directly, or at apps.apple.com/account/subscriptions. Cancel at least 24 hours
          before your renewal date to avoid being charged for the next period. Cancelling stops
          future charges; your Premium access continues until the end of the period you already paid
          for. Deleting the Feedback app, or deleting your Feedback account, does not cancel your
          subscription — cancel with Apple.
        </p>
        <p>
          Reminders. We’ll send you a reminder before your free trial converts to a paid
          subscription, and at least once a year for as long as your subscription is active, restating
          the price, the renewal date, and how to cancel.
        </p>
        <p>
          Changes to price. If we raise the price of an existing subscription, Apple will ask you to
          agree to the new price before it applies to you. If you don’t agree, your subscription won’t
          renew.
        </p>
        <p>
          Refunds. Apple handles all refunds for In-App Purchases; we cannot issue them. Request one
          at reportaproblem.apple.com, or follow Apple’s steps for requesting a refund for App Store
          purchases. If Apple asks us to weigh in, we’ll respond promptly and honestly. Unused
          portions of a free trial are forfeited when a paid subscription begins. Except where the law
          requires otherwise, payments are not refundable by us.
        </p>
        <p>
          If we discontinue Premium or materially reduce what it includes, we’ll tell you in advance
          and — where we can, and where the law requires — arrange an appropriate refund of a
          prepaid unused period through Apple.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">10. Copyright and the DMCA</h2>
        <p>
          We respect copyright and we expect you to. If you believe content on Feedback infringes
          your copyright, send a written notice to [LEGAL EMAIL] containing everything the Digital
          Millennium Copyright Act requires:
        </p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Your physical or electronic signature.</li>
          <li>Identification of the copyrighted work you claim is infringed.</li>
          <li>
            Identification of the material you claim is infringing, with enough detail for us to find it
            — a direct link to the review or photo is best.
          </li>
          <li>Your name, mailing address, telephone number, and email address.</li>
          <li>
            A statement that you have a good-faith belief that the use is not authorized by the
            copyright owner, its agent, or the law.
          </li>
          <li>
            A statement, under penalty of perjury, that the information in the notice is accurate and
            that you are the copyright owner or authorized to act on their behalf.
          </li>
        </ol>
        <p>
          Counter-notice. If your content was removed and you believe that was a mistake or a
          misidentification, you can send a counter-notice with your signature, identification of the
          removed material and where it appeared, a statement under penalty of perjury that you have
          a good-faith belief the removal was a mistake or misidentification, your contact
          information, and your consent to the jurisdiction of the federal district court for your
          address — or, if you’re outside the US, for the district where we’re located — and to accept
          service of process from the person who sent the original notice. We may restore the
          material as the DMCA permits.
        </p>
        <p>
          Repeat infringers. We terminate the accounts of repeat copyright infringers. Knowingly
          filing a false notice or counter-notice can make you liable for damages, including costs and
          attorneys’ fees.
        </p>
        <p>
          Concert photography note. Please post only photos and clips you took yourself. Press
          photos, promo images, poster art, and other people’s photos are the most common reason
          content gets removed from Feedback.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">11. Third-party services</h2>
        <p>
          Feedback links to and depends on third-party services — ticket sellers, event data
          providers, Apple, and others. Those are provided by other companies under their own terms
          and privacy policies, and we are not responsible for them, their content, their accuracy, or
          anything you do with them. You use them at your own risk. You also agree to comply with
          any applicable third-party terms when you use Feedback — for example, your wireless data
          service agreement.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">12. Suspension and termination</h2>
        <p>
          You can stop using Feedback at any time and can delete your account in Settings → Privacy
          → Delete my account. Remember to cancel any Premium subscription with Apple separately.
        </p>
        <p>
          We may suspend or terminate your account or access, with or without notice, if you break
          these Terms or the {guidelinesLink}, if we’re required to by law, if your conduct exposes us
          or other users to legal risk or harm, or if we discontinue the Service. Where the situation
          allows, we’ll tell you why and how to appeal, as described in the Guidelines. You may
          appeal a moderation decision within 30 days, and a person who was not involved in the
          original decision will review it and respond within 5 business days.
        </p>
        <p>
          On termination: your license to use the Service ends; your public content may be removed
          or delisted; and the sections of these Terms that should survive — the content license as
          to content already distributed, disclaimers, limitation of liability, indemnity, dispute
          resolution, and governing law — survive. Termination of your account does not entitle you
          to a refund of a prepaid subscription period except where the law requires one, and does
          not by itself cancel your Apple subscription.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">13. Disclaimers</h2>
        <p>
          The Service is provided “as is” and “as available,” with all faults and without warranty of
          any kind. To the maximum extent permitted by law, we disclaim all warranties and
          conditions, express, implied, or statutory, including merchantability, satisfactory quality,
          fitness for a particular purpose, accuracy, quiet enjoyment, and non-infringement of
          third-party rights. We don’t warrant that the Service will be uninterrupted, secure, or
          error-free, that defects will be corrected, or that any content, event listing, rating, review,
          or recommendation is accurate, complete, truthful, or reliable. No advice or information
          you get from us creates any warranty.
        </p>
        <p>
          We are not responsible for user content or for other users. We don’t control what users
          post, and we’re not the author, publisher, or speaker of it. We may — but are not obliged to
          — monitor, filter, or remove content. Any moderation we do is voluntary and undertaken in
          good faith to keep Feedback usable, and doing it doesn’t make us the author of what remains
          or responsible for content we didn’t create or haven’t removed. Interactions with other
          users, venues, artists, promoters, and ticket sellers, and anything that happens at a live
          event, are at your own risk. Some jurisdictions don’t allow exclusions of implied warranties,
          so some of this may not apply to you.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">14. Limitation of liability</h2>
        <p>
          To the extent not prohibited by law, we will not be liable for personal injury or for any
          incidental, special, indirect, punitive, exemplary, or consequential damages whatsoever,
          including damages for lost profits, lost data, lost goodwill, business interruption, missed
          events, unusable or invalid tickets, or any other commercial losses, arising out of or
          relating to your use of or inability to use the Service, however caused and on any theory of
          liability, whether contract, tort, or otherwise, even if we’ve been advised of the
          possibility.
        </p>
        <p>
          Our total aggregate liability to you for all claims relating to the Service is limited to the
          greater of (a) the amount you paid us in the 12 months before the event giving rise to the
          claim, or (b) [twenty-five US dollars ($25)] / [fifty US dollars ($50)] — [PICK ONE: ATTORNEY
          DECISION].
        </p>
        <p>
          These limits apply even if a remedy fails of its essential purpose. Some jurisdictions don’t
          allow limits on liability for personal injury or for incidental or consequential damages, so
          some of this may not apply to you. Nothing here limits liability that can’t be limited under
          applicable law, including for fraud, willful misconduct, or gross negligence.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">15. Indemnity</h2>
        <p>
          You agree to indemnify and hold harmless [LEGAL ENTITY NAME] and its officers, members,
          employees, and agents from claims, damages, losses, liabilities, and reasonable legal fees
          arising out of Your Content, your use of the Service, your breach of these Terms or the{' '}
          {guidelinesLink}, or your violation of anyone’s rights or of the law. We may take over the
          defense of any such claim at your expense, and you’ll cooperate with us.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">
          16. Disputes: governing law, venue, and how claims get resolved
        </h2>
        <p>
          Talk to us first. Before starting any formal proceeding, please email [LEGAL EMAIL] with a
          description of the problem and what you’d like us to do, and we’ll write back. We’ll try to
          resolve it within 30 days, and most things get fixed here. A court may stay a proceeding
          pending completion of this step.
        </p>
        <p>
          Governing law. These Terms and any dispute arising out of them or out of the Service are
          governed by the laws of the State of New Jersey and applicable US federal law, without
          regard to conflict-of-laws rules. The United Nations Convention on Contracts for the
          International Sale of Goods does not apply.
        </p>
        <p>
          Venue. You and we agree that any dispute not resolved informally will be brought
          exclusively in the state or federal courts located in Essex County, New Jersey, and you and
          we consent to personal jurisdiction and venue there. Nothing prevents either of us from
          bringing an individual claim in small-claims court where the claim qualifies, and nothing in
          this section deprives you of a mandatory consumer protection, or a consumer venue right,
          of the state where you live.
        </p>
        <p>
          No class actions. To the extent permitted by law, you and we agree that any claim will be
          brought only in an individual capacity, and not as a plaintiff or class member in any
          purported class, collective, consolidated, or representative proceeding. If this waiver is
          held unenforceable as to a particular claim, that claim — and only that claim — proceeds in
          court without it.
        </p>
        <p>
          Time limit. To the extent permitted by law, any claim must be brought within one year after
          it arises, or it’s permanently barred.
        </p>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">17. Apple-specific terms</h2>
        <p>
          These terms apply because you got Feedback from Apple’s App Store, and they are in
          addition to the Apple Licensed Application End User License Agreement and the Apple Media
          Services Terms and Conditions that also govern your use of the app.
        </p>
        <ul className="list-disc pl-5 space-y-3">
          <li>
            Acknowledgement. These Terms are between you and us, not Apple. Apple is not a party to
            them. We — not Apple — are solely responsible for Feedback and its content. These Terms
            do not provide usage rules that conflict with the Apple Media Services Terms and
            Conditions.
          </li>
          <li>
            Scope of license. Your license to use Feedback is a non-transferable license to use it on
            any Apple-branded product that you own or control, as permitted by the Usage Rules in
            the Apple Media Services Terms and Conditions, except that Feedback may be accessed by
            other accounts associated with you through Family Sharing or volume purchasing.
          </li>
          <li>
            Maintenance and support are our responsibility, not Apple’s. Apple has no obligation
            whatsoever to furnish any maintenance or support for Feedback. Reach us at [SUPPORT
            EMAIL].
          </li>
          <li>
            Warranty. To the maximum extent permitted by law, Apple has no warranty obligation with
            respect to Feedback. If Feedback fails to conform to any applicable warranty, you may
            notify Apple, and Apple will refund the purchase price, if any, for the app; to the maximum
            extent permitted by law, Apple has no other warranty obligation whatsoever with respect
            to Feedback, and any other claims, losses, liabilities, damages, costs, or expenses
            attributable to a failure to conform to a warranty are our responsibility.
          </li>
          <li>
            Product claims. We, not Apple, are responsible for addressing any claims by you or a
            third party relating to Feedback or your possession or use of it, including product
            liability claims, any claim that Feedback fails to conform to a legal or regulatory
            requirement, and claims arising under consumer protection, privacy, or similar
            legislation.
          </li>
          <li>
            Intellectual property claims. If a third party claims that Feedback or your possession and
            use of it infringes their intellectual property rights, we, not Apple, are solely
            responsible for the investigation, defense, settlement, and discharge of that claim.
          </li>
          <li>
            Legal compliance. You represent and warrant that you are not located in a country
            subject to a US Government embargo or designated by the US Government as a “terrorist
            supporting” country, and that you are not listed on any US Government list of prohibited
            or restricted parties.
          </li>
          <li>
            Third-party terms. You must comply with applicable third-party terms of agreement when
            using Feedback — for example, your wireless data service agreement.
          </li>
          <li>
            Developer contact. Questions, complaints, or claims about Feedback: [LEGAL ENTITY
            NAME], [MAILING ADDRESS], Livingston, New Jersey [ZIP], USA · [SUPPORT EMAIL].
          </li>
          <li>
            Third-party beneficiary. Apple and Apple’s subsidiaries are third-party beneficiaries of
            this section, and upon your acceptance of these Terms, Apple will have the right — and is
            deemed to have accepted the right — to enforce this section against you as a third-party
            beneficiary.
          </li>
          <li>Apple’s contact information is available at apple.com/support.</li>
        </ul>
      </section>

      <section className="mb-14 sm:mb-16 space-y-4 text-gray-300 leading-relaxed">
        <h2 className="fb-page-section-title mb-4">18. The rest</h2>
        <p>
          Entire agreement: these Terms, the {guidelinesLink}, and the {privacyLink} are the whole
          agreement between us about the Service. Severability: if a provision is unenforceable, the
          rest stays in force. No waiver: not enforcing a right isn’t a waiver of it. Assignment: you
          may not assign these Terms; we may assign them in connection with a merger, acquisition,
          or sale of assets. Force majeure: we’re not liable for failures caused by events beyond our
          reasonable control. Notices: we’ll send legal notices to your account email; send yours to
          [LEGAL EMAIL] and to the mailing address above. Feedback about Feedback: if you send us
          suggestions, we can use them without obligation or compensation. Language: these Terms
          are in English; any translation is for convenience only.
        </p>
        <p>
          Questions: [SUPPORT EMAIL] · [LEGAL ENTITY NAME], [MAILING ADDRESS], Livingston, New
          Jersey [ZIP], USA
        </p>
      </section>
    </ResourcesPageLayout>
  )
}
