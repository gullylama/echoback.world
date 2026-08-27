import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getThread, inboxWritable } from "@/lib/data";
import { markReadAction, sendMessageAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { timeAgo } from "@/lib/format";
import { roleLabel } from "@/lib/demo/seed";

export const metadata = { title: "Conversation" };

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/start");
  const { threadId } = await params;
  const thread = getThread(user, threadId);
  if (!thread) notFound();
  await markReadAction(threadId);
  const writable = inboxWritable(user);

  return (
    <div className="mx-auto flex max-w-2xl animate-rise flex-col">
      <Link href="/inbox" className="text-sm text-ink-faint transition hover:text-ink">
        ← Inbox
      </Link>

      <header className="mt-5 flex items-center gap-4 border-b border-hairline pb-5">
        <Avatar seed={thread.meta.avatarSeed} size={46} />
        <div>
          <h1 className="font-semibold tracking-tight">
            {thread.meta.otherPartyName}
            <span className="ml-2 text-xs font-normal text-ink-faint">
              {roleLabel(thread.meta.otherPartyRole)}
            </span>
          </h1>
          <p className="text-xs text-ink-faint">re: “{thread.meta.demoTitle}”</p>
        </div>
      </header>

      <div className="flex flex-col gap-4 py-8">
        {thread.messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.mine
                  ? "rounded-br-md bg-ink text-paper"
                  : "rounded-bl-md border border-hairline bg-paper-raised"
              }`}
            >
              <p>{m.body}</p>
              <p className={`mt-1.5 text-[10px] ${m.mine ? "text-paper/60" : "text-ink-faint"}`}>
                {timeAgo(m.sentAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {writable ? (
        <form action={sendMessageAction.bind(null, threadId)} className="flex gap-3 border-t border-hairline pt-5">
          <input
            name="body"
            required
            maxLength={2000}
            placeholder="Write back…"
            autoComplete="off"
            className="flex-1 rounded-full border border-hairline bg-paper-raised px-5 py-3 text-sm outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint"
          />
          <button className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft">
            Send
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-paper-raised p-5">
          <p className="text-sm text-ink-soft">
            Your subscription has lapsed — this thread is read-only until you renew.
          </p>
          <Link
            href="/pricing"
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft"
          >
            Renew
          </Link>
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-ink-faint">
        Take it off-platform whenever you&rsquo;re ready — EchoBack takes no cut of
        what you make together.
      </p>
    </div>
  );
}
