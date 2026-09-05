import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getRequests, getThreads } from "@/lib/data";
import { Avatar } from "@/components/avatar";
import { timeAgo } from "@/lib/format";
import { roleLabel } from "@/lib/demo/seed";
import { RequestCard } from "./request-card";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const user = await currentUser();
  if (!user) redirect("/start");
  const [requests, threads] = await Promise.all([getRequests(user), getThreads(user)]);

  const incoming = requests.filter((r) => r.incoming && r.state === "pending");
  const outgoing = requests.filter((r) => !r.incoming && r.state === "pending");
  const closed = requests.filter((r) => r.state === "declined");

  const empty = requests.length === 0 && threads.length === 0;

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <p className="label text-ink-faint">Inbox</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Requests &amp; conversations</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Anyone who asks to work with you reaches you here — reading, hearing the
        track and answering is always free.
      </p>

      {empty && (
        <div className="mt-12 rounded-2xl border border-dashed border-hairline p-12 text-center">
          <p className="text-sm leading-relaxed text-ink-soft">
            Nothing yet. When someone answers your echo — or asks you to work on
            theirs — it lands here.
          </p>
        </div>
      )}

      {incoming.length > 0 && (
        <Section title={`${incoming.length} waiting on you`}>
          {incoming.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </Section>
      )}

      {threads.length > 0 && (
        <Section title="Conversations">
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
                    <span className="shrink-0 text-xs text-ink-faint">
                      {timeAgo(t.lastMessageAt)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-faint">re: “{t.demoTitle}”</p>
                {t.lastMessage && (
                  <p
                    className={`mt-1 truncate text-sm ${
                      t.unread ? "font-medium text-ink" : "text-ink-soft"
                    }`}
                  >
                    {t.lastMessage}
                  </p>
                )}
              </div>
              {t.unread && <span className="grad-audio size-2 shrink-0 rounded-full" />}
            </Link>
          ))}
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section title="Sent">
          {outgoing.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </Section>
      )}

      {closed.length > 0 && (
        <Section title="Closed">
          {closed.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="label text-ink-faint">{title}</h2>
      <div className="mt-4 flex flex-col gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
        {children}
      </div>
    </section>
  );
}
