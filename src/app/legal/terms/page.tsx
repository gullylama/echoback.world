import { Bullets, LegalPage, Section } from "../legal-page";

export const metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      updated="September 2026"
      intro="The agreement between you and EchoBack. Plain English, because you should be able to read it."
    >
      <Section heading="What EchoBack is">
        <p>
          A matching service. You upload music; we fingerprint it and show you real
          artists and producers whose sound it resembles, or show your sound to
          creators whose tracks resemble it. We do not generate music, we are not a
          record label, and we are not a party to whatever you agree with someone
          you meet here.
        </p>
      </Section>

      <Section heading="Your account">
        <p>
          You must be 18 or over. Keep your password to yourself — you are
          responsible for what happens under your account. One account per person.
        </p>
      </Section>

      <Section heading="Your music stays yours">
        <p>
          You keep every right you had before you uploaded. You grant us a limited,
          revocable licence to do only these things:
        </p>
        <Bullets
          items={[
            "Store your audio so the service can work.",
            "Analyse it to produce fingerprints and a waveform.",
            "Play a short preview to members you have matched with, and the full track to someone once you are in a conversation with them.",
          ]}
        />
        <p>
          That is the whole licence. We do not sell, sub-license, distribute,
          publish or train third-party models on your audio. Deleting an upload ends
          the licence for it.
        </p>
      </Section>

      <Section heading="We take no cut">
        <p>
          If something comes out of a match — a record, a credit, a fee, a royalty —
          it is entirely yours. We take no commission and claim no ownership.
          Whatever you agree with a collaborator is between the two of you, and we
          strongly suggest you put it in writing.
        </p>
      </Section>

      <Section heading="What you must not upload">
        <Bullets
          items={[
            "Anything you do not have the rights to, including other people's recordings and voices.",
            "Anything that impersonates a real person's voice without their permission.",
            "Anything unlawful, hateful, or built to harass someone.",
          ]}
        />
        <p>
          We will remove uploads that breach this and may close accounts that keep
          doing it. See <strong>Rights &amp; consent</strong> for the detail,
          including AI-generated audio.
        </p>
      </Section>

      <Section heading="Subscriptions">
        <p>
          Uploading, seeing how many people matched you, hearing what they sound
          like, and answering anyone who contacts you are free. A subscription lets
          you make the first move: reveal who matched you and reach out.
        </p>
        <p>
          Subscriptions renew monthly until cancelled. Cancel any time in your
          account and you keep access until the end of the period you have paid for.
          We do not give partial refunds for unused time, but if something on our
          side was broken, email us and we will sort it out.
        </p>
      </Section>

      <Section heading="What we do not promise">
        <p>
          We cannot promise that anyone will match you, that a match is any good,
          that anyone will accept your request, or that a collaboration will happen.
          Matching is a similarity judgement made by software, not a guarantee of
          fit. The service is provided as it is.
        </p>
        <p>
          Nothing here limits our liability for death, personal injury, fraud, or
          anything else that cannot lawfully be limited. Otherwise our liability to
          you is capped at what you paid us in the twelve months before the claim.
        </p>
      </Section>

      <Section heading="Ending it">
        <p>
          You can delete your account whenever you like, from your account settings.
          We may suspend or close an account that breaches these terms, and will
          tell you why unless we are legally prevented from doing so.
        </p>
      </Section>

      <Section heading="Law">
        <p>
          These terms are governed by the law of England and Wales, and the courts
          of England and Wales have jurisdiction.
        </p>
      </Section>
    </LegalPage>
  );
}
