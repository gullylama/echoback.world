import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { updatePasswordAction } from "@/app/actions";
import { getAuthState } from "@/lib/session";
import { supabaseConfigured } from "@/lib/config";

export const metadata = { title: "Set a new password" };

/*
  Landing page for a password-recovery link.

  By the time anyone gets here the callback has already verified the token
  and opened a session, so this page is simply "you are signed in, choose a
  password". Arriving without that session means the link was never opened
  or has expired.
*/

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!supabaseConfigured) redirect("/start");

  const auth = await getAuthState();
  if (auth.kind === "none") {
    redirect(
      "/start?mode=forgot&error=" +
        encodeURIComponent("That reset link has expired or already been used. Request a new one.")
    );
  }

  const { error } = await searchParams;

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-md">
          <p className="label text-ink-faint">Almost done</p>
          <h1 className="font-serif-display mt-4 text-3xl sm:text-[2.6rem]">
            Set a new password
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Choose something you haven&rsquo;t used elsewhere. You&rsquo;ll stay signed
            in on this device.
          </p>

          {error && (
            <p className="mt-6 rounded-xl border border-rose-deep/40 bg-paper-raised px-4 py-3 text-sm text-rose-deep">
              {error}
            </p>
          )}

          <form action={updatePasswordAction} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="label text-ink-faint">New password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[0.95rem] outline-none transition focus:border-ink-faint"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label text-ink-faint">Confirm it</span>
              <input
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[0.95rem] outline-none transition focus:border-ink-faint"
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
            >
              Save password
            </button>
          </form>

          <p className="mt-6 text-xs text-ink-faint">
            Changed your mind?{" "}
            <Link href="/studio" className="text-ink underline underline-offset-4">
              Back to your studio
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
