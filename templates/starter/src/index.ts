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
  /** Set at deploy, or with `npx wrangler secret put WIDGET_TOKEN`. */
  WIDGET_TOKEN?: string;
}

const PLACEHOLDER = "replace-with-a-long-random-string";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.WIDGET_TOKEN || env.WIDGET_TOKEN === PLACEHOLDER) {
      return new Response("Set WIDGET_TOKEN to a secret of your own: npx wrangler secret put WIDGET_TOKEN\n", {
        status: 500,
      });
    }
    if (!(await authorized(request, env.WIDGET_TOKEN))) {
      return new Response("Unauthorized\n", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
    }
    return Response.json(payload(readRequest(request), new Date()), {
      // The app decides when to fetch again, from `refresh`. A cache in between would only
      // hand it something older.
      headers: { "Cache-Control": "no-store" },
    });
  },
};

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
    // Seconds until the app fetches again; iOS may stretch it. The timer and the day's
    // progress keep moving on the phone in between, so they never go stale.
    refresh: 900,
    accessibility: `${day.greeting}. ${day.date}.`,
    // Where a tap goes. Point it at your own dashboard.
    url: "https://webhookwidget.com/docs/",
    view: view(widget, day, now),
  };
}

/** One layout per slot, rather than one layout squeezed into every slot. */
function view(widget: WidgetRequest, day: Day, now: Date): Node {
  switch (widget.family) {
    case "accessoryInline":
      return { type: "text", text: `${day.greeting} · ${day.shortDate}` };
    case "accessoryCircular":
      return dayRing(day, { type: "symbol", name: "bolt.fill", size: 14, accentable: true });
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
      return summary(day, now);
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
 * The day so far. A gauge with `from` and `until` is drawn by the system and keeps moving by
 * itself between fetches; it has no `center` of its own, so the label sits over it in a
 * `zstack`. A ring is as big as the room it is given, so both fill: up to 120 pt across
 * beside the summary, and the whole slot on the Lock Screen.
 */
function dayRing(day: Day, label: Node = { type: "text", text: "today", style: "caption2", color: "secondary" }): Node {
  return {
    type: "zstack",
    w: "fill",
    h: "fill",
    maxW: 120,
    children: [
      { type: "gauge", style: "ring", from: day.start, until: day.end, tint: "orange", accentable: true, w: "fill", h: "fill" },
      label,
    ],
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
  date: string;
  shortDate: string;
  start: Date;
  end: Date;
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
  const start = new Date(now.getTime() - ((hour * 60 + minute) * 60 + second) * 1000 - now.getMilliseconds());
  return {
    greeting: hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    date: format({ weekday: "long", day: "numeric", month: "long" }),
    shortDate: format({ weekday: "short", day: "numeric", month: "short" }),
    start,
    // A day the clocks change is an hour longer or shorter; for a progress ring, close enough.
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
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
