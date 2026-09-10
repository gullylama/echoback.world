import { Bullets, LegalPage, Section } from "../legal-page";

export const metadata = { title: "Rights & consent" };

export default function Rights() {
  return (
    <LegalPage
      title="Rights & consent"
      updated="September 2026"
      intro="EchoBack exists because AI music is treated as a replacement for musicians. Our whole premise is the opposite — so how audio gets used here matters more to us than almost anything else."
    >
      <Section heading="What you confirm when you upload">
        <Bullets
          items={[
            "You own or control the rights to the audio, or you have permission from whoever does.",
            "You are allowed to share it with us for matching.",
            "If other people performed on it, they are happy for it to be here.",
          ]}
        />
        <p>
          You tick both boxes at upload. We take them seriously, and so should you —
          uploading someone else&rsquo;s work is the fastest way to lose your
          account.
        </p>
      </Section>

      <Section heading="AI-generated audio">
        <p>
          Creators are expected to upload AI-made music — that is the point. But you
          still need the right to upload it:
        </p>
        <Bullets
          items={[
            "Your generator's terms must allow you to use the output this way. Most do; check yours.",
            "It must not imitate a specific real artist's voice without that artist's permission.",
            "You must not present someone else's recording as your own generated output.",
          ]}
        />
        <p>
          A track that clones a named artist&rsquo;s voice will be removed. Finding
          the real artist who genuinely sounds like your track is the service; faking
          them is not.
        </p>
      </Section>

      <Section heading="What we do with a reference upload">
        <p>
          When an artist or producer uploads their work, it seeds the reference
          library. That means we analyse it to build the fingerprint that incoming
          tracks are compared against. It is never published, never listed publicly,
          never sold, and never used to train third-party models.
        </p>
        <p>
          A creator who matches you can hear a short preview — around thirty seconds
          — and nothing more, unless you accept their request and start a
          conversation. Your name stays hidden until they subscribe.
        </p>
      </Section>

      <Section heading="You keep everything">
        <p>
          Any recording, credit, fee or royalty that comes out of a match belongs
          entirely to the people who made it. EchoBack takes no percentage and claims
          no ownership of anything, ever.
        </p>
      </Section>

      <Section heading="If something of yours is here without permission">
        <p>
          Email{" "}
          <a href="mailto:hello@echoback.world" className="text-ink underline underline-offset-4">
            hello@echoback.world
          </a>{" "}
          with a link or description of the upload, what your rights in it are, and
          how to reach you. We will take it down while we look, and we will tell you
          what happened. If you are the uploader and think we got it wrong, you can
          reply and say so.
        </p>
      </Section>

      <Section heading="Deleting your work">
        <p>
          Removing an upload deletes the audio file, its fingerprints and every match
          built from it. Deleting your account does the same for everything you have
          uploaded. Neither is reversible.
        </p>
      </Section>
    </LegalPage>
  );
}
