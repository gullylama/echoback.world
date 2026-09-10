import Link from "next/link";
import { SiteFooter, SiteNav } from "@/components/site-chrome";

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="label text-ink-faint">Legal</p>
        <h1 className="font-serif-display mt-4 text-3xl sm:text-[2.6rem]">{title}</h1>
        <p className="mt-3 text-xs text-ink-faint">Last updated {updated}</p>
        <p className="mt-8 text-[0.95rem] leading-relaxed text-ink-soft">{intro}</p>
        <div className="mt-10 flex flex-col gap-10">{children}</div>
        <p className="mt-16 border-t border-hairline pt-6 text-sm text-ink-faint">
          Questions about any of this? Email{" "}
          <a href="mailto:hello@echoback.world" className="text-ink underline underline-offset-4">
            hello@echoback.world
          </a>
          . See also{" "}
          <Link href="/legal/privacy" className="text-ink underline underline-offset-4">
            Privacy
          </Link>
          ,{" "}
          <Link href="/legal/terms" className="text-ink underline underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/rights" className="text-ink underline underline-offset-4">
            Rights &amp; consent
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[0.95rem] leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span className="grad-audio mt-[0.6rem] block h-[3px] w-3 shrink-0 rounded-full" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
