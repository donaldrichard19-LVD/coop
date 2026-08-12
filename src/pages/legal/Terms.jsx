import LegalLayout from './LegalLayout'

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" updated="August 12, 2026">
      <section>
        <h2>Using Coop</h2>
        <p>
          Coop is a texting service that surfaces deals at merchants you've ordered from before, based on
          order screenshots you send us and, optionally, transaction data from a linked bank account. You must
          be 18 or older, and provide a phone number you control, to use it.
        </p>
      </section>

      <section>
        <h2>SMS terms</h2>
        <p>
          Signing up enrolls you in recurring text messages from Coop. Message frequency varies. Message and
          data rates may apply. Reply STOP to cancel at any time, or HELP for help. Carriers aren't liable for
          delayed or undelivered messages.
        </p>
      </section>

      <section>
        <h2>No guarantee of deals</h2>
        <p>
          We surface deals based on merchant offers we're aware of at the time. We don't guarantee any deal is
          available, accurate, or still valid by the time you act on it — always confirm with the merchant.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Don't use Coop to send us screenshots or data that aren't your own orders, attempt to abuse or
          reverse-engineer the deal-matching system, or use the service for anything unlawful.
        </p>
      </section>

      <section>
        <h2>Disclaimer &amp; limitation of liability</h2>
        <p>
          Coop is provided "as is," without warranties of any kind. To the extent permitted by law, we aren't
          liable for indirect, incidental, or consequential damages arising from your use of the service, and
          our total liability is limited to the amount you've paid us (which, for most users, is $0).
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms as the product changes. We'll update the date at the top of this page when
          we do; continued use after a change means you accept the new terms.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about these terms — reach us below.</p>
      </section>
    </LegalLayout>
  )
}
