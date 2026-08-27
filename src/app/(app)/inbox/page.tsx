import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getThreads } from "@/lib/data";
import { Avatar } from "@/components/avatar";
import { timeAgo } from "@/lib/format";
import { roleLabel } from "@/lib/demo/seed";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const user = await currentUser();
  if (!user) redirect("/start");
  const threads = await getThreads(user);

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <p className="label text-ink-faint">Inbox</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Conversations</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        A thread only opens when interest is mutual — every conversation here is one
        both sides chose.
      </p>

      {threads.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-hairline p-12 text-center">
          <p className="text-sm leading-relaxed text-ink-soft">
            No mutual interest yet. When someone answers your echo, the thread opens
            here.
          </p>
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/inbox/${t.id}`}
              className="flex items-center gap-4 bg-paper-raised p-5 transition hover:bg-paper"
            >
              <Avatar seed={t.avatarSeed} size={46} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-semibold tracking-tight">
                    {t.otherPartyName}
                    <span className="ml-2 text-xs font-normal text-ink-faint">
                      {roleLabel(t.otherPartyRole)}
                    </span>
                  </p>
                  {t.lastMessageAt && (
                    <span className="shrink-0 text-xs text-ink-faint">{timeAgo(t.lastMessageAt)}</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-faint">re: “{t.demoTitle}”</p>
                {t.lastMessage && (
                  <p className={`mt-1 truncate text-sm ${t.unread ? "font-medium text-ink" : "text-ink-soft"}`}>
                    {t.lastMessage}
                  </p>
                )}
              </div>
              {t.unread && <span className="grad-audio size-2 shrink-0 rounded-full" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
