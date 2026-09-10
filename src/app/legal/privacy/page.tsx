import { Bullets, LegalPage, Section } from "../legal-page";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      updated="September 2026"
      intro="EchoBack is run from the United Kingdom. This explains what we hold about you, why, and how to get rid of it. We do not sell your data, we do not advertise, and we do not track you across the web."
    >
      <Section heading="What we hold">
        <Bullets
          items={[
            "Account: your email address, the name you chose, and whether you joined as a creator, artist or producer.",
            "Profile: anything you choose to add — location, genres, a line about your craft, a short bio.",
            "Uploads: the audio you upload, plus what we derive from it — a content fingerprint, a waveform, its duration, and the numerical vectors the matching engine compares.",
            "Activity: which tracks matched which people, the requests you send or receive, and the messages in your conversations.",
            "Billing: if you subscribe, Stripe handles your card. We never see or store card numbers — only whether your subscription is active and when it renews.",
          ]}
        />
      </Section>

      <Section heading="Why we hold it">
        <p>
          To run the service you asked for: matching your uploads, showing you who
          matched, letting people reach each other, and taking payment. That is
          performance of our contract with you. We keep minimal logs to keep the
          service secure and working, which is our legitimate interest.
        </p>
        <p>
          Notification emails are transactional — they tell you someone contacted
          you. You can switch them off in your account at any time.
        </p>
      </Section>

      <Section heading="Who processes it for us">
        <Bullets
          items={[
            "Supabase — database, authentication and audio storage.",
            "Vercel — hosting.",
            "Stripe — subscription payments.",
            "Resend — notification email.",
            "Google — only if you choose to sign in with Google.",
          ]}
        />
        <p>
          Some of these run infrastructure outside the UK and EEA. Where they do,
          transfers rely on the UK International Data Transfer Addendum or Standard
          Contractual Clauses.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          Your account and uploads stay until you delete them. Deleting a track
          removes the audio file, its fingerprints and its matches. Deleting your
          account removes your profile, uploads, fingerprints, matches and requests.
        </p>
        <p>
          Deleting your account also removes your conversations, for both sides —
          so tell anyone you are working with before you go. Billing records are
          kept for six years because UK tax law requires it.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          You can ask for a copy of your data, correct it, delete it, restrict or
          object to how we use it, or take it elsewhere. Deletion is immediate and
          self-service in your account settings; for anything else, email us and
          we will respond within one month.
        </p>
        <p>
          If you think we have handled your data badly, you can complain to the
          Information Commissioner&rsquo;s Office at ico.org.uk. We would rather you
          told us first so we can fix it.
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          We set cookies to keep you signed in. That is all. There is no analytics
          or advertising tracking on EchoBack, so there is no consent banner to
          click through.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If we change anything that materially affects you, we will email you
          before it takes effect.
        </p>
      </Section>
    </LegalPage>
  );
}
