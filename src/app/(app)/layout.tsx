import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { currentUser } from "@/lib/session";
import { countFeed, countUnread } from "@/lib/data";
import { signOutAction } from "@/app/actions";
import { roleLabel } from "@/lib/demo/seed";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/start");

  const unread = await countUnread(user);
  const feedCount = user.role === "creator" ? 0 : await countFeed(user);
  const subActive = user.subscription?.status === "active";

  const tabs: { href: string; label: string; badge?: number }[] = [
    { href: "/studio", label: "Studio" },
    ...(user.role === "creator"
      ? [{ href: "/upload", label: "Upload" }]
      : [{ href: "/feed", label: "Feed", badge: feedCount }]),
    { href: "/inbox", label: "Inbox", badge: unread },
    { href: "/account", label: "Account" },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-hairline bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/studio" aria-label="Studio">
              <Logo />
            </Link>
            <nav className="hidden items-center gap-6 sm:flex">
              {tabs.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="relative text-sm text-ink-soft transition hover:text-ink"
                >
                  {t.label}
                  {t.badge ? (
                    <span className="absolute -right-3 -top-1 grid size-4 place-items-center rounded-full bg-ink font-mono text-[9px] leading-none text-paper">
                      {t.badge > 9 ? "9+" : t.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {!subActive && (
              <Link
                href="/pricing"
                className="grad-audio hidden rounded-full px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 sm:block"
              >
                Unlock matches
              </Link>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.displayName}</p>
              <p className="text-[11px] text-ink-faint">{roleLabel(user.role)}</p>
            </div>
            <form action={signOutAction}>
              <button className="text-xs text-ink-faint transition hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 pb-24 sm:px-8 sm:pb-10">
        {children}
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-paper/95 backdrop-blur-md sm:hidden">
        <div className="flex h-14 items-center justify-around">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className="relative px-3 py-1 text-xs font-medium text-ink-soft">
              {t.label}
              {t.badge ? (
                <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-ink font-mono text-[9px] leading-none text-paper">
                  {t.badge > 9 ? "9+" : t.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
