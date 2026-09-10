import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import {
  completeProfileAction,
  googleSignInAction,
  requestPasswordResetAction,
  resendConfirmationAction,
  signInAction,
  signUpAction,
} from "@/app/actions";
import { getAuthState } from "@/lib/session";
import { demoMode } from "@/lib/config";
import type { UserRole } from "@/lib/types";

export const metadata = { title: "Join" };

const ROLES: { role: UserRole; title: string; body: string; kicker: string }[] = [
  {
    role: "creator",
    kicker: "Creator",
    title: "I make AI music",
    body: "Upload a track and get a ranked list of the real artists and producers it already sounds like.",
  },
  {
    role: "artist",
    kicker: "Artist",
    title: "I have a voice",
    body: "Upload your voice or catalogue once. Every AI track that echoes it lands in your feed, ranked and ready to triage.",
  },
  {
    role: "producer",
    kicker: "Producer",
    title: "I have a sound",
    body: "Upload your production work. AI tracks that need exactly your sound find you — matched on production, not vocals.",
  },
];

const inputCls =
  "rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[0.95rem] outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string;
    mode?: string;
    error?: string;
    check_email?: string;
    resent?: string;
    sent_reset?: string;
  }>;
}) {
  const auth = await getAuthState();
  if (auth.kind === "authed") redirect("/studio");
  const { role, mode, error, check_email, resent, sent_reset } = await searchParams;

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        {error && (
          <div className="mb-8 rounded-xl border border-rose-deep/40 bg-paper-raised px-4 py-3">
            <p className="text-sm text-rose-deep">{error}</p>
            {/* On the forgot screen the form below already is the way to ask
                for a new link — don't offer a confirmation resend as well. */}
            {!demoMode && mode !== "forgot" && /expired|incomplete/i.test(error) && (
              <form action={resendConfirmationAction} className="mt-3 flex flex-wrap gap-2">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="min-w-0 flex-1 rounded-full border border-hairline bg-paper px-4 py-2 text-sm outline-none focus:border-ink-faint"
                />
                <button className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft">
                  Send a new link
                </button>
              </form>
            )}
          </div>
        )}
        {auth.kind === "needs_profile" ? (
          <Onboarding email={auth.email} suggestedName={auth.suggestedName} role={role} />
        ) : sent_reset ? (
          <ResetSent email={sent_reset} />
        ) : check_email ? (
          <CheckEmail email={check_email} resent={Boolean(resent)} />
        ) : mode === "forgot" ? (
          <Forgot />
        ) : mode === "signin" ? (
          <SignIn />
        ) : (
          <SignUp role={role} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

/* ---- sign up ---------------------------------------------------------- */

function SignUp({ role }: { role?: string }) {
  const chosen = ROLES.find((r) => r.role === role);

  if (!chosen) {
    return (
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
          Uploading is free for everyone. You only ever pay to reveal matches.{" "}
          <Link href="/start?mode=signin" className="text-ink underline underline-offset-4">
            Already a member? Sign in
          </Link>
        </p>
      </>
    );
  }

  return (
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
            className={inputCls}
          />
        </label>
        {!demoMode && (
          <>
            <label className="flex flex-col gap-2">
              <span className="label text-ink-faint">Email</span>
              <input name="email" type="email" required placeholder="you@example.com" className={inputCls} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="label text-ink-faint">Password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className={inputCls}
              />
            </label>
          </>
        )}
        <button
          type="submit"
          className="mt-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
        >
          {demoMode ? "Enter EchoBack" : "Create account"}
        </button>
      </form>

      {!demoMode && (
        <div className="mt-6 max-w-md">
          <OrDivider />
          <GoogleButton />
          <p className="mt-6 text-xs text-ink-faint">
            Already a member?{" "}
            <Link href="/start?mode=signin" className="text-ink underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      )}

      {demoMode && (
        <p className="mt-6 max-w-md text-xs leading-relaxed text-ink-faint">
          Running in demo mode — no email needed, and the library is seeded so you can
          feel the full loop. With Supabase configured this becomes real email and
          Google sign-in.
        </p>
      )}
    </>
  );
}

/* ---- sign in ---------------------------------------------------------- */

function SignIn() {
  return (
    <div className="mx-auto max-w-md">
      <p className="label text-ink-faint">Welcome back</p>
      <h1 className="font-serif-display mt-4 text-3xl sm:text-[2.6rem]">Sign in</h1>
      {demoMode ? (
        <p className="mt-6 text-sm leading-relaxed text-ink-soft">
          Demo mode has no stored accounts —{" "}
          <Link href="/start" className="text-ink underline underline-offset-4">
            create a session
          </Link>{" "}
          instead.
        </p>
      ) : (
        <>
          <form action={signInAction} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="label text-ink-faint">Email</span>
              <input name="email" type="email" required placeholder="you@example.com" className={inputCls} />
            </label>
            <label className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="label text-ink-faint">Password</span>
                <Link
                  href="/start?mode=forgot"
                  className="text-xs text-ink-faint underline underline-offset-4 transition hover:text-ink"
                >
                  Forgot it?
                </Link>
              </div>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className={inputCls}
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
            >
              Sign in
            </button>
          </form>
          <div className="mt-6">
            <OrDivider />
            <GoogleButton />
          </div>
          <p className="mt-6 text-xs text-ink-faint">
            New here?{" "}
            <Link href="/start" className="text-ink underline underline-offset-4">
              Create an account
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

/* ---- OAuth onboarding ------------------------------------------------- */

function Onboarding({
  email,
  suggestedName,
  role,
}: {
  email: string;
  suggestedName: string;
  role?: string;
}) {
  const chosen = ROLES.find((r) => r.role === role);
  return (
    <div className="mx-auto max-w-xl">
      <p className="label text-ink-faint">Almost there</p>
      <h1 className="font-serif-display mt-4 text-3xl sm:text-[2.6rem]">
        Which side of the echo are you?
      </h1>
      <p className="mt-3 text-sm text-ink-faint">Signed in as {email}</p>

      {!chosen ? (
        <div className="mt-10 flex flex-col gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
          {ROLES.map((r) => (
            <Link
              key={r.role}
              href={`/start?role=${r.role}`}
              className="group flex items-center justify-between gap-6 bg-paper-raised p-6 transition hover:bg-paper"
            >
              <div>
                <p className="label text-ink-faint">{r.kicker}</p>
                <p className="mt-1.5 text-lg font-semibold tracking-tight">{r.title}</p>
              </div>
              <span className="text-2xl text-ink-faint transition group-hover:translate-x-1 group-hover:text-ink">
                →
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <form action={completeProfileAction} className="mt-10 flex max-w-md flex-col gap-4">
          <input type="hidden" name="role" value={chosen.role} />
          <p className="text-sm text-ink-soft">
            Joining as <strong className="text-ink">{chosen.kicker}</strong> —{" "}
            <Link href="/start" className="underline underline-offset-4">
              change
            </Link>
          </p>
          <label className="flex flex-col gap-2">
            <span className="label text-ink-faint">
              {chosen.role === "creator" ? "Your name or alias" : "Artist / producer name"}
            </span>
            <input name="name" required maxLength={60} defaultValue={suggestedName} className={inputCls} />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
          >
            Enter EchoBack
          </button>
        </form>
      )}
    </div>
  );
}

/* ---- password reset ---------------------------------------------------- */

function Forgot() {
  return (
    <div className="mx-auto max-w-md">
      <p className="label text-ink-faint">Locked out</p>
      <h1 className="font-serif-display mt-4 text-3xl sm:text-[2.6rem]">
        Reset your password
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        Enter the address you signed up with and we&rsquo;ll send you a link to
        set a new one.
      </p>
      {demoMode ? (
        <p className="mt-6 text-sm leading-relaxed text-ink-soft">
          Demo mode has no stored accounts, so there is no password to reset —{" "}
          <Link href="/start" className="text-ink underline underline-offset-4">
            create a session
          </Link>{" "}
          instead.
        </p>
      ) : (
      <form action={requestPasswordResetAction} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="label text-ink-faint">Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className={inputCls}
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
        >
          Send the link
        </button>
      </form>
      )}
      <p className="mt-6 text-xs text-ink-faint">
        Remembered it?{" "}
        <Link href="/start?mode=signin" className="text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function ResetSent({ email }: { email: string }) {
  return (
    <div className="mx-auto max-w-md text-center">
      <p className="label text-ink-faint">Check your inbox</p>
      <h1 className="font-serif-display mt-4 text-3xl">On its way</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        If <strong className="text-ink">{email}</strong> has an EchoBack account,
        a reset link is on its way. It may take a minute, and it may be in spam.
      </p>
      <p className="mt-6 text-xs text-ink-faint">
        <Link href="/start?mode=signin" className="text-ink underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

/* ---- bits -------------------------------------------------------------- */

function CheckEmail({ email, resent }: { email: string; resent: boolean }) {
  return (
    <div className="mx-auto max-w-md text-center">
      <p className="label text-ink-faint">One more step</p>
      <h1 className="font-serif-display mt-4 text-3xl">Check your inbox</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        We&rsquo;ve sent a confirmation link to <strong className="text-ink">{email}</strong>.
        Open it and you&rsquo;ll land straight in your studio. It can take a minute
        to arrive, and it may be in spam.
      </p>
      {resent && (
        <p className="mt-4 text-sm text-ink-soft">Sent again just now.</p>
      )}
      <form action={resendConfirmationAction} className="mt-8">
        <input type="hidden" name="email" value={email} />
        <button className="rounded-full border border-hairline bg-paper-raised px-5 py-2.5 text-sm transition hover:border-ink-faint">
          Send it again
        </button>
      </form>
      <p className="mt-6 text-xs text-ink-faint">
        Wrong address?{" "}
        <Link href="/start" className="text-ink underline underline-offset-4">
          Start over
        </Link>
      </p>
    </div>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-4">
      <span className="h-px flex-1 bg-hairline" />
      <span className="text-xs text-ink-faint">or</span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}

function GoogleButton() {
  return (
    <form action={googleSignInAction} className="mt-6">
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-3 rounded-full border border-hairline bg-paper-raised px-6 py-3 text-sm font-medium transition hover:border-ink-faint"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
        </svg>
        Continue with Google
      </button>
    </form>
  );
}
