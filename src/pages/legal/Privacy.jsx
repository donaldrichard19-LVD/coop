import LegalLayout from './LegalLayout'

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 12, 2026">
      <section>
        <h2>What Coop is</h2>
        <p>
          Coop is a texting service: you send us a screenshot of a recent order (a receipt, a delivery app
          confirmation, a coffee shop tab), and we text you back when a place you actually order from has a
          deal worth knowing about.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your phone number, so we can text you.</li>
          <li>Order screenshots you send us, and the merchant/item info we extract from them.</li>
          <li>If you connect a bank account (optional, via Plaid), transaction data used to find merchants you order from.</li>
          <li>Basic device and usage data (via PostHog) to understand how the site and signup flow are used.</li>
          <li>Approximate location, if you share it, to match you with nearby deals.</li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <p>
          We use your order and merchant data to figure out where you actually spend money, then text you
          when one of those merchants has a deal. We use an AI model (Anthropic's Claude) to read screenshots
          and extract merchant/item details — screenshots are sent to Anthropic for that processing and are
          not used to train their models under our agreement with them.
        </p>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <p>
          We don't sell your data. We share the minimum necessary with the vendors who run the service on our
          behalf: Twilio (sending texts), Anthropic (reading screenshots), Plaid (bank connection, if you opt
          in), Supabase (storage), and PostHog (product analytics). Each is bound by its own data-processing
          terms with us.
        </p>
      </section>

      <section>
        <h2>SMS</h2>
        <p>
          By signing up you consent to receive texts from Coop about deals at merchants you order from.
          Message and data rates may apply. Reply STOP at any time to unsubscribe, or HELP for help.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You can ask us to delete your data, disconnect Plaid, or stop texting you at any time by replying
          STOP or emailing us below. Deleting your account removes stored screenshots, extracted merchant
          data, and transaction data within 30 days.
        </p>
      </section>

      <section>
        <h2>Retention</h2>
        <p>
          We keep your data for as long as your account is active, plus a limited period afterward for fraud
          prevention and legal compliance, then delete or anonymize it.
        </p>
      </section>
    </LegalLayout>
  )
}
