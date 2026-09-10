/*
  Transactional email via Resend.

  Every send is best-effort: if the key is missing, the request fails, or the
  API is slow, the user's action still succeeds. Notification email must
  never be able to break the thing it is notifying about.
*/

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 5000;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echoback.world";
const FROM = process.env.RESEND_FROM ?? "EchoBack <hello@echoback.world>";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(heading: string, body: string, cta: { label: string; href: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#eef2f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#141719">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f1;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#f7faf9;border:1px solid #d5dedc;border-radius:16px;padding:32px">
        <tr><td>
          <p style="margin:0 0 24px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#82908e">EchoBack</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600">${heading}</h1>
          <div style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#46504f">${body}</div>
          <a href="${cta.href}" style="display:inline-block;background:#141719;color:#f7faf9;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:500">${cta.label}</a>
          <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#82908e">
            You're getting this because someone contacted you on EchoBack.
            <a href="${SITE}/account" style="color:#46504f">Turn these off</a> any time.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[email] Resend rejected the send", res.status, await res.text());
    }
  } catch (err) {
    console.error("[email] send failed", err);
  } finally {
    clearTimeout(timer);
  }
}

export async function notifyRequestReceived(
  to: string,
  opts: { senderName: string; trackTitle: string; note: string | null }
): Promise<void> {
  const note = opts.note
    ? `<blockquote style="margin:16px 0;padding-left:14px;border-left:2px solid #d5dedc;color:#46504f">${escapeHtml(opts.note)}</blockquote>`
    : "";
  await send(
    to,
    `${opts.senderName} wants to work with you`,
    layout(
      `${escapeHtml(opts.senderName)} asked to work with you`,
      `<p style="margin:0 0 12px">They matched their track <strong>&ldquo;${escapeHtml(opts.trackTitle)}&rdquo;</strong> to your sound.</p>
       ${note}
       <p style="margin:12px 0 0">Hearing the track and answering is free — you don't need a subscription.</p>`,
      { label: "Listen and reply", href: `${SITE}/inbox` }
    )
  );
}

export async function notifyRequestAccepted(
  to: string,
  opts: { recipientName: string; trackTitle: string; threadId: string }
): Promise<void> {
  await send(
    to,
    `${opts.recipientName} said yes`,
    layout(
      `${escapeHtml(opts.recipientName)} said yes`,
      `<p style="margin:0">They accepted your request on <strong>&ldquo;${escapeHtml(opts.trackTitle)}&rdquo;</strong>. The conversation is open.</p>`,
      { label: "Open the conversation", href: `${SITE}/inbox/${opts.threadId}` }
    )
  );
}

export async function notifyNewMessage(
  to: string,
  opts: { senderName: string; preview: string; threadId: string }
): Promise<void> {
  const preview = opts.preview.length > 180 ? `${opts.preview.slice(0, 180)}…` : opts.preview;
  await send(
    to,
    `${opts.senderName} replied`,
    layout(
      `${escapeHtml(opts.senderName)} replied`,
      `<blockquote style="margin:0;padding-left:14px;border-left:2px solid #d5dedc;color:#46504f">${escapeHtml(preview)}</blockquote>`,
      { label: "Read and reply", href: `${SITE}/inbox/${opts.threadId}` }
    )
  );
}
