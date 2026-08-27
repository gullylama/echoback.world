import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { signUpAction } from "@/app/actions";
import { currentUser } from "@/lib/session";
import { demoMode } from "@/lib/config";
import type { UserRole } from "@/lib/types";

export const metadata = { title: "Join" };

const ROLES: { role: UserRole; title: string; body: string; kicker: string }[] = [
  {
    role: "creator",
    kicker: "Creator",
    title: "I have demos",
    body: "AI-assisted or otherwise. Upload a track and get a ranked list of the real artists and producers it sounds like.",
  },
  {
    role: "artist",
    kicker: "Artist",
    title: "I have a voice",
    body: "Upload your voice or catalogue once. Every demo that echoes it lands in your feed, ranked and ready to triage.",
  },
  {
    role: "producer",
    kicker: "Producer",
    title: "I have a sound",
    body: "Upload your production work. Demos that need exactly your sound find you — matched on production, not vocals.",
  },
];

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect("/studio");
  const { role } = await searchParams;
  const chosen = ROLES.find((r) => r.role === role);

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        {!chosen ? (
          <>
            <p className="label text-ink-faint">Join EchoBack</p>
            <h1 className="font-serif-display mt-4 text-3xl sm:text-[2.6rem]">
              Which side of the echo are you?
            </h1>
            <div className="mt-12 flex flex-col gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
              {ROLES.map((r) => (
                <Link
                  key={r.role}
                  href={`/start?role=${r.role}`}
                  className="group flex items-center justify-between gap-6 bg-paper-raised p-7 transition hover:bg-paper"
                >
                  <div>
                    <p className="label text-ink-faint">{r.kicker}</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight">{r.title}</p>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{r.body}</p>
                  </div>
                  <span className="text-2xl text-ink-faint transition group-hover:translate-x-1 group-hover:text-ink">
                    →
                  </span>
                </Link>
              ))}
            </div>
            <p className="mt-8 text-xs leading-relaxed text-ink-faint">
              Uploading is free for everyone. You only ever pay to reveal matches.
            </p>
          </>
        ) : (
          <>
            <Link href="/start" className="text-sm text-ink-faint transition hover:text-ink">
              ← All roles
            </Link>
            <p className="label mt-8 text-ink-faint">{chosen.kicker}</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{chosen.title}</h1>
            <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-ink-soft">{chosen.body}</p>

            <form action={signUpAction} className="mt-10 flex max-w-md flex-col gap-4">
              <input type="hidden" name="role" value={chosen.role} />
              <label className="flex flex-col gap-2">
                <span className="label text-ink-faint">
                  {chosen.role === "creator" ? "Your name or alias" : "Artist / producer name"}
                </span>
                <input
                  name="name"
                  required
                  maxLength={60}
                  placeholder={chosen.role === "producer" ? "e.g. Night Shift" : "e.g. Riva Meadows"}
                  className="rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[0.95rem] outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint"
                />
              </label>
              <button
                type="submit"
                className="mt-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
              >
                Enter EchoBack
              </button>
              {demoMode && (
                <p className="text-xs leading-relaxed text-ink-faint">
                  Running in demo mode — no email needed, and the library is seeded so
                  you can feel the full loop. With Supabase configured this becomes
                  email/OAuth sign-in.
                </p>
              )}
            </form>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
