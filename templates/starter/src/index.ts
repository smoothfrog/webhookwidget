/**
 * A Webhook Widget endpoint on Cloudflare Workers.
 *
 * The app fetches this URL for every widget it shows, telling it the widget's size and the
 * phone's locale and time zone, and draws the JSON that comes back. This one greets you and
 * shows how far through the day you are; replace `payload()` with your own data.
 *
 * The format: https://webhookwidget.com/docs/schema/
 * Preview what this returns: npm run dev, then
 *   npx webhookwidget preview http://localhost:8787/ --auth bearer --secret-env WIDGET_TOKEN --open
 */
import { readRequest, type Node, type Payload, type WidgetRequest } from "webhookwidget";

interface Env {
  /**
   * Bearer token checked on every request. Set at deploy, in Worker -> Settings -> Variables and
   * Secrets -> Edit secret "WIDGET_TOKEN", or with `npx wrangler secret put WIDGET_TOKEN`.
   * Defaults to "foobar" when unset so a fresh deploy works straight away.
   */
  WIDGET_TOKEN?: string;
}

const DEFAULT_TOKEN = "foobar";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const configured = env.WIDGET_TOKEN?.trim();
    const token = configured && configured.length > 0 ? configured : DEFAULT_TOKEN;
    const usingDefaultToken = token === DEFAULT_TOKEN;

    if (!(await authorized(request, token))) {
      return unauthorizedResponse(request, usingDefaultToken);
    }
    return Response.json(payload(readRequest(request), new Date()), {
      // The app decides when to fetch again, from `refresh`. A cache in between would only
      // hand it something older.
      headers: { "Cache-Control": "no-store" },
    });
  },
};

/**
 * Answers unauthenticated requests with setup instructions: a readable landing page in a
 * browser, or a plain-text hint for curl and the app's Response Details view. Never reveals
 * a custom WIDGET_TOKEN — only mentions the built-in default when it has not been changed.
 */
function unauthorizedResponse(request: Request, usingDefaultToken: boolean): Response {
  const endpoint = new URL("/", request.url).toString();
  const acceptsHtml = (request.headers.get("Accept") ?? "").includes("text/html");
  if (acceptsHtml) {
    return new Response(setupPage(endpoint, usingDefaultToken), {
      status: 401,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "WWW-Authenticate": "Bearer",
        "Cache-Control": "no-store",
      },
    });
  }
  const message = usingDefaultToken
    ? `Unauthorized: send "Authorization: Bearer ${DEFAULT_TOKEN}" (the default WIDGET_TOKEN).\n` +
      `In Webhook Widget, set Authentication to "Bearer token" and Token to "${DEFAULT_TOKEN}".\n` +
      `Change it in Cloudflare Dashboard: Worker -> Settings -> Variables and Secrets -> Edit secret "WIDGET_TOKEN".\n`
    : `Unauthorized: send "Authorization: Bearer <WIDGET_TOKEN>".\n` +
      `In Webhook Widget, set Authentication to "Bearer token" and enter your WIDGET_TOKEN.\n`;
  return new Response(message, {
    status: 401,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": "Bearer",
      "Cache-Control": "no-store",
    },
  });
}

function setupPage(endpoint: string, usingDefaultToken: boolean): string {
  const escapedUrl = escapeHtml(endpoint);
  const qrCommand = usingDefaultToken
    ? `WIDGET_TOKEN=${DEFAULT_TOKEN} npx webhookwidget qr --name "My widget" --url ${endpoint} --auth bearer --secret-env WIDGET_TOKEN`
    : `read -rs WIDGET_TOKEN && export WIDGET_TOKEN\nnpx webhookwidget qr --name "My widget" --url ${endpoint} --auth bearer --secret-env WIDGET_TOKEN`;
  const deepLink = usingDefaultToken
    ? `webhookwidget://register?name=${encodeURIComponent("My widget")}&url=${encodeURIComponent(endpoint)}&auth=bearer&secret=${encodeURIComponent(DEFAULT_TOKEN)}`
    : null;
  const tokenRow = usingDefaultToken
    ? `<code>${DEFAULT_TOKEN}</code> <span class="muted">(default)</span>`
    : `<span class="muted">The <code>WIDGET_TOKEN</code> you set when deploying</span>`;
  const banner = usingDefaultToken
    ? `<div class="callout warn">
        <strong>Using the default Bearer token: <code>${DEFAULT_TOKEN}</code></strong>
        <p>You can connect your iPhone straight away using <code>${DEFAULT_TOKEN}</code>. Before showing private data, harden it by changing <code>WIDGET_TOKEN</code> to a long random string (treat it like a password) in the Cloudflare dashboard under <strong>Worker &rarr; Settings &rarr; Variables and Secrets &rarr; Edit secret <code>WIDGET_TOKEN</code></strong> (or with <code>npx wrangler secret put WIDGET_TOKEN</code>).</p>
      </div>`
    : `<div class="callout">
        <strong>Protected by your <code>WIDGET_TOKEN</code></strong>
        <p>This endpoint requires Bearer authentication. You can rotate the secret anytime in the Cloudflare dashboard under <strong>Worker &rarr; Settings &rarr; Variables and Secrets &rarr; Edit secret <code>WIDGET_TOKEN</code></strong>.</p>
      </div>`;
  const openButton = deepLink
    ? `<p class="actions"><a class="button" href="${escapeHtml(deepLink)}">Open in Webhook Widget (iPhone)</a></p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Webhook Widget endpoint</title>
  <style>
    :root { color-scheme: light dark; }
    body { font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 680px; margin: 2.5rem auto; padding: 0 1.25rem; }
    h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
    h2 { font-size: 1.05rem; margin: 1.75rem 0 0.5rem; }
    p { margin: 0.5rem 0; }
    .muted { opacity: 0.7; }
    .callout { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 12px; padding: 0.9rem 1rem; margin: 1.25rem 0; }
    .callout.warn { border-color: #f59e0b; background: color-mix(in srgb, #f59e0b 12%, transparent); }
    .callout p { margin-bottom: 0; font-size: 0.95rem; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.4rem 1rem; margin: 0.75rem 0; }
    dt { font-weight: 600; }
    dd { margin: 0; overflow-wrap: anywhere; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
    pre { overflow-x: auto; padding: 0.85rem 1rem; border-radius: 10px; background: color-mix(in srgb, currentColor 8%, transparent); }
    .actions { margin: 1.25rem 0; }
    .button { display: inline-block; padding: 0.6rem 1rem; border-radius: 10px; background: #f97316; color: #fff; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Your Webhook Widget endpoint is live</h1>
  <p class="muted">This URL returns widget JSON for the <a href="https://webhookwidget.com">Webhook Widget</a> iPhone app when called with Bearer authentication.</p>
  ${banner}
  ${openButton}
  <h2>Add it on your iPhone</h2>
  <p>Open <strong>Webhook Widget</strong>, tap <strong>Add Hook</strong>, and enter:</p>
  <dl>
    <dt>URL</dt><dd><code>${escapedUrl}</code></dd>
    <dt>Authentication</dt><dd><code>Bearer token</code></dd>
    <dt>Token</dt><dd>${tokenRow}</dd>
  </dl>
  <h2>Or scan a QR code from your terminal</h2>
  <pre><code>${escapeHtml(qrCommand)}</code></pre>
  <h2>Next steps</h2>
  <p>Edit <code>payload()</code> in <code>src/index.ts</code> to show your own data, then deploy. See the <a href="https://webhookwidget.com/docs/quickstart/">quickstart</a> and <a href="https://webhookwidget.com/docs/schema/">node reference</a>.</p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * The app sends `Authorization: Bearer <token>` with every request. Both sides are hashed
 * and compared in full, so how long the check takes says nothing about the token.
 */
async function authorized(request: Request, token: string): Promise<boolean> {
  const [sent, expected] = await Promise.all([
    digest(request.headers.get("Authorization") ?? ""),
    digest(`Bearer ${token}`),
  ]);
  let difference = 0;
  for (let i = 0; i < sent.length; i++) difference |= sent[i] ^ expected[i];
  return difference === 0;
}

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

function payload(widget: WidgetRequest, now: Date): Payload {
  const day = today(widget, now);
  return {
    v: 1,
    // Seconds until the app fetches again; iOS may stretch it. The timer keeps moving on the
    // phone in between, and a 15-minute refresh keeps the day's progress within 1%.
    refresh: 900,
    accessibility: `${day.greeting}. ${day.date}. ${day.percent}% through today.`,
    // Where a tap goes. Point it at your own dashboard.
    url: "https://webhookwidget.com/docs/quickstart/",
    view: view(widget, day, now),
  };
}

/** One layout per slot, rather than one layout squeezed into every slot. */
function view(widget: WidgetRequest, day: Day, now: Date): Node {
  switch (widget.family) {
    case "accessoryInline":
      return { type: "text", text: `${day.shortGreeting} · ${day.shortDate}` };
    case "accessoryCircular":
      return dayRing(day, { type: "symbol", name: "bolt.fill", size: 14, accentable: true }, 5);
    case "accessoryRectangular":
      return {
        type: "vstack",
        align: "leading",
        spacing: 1,
        children: [
          { type: "text", text: day.greeting, style: "headline", accentable: true, lines: 1 },
          { type: "text", text: day.shortDate, style: "caption", lines: 1 },
          { type: "timer", from: now, style: "relative", font: "caption" },
        ],
      };
    case "systemSmall":
      return compactSummary(day);
    case "systemLarge":
      return {
        type: "vstack",
        align: "leading",
        spacing: 12,
        padding: 16,
        children: [
          { type: "hstack", spacing: 12, h: 132, children: [summary(day, now, 0), dayRing(day)] },
          { type: "divider" },
          request(widget),
          { type: "spacer" },
        ],
      };
    default:
      // Medium, and anything a newer app asks for that this doesn't know yet.
      return { type: "hstack", spacing: 12, padding: 16, children: [summary(day, now, 0), dayRing(day)] };
  }
}

/** Tailored for the small slot: shorter copy and a bar gauge so nothing truncates. */
function compactSummary(day: Day): Node {
  return {
    type: "vstack",
    align: "leading",
    spacing: 0,
    padding: 16,
    w: "fill",
    h: "fill",
    children: [
      {
        type: "hstack",
        spacing: 5,
        children: [
          { type: "symbol", name: "bolt.fill", style: "caption2", weight: "bold", color: "orange" },
          { type: "text", text: "MY WIDGET", style: "caption2", weight: "bold", color: "secondary" },
        ],
      },
      { type: "spacer" },
      { type: "text", text: day.shortGreeting, style: "title3", weight: "bold", design: "rounded", lines: 1 },
      { type: "text", text: day.shortDate, style: "footnote", color: "secondary", lines: 1 },
      { type: "spacer" },
      {
        type: "gauge",
        style: "bar",
        value: day.progress,
        tint: "orange",
        accentable: true,
        label: `${day.percent}% of today`,
      },
    ],
  };
}

function summary(day: Day, now: Date, padding = 16): Node {
  return {
    type: "vstack",
    align: "leading",
    spacing: 0,
    padding,
    w: "fill",
    h: "fill",
    children: [
      {
        type: "hstack",
        spacing: 5,
        children: [
          { type: "symbol", name: "bolt.fill", style: "caption2", weight: "bold", color: "orange" },
          { type: "text", text: "MY WIDGET", style: "caption2", weight: "bold", color: "secondary" },
        ],
      },
      { type: "spacer" },
      { type: "text", text: day.greeting, style: "title3", weight: "bold", design: "rounded", lines: 2 },
      { type: "text", text: day.date, style: "footnote", color: "secondary", lines: 1 },
      { type: "spacer" },
      {
        type: "hstack",
        spacing: 4,
        children: [
          { type: "text", text: "UPDATED", style: "caption2", weight: "semibold", color: "tertiary" },
          // Counted on the phone from when this response was built.
          { type: "timer", from: now, style: "relative", font: "caption2", color: "tertiary" },
        ],
      },
    ],
  };
}

/**
 * The day so far as a ring gauge. Uses `value` (0..1) rather than a live `from`/`until` range
 * so it draws identically in both the Home Screen widget and the app's Preview, and supports a
 * centered label directly.
 */
function dayRing(day: Day, center?: Node, thickness = 7): Node {
  const defaultCenter: Node = {
    type: "vstack",
    spacing: 0,
    children: [
      { type: "text", text: `${day.percent}%`, style: "title3", weight: "bold", design: "rounded", monoDigits: true, lines: 1 },
      { type: "text", text: "today", style: "caption2", color: "secondary", lines: 1 },
    ],
  };
  return {
    type: "gauge",
    style: "ring",
    value: day.progress,
    tint: "orange",
    thickness,
    accentable: true,
    w: "fill",
    h: "fill",
    maxW: 120,
    center: center ?? defaultCenter,
  };
}

/** What the app sent with this request: the values to branch on. */
function request(widget: WidgetRequest): Node {
  const size = widget.width && widget.height ? `${widget.width} × ${widget.height} pt @${widget.scale ?? 1}x` : "—";
  return {
    type: "vstack",
    align: "leading",
    spacing: 6,
    children: [
      { type: "text", text: "WHAT YOUR PHONE SENT", style: "caption2", weight: "semibold", color: "tertiary" },
      {
        type: "grid",
        columns: [{ text: { color: "secondary" } }, { w: "fill" }],
        rowSpacing: 3,
        text: { style: "footnote", lines: 1 },
        rows: [
          ["Family", widget.family ?? "—"],
          ["Slot", size],
          ["Appearance", widget.scheme ?? "—"],
          ["Locale", widget.locale ?? "—"],
          ["Time zone", widget.timeZone ?? "—"],
        ],
      },
    ],
  };
}

interface Day {
  greeting: string;
  shortGreeting: string;
  date: string;
  shortDate: string;
  /** Fraction of today elapsed in the phone's time zone (0..1). */
  progress: number;
  /** Whole percentage of today elapsed (0..100). */
  percent: number;
}

/** Today, in the phone's time zone and language rather than the Worker's. */
function today(widget: WidgetRequest, now: Date): Day {
  // Anything the runtime doesn't know (or a request from a browser, which sends neither)
  // falls back to UTC and British English.
  const zone = widget.timeZone;
  const timeZone = zone && supported(() => new Intl.DateTimeFormat("en-GB", { timeZone: zone })) ? zone : "UTC";
  const locale = widget.locale?.replace("_", "-");
  const language = locale && supported(() => new Intl.DateTimeFormat(locale)) ? locale : "en-GB";
  const format = (options: Intl.DateTimeFormatOptions, inLanguage = language) =>
    new Intl.DateTimeFormat(inLanguage, { timeZone, ...options }).format(now);

  // Read in a fixed language, since not every language writes its digits 0–9.
  const [hour, minute, second] = format({ hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }, "en-GB")
    .split(":")
    .map(Number);
  const progress = Math.min(Math.max(((hour * 60 + minute) * 60 + second) / 86_400, 0), 1);
  return {
    greeting: hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    shortGreeting: hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening",
    date: format({ weekday: "long", day: "numeric", month: "long" }),
    shortDate: format({ weekday: "short", day: "numeric", month: "short" }),
    progress,
    percent: Math.round(progress * 100),
  };
}

function supported(make: () => unknown): boolean {
  try {
    make();
    return true;
  } catch {
    return false;
  }
}
