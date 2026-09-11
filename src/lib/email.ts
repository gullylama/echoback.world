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

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/*
  One shell for every email EchoBack sends.

  Deliberately the same design as the Supabase auth templates in
  supabase/email-templates/ — a confirmation and a notification should not
  look like they came from two different companies. Table layout and inline
  styles because email clients are not browsers; no web fonts, no images,
  no gradient (that stays reserved for audio, as everywhere else), so
  nothing depends on remote loading or "show images".
*/
function layout(opts: {
  preheader: string;
  heading: string;
  body: string;
  cta: { label: string; href: string };
  footnote?: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#eef2f1;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;color:#eef2f1;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef2f1" style="background-color:#eef2f1;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

<tr><td align="left" style="padding:0 4px 20px;">
<span style="font-family:${SANS};font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#141719;">echo</span><span style="font-family:${SANS};font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#82908e;">back</span>
</td></tr>

<tr><td bgcolor="#f7faf9" style="background-color:#f7faf9;border:1px solid #d5dedc;border-radius:16px;padding:36px 34px;">

<h1 style="margin:0 0 14px;font-family:${SANS};font-size:23px;line-height:1.3;font-weight:600;letter-spacing:-0.02em;color:#141719;">${opts.heading}</h1>

<div style="margin:0 0 28px;font-family:${SANS};font-size:15px;line-height:1.65;color:#46504f;">${opts.body}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr><td bgcolor="#141719" style="background-color:#141719;border-radius:999px;">
<a href="${opts.cta.href}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:15px;font-weight:500;line-height:1;color:#f7faf9;text-decoration:none;border-radius:999px;">${opts.cta.label}</a>
</td></tr>
</table>

${opts.footnote
  ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
<tr><td height="1" bgcolor="#e3eae8" style="background-color:#e3eae8;line-height:1px;font-size:0;">&nbsp;</td></tr>
</table>
<p style="margin:20px 0 0;font-family:${SANS};font-size:13px;line-height:1.65;color:#82908e;">${opts.footnote}</p>`
  : ""}

</td></tr>

<tr><td align="left" style="padding:22px 4px 0;">
<p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.7;color:#82908e;">
You&rsquo;re getting this because someone contacted you on EchoBack.
<a href="${SITE}/account" style="color:#82908e;text-decoration:underline;">Turn these off</a> any time.<br>
<a href="${SITE}" style="color:#82908e;text-decoration:underline;">echoback.world</a>
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
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
  const name = escapeHtml(opts.senderName);
  const title = escapeHtml(opts.trackTitle);
  const note = opts.note
    ? `<blockquote style="margin:16px 0;padding:2px 0 2px 14px;border-left:2px solid #d5dedc;color:#46504f;">${escapeHtml(opts.note)}</blockquote>`
    : "";
  await send(
    to,
    `${opts.senderName} wants to work with you`,
    layout({
      preheader: `${opts.senderName} matched "${opts.trackTitle}" to your sound.`,
      heading: `${name} asked to work with you`,
      body: `<p style="margin:0 0 12px;">They matched their track <strong style="color:#141719;">&ldquo;${title}&rdquo;</strong> to your sound.</p>${note}<p style="margin:12px 0 0;">Hearing the track and answering is free &mdash; you don&rsquo;t need a subscription.</p>`,
      cta: { label: "Listen and reply", href: `${SITE}/inbox` },
    })
  );
}

export async function notifyRequestAccepted(
  to: string,
  opts: { recipientName: string; trackTitle: string; threadId: string }
): Promise<void> {
  const name = escapeHtml(opts.recipientName);
  const title = escapeHtml(opts.trackTitle);
  await send(
    to,
    `${opts.recipientName} said yes`,
    layout({
      preheader: `Your request on "${opts.trackTitle}" was accepted.`,
      heading: `${name} said yes`,
      body: `<p style="margin:0;">They accepted your request on <strong style="color:#141719;">&ldquo;${title}&rdquo;</strong>. The conversation is open.</p>`,
      cta: { label: "Open the conversation", href: `${SITE}/inbox/${opts.threadId}` },
    })
  );
}

export async function notifyNewMessage(
  to: string,
  opts: { senderName: string; preview: string; threadId: string }
): Promise<void> {
  const preview = opts.preview.length > 180 ? `${opts.preview.slice(0, 180)}\u2026` : opts.preview;
  const name = escapeHtml(opts.senderName);
  await send(
    to,
    `${opts.senderName} replied`,
    layout({
      preheader: preview,
      heading: `${name} replied`,
      body: `<blockquote style="margin:0;padding:2px 0 2px 14px;border-left:2px solid #d5dedc;color:#46504f;">${escapeHtml(preview)}</blockquote>`,
      cta: { label: "Read and reply", href: `${SITE}/inbox/${opts.threadId}` },
    })
  );
}
