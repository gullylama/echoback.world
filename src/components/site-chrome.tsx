import Link from "next/link";
import { Logo, LogoMark } from "@/components/logo";
import { currentUser } from "@/lib/session";

export async function SiteNav() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="EchoBack home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 sm:flex">
          <Link href="/#how" className="text-sm text-ink-soft transition hover:text-ink">
            How it works
          </Link>
          <Link href="/#engine" className="text-sm text-ink-soft transition hover:text-ink">
            The engine
          </Link>
          <Link href="/pricing" className="text-sm text-ink-soft transition hover:text-ink">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/studio"
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft"
            >
              Open studio
            </Link>
          ) : (
            <>
              <Link
                href="/start"
                className="hidden text-sm text-ink-soft transition hover:text-ink sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/start?role=creator"
                className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft"
              >
                Upload a demo
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="flex flex-col justify-between gap-10 sm:flex-row sm:items-end">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-ink-faint">
              A demo echoes a real artist&rsquo;s sound; the match echoes back.
            </p>
          </div>
          <nav className="flex gap-10 text-sm text-ink-soft">
            <div className="flex flex-col gap-2.5">
              <span className="label text-ink-faint">Product</span>
              <Link href="/#how" className="transition hover:text-ink">How it works</Link>
              <Link href="/pricing" className="transition hover:text-ink">Pricing</Link>
              <Link href="/start" className="transition hover:text-ink">Join</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="label text-ink-faint">Company</span>
              <span className="cursor-default text-ink-faint">Rights &amp; consent</span>
              <span className="cursor-default text-ink-faint">Privacy</span>
              <span className="cursor-default text-ink-faint">Contact</span>
            </div>
          </nav>
        </div>
        <div className="mt-12 flex items-center justify-between border-t border-hairline pt-6">
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} EchoBack — echoback.world
          </p>
          <span className="kanji select-none text-2xl text-ink-faint/50" title="hibiki — echo, resonance">
            響
          </span>
        </div>
      </div>
    </footer>
  );
}

export { LogoMark };
