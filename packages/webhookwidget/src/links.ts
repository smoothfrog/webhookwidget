import type { Payload } from "./payload.js";

/** How the app authenticates its requests to the hook. */
export type HookAuth =
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "header"; name: string; value: string };

export interface Hook {
  /** What the widget is called in the app. */
  name: string;
  /**
   * The endpoint, which must be `https`. A credential already in it — `?key=…` or
   * `https://user:pass@host/` — needs no `auth`, and makes the shortest code.
   */
  url: string;
  auth?: HookAuth;
}

/**
 * The setup link for a hook: `webhookwidget://register?…`. Scanned or tapped, it opens the
 * app's hook editor with every field filled in, and nothing is saved until the person taps
 * Save. Draw it as a QR code to get a hook onto a phone without typing a URL or a token.
 *
 * **The link carries the secret**, which is the point of it. Treat it as the credential:
 * keep it out of transcripts, issues, commits and logs.
 *
 * Only the fields in use are written, because a QR code's density follows its length. Every
 * value is percent-encoded, so an `&` or `#` in a token, or the address's own query string,
 * can't run into the link's.
 */
export function registerLink(hook: Hook): string {
  if (!hook.name.trim()) throw new TypeError("A hook needs a name.");
  let address: URL;
  try {
    address = new URL(hook.url);
  } catch {
    throw new TypeError(`Not a URL: ${hook.url}`);
  }
  if (address.protocol !== "https:") {
    throw new TypeError(`The app only fetches https addresses, not ${address.protocol.replace(/:$/, "")}.`);
  }

  const pairs: [string, string][] = [["name", hook.name], ["url", hook.url]];
  const auth = hook.auth;
  if (auth?.type === "bearer") {
    pairs.push(["auth", "bearer"], ["secret", auth.token]);
  } else if (auth?.type === "basic") {
    pairs.push(["auth", "basic"], ["username", auth.username], ["secret", auth.password]);
  } else if (auth?.type === "header") {
    pairs.push(["auth", "header"], ["header", auth.name], ["secret", auth.value]);
  }
  const query = pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  return `webhookwidget://register?${query}`;
}

/** Home Screen sizes the playground draws. */
export type PreviewFamily = "small" | "medium" | "large";

export interface PreviewOptions {
  /** `medium` unless set. */
  family?: PreviewFamily | "systemSmall" | "systemMedium" | "systemLarge";
  /** `dark` unless set. */
  scheme?: "light" | "dark";
  /** Another screen size, such as `iphone-430x932`. The playground lists them. */
  device?: string;
  /** Which entry of a timeline to draw, from 0. */
  entry?: number;
  /**
   * The widget alone on a wallpaper, for a screenshot: no editor and no page around it. The
   * page's title becomes `preview-ready` (or `preview-error`) once it has drawn.
   */
  headless?: boolean;
  /** Stops timers moving, so two captures can be compared. */
  freeze?: boolean;
  /** Pins a headless widget to the top-left corner, so a crop starts at (0, 0). */
  align?: "start";
  /** `https://webhookwidget.com` unless set. */
  origin?: string;
}

/**
 * A playground link that draws `payload` with the same engine the app runs. Without
 * `headless` it opens in the editor, which is the link to give a person; with it, the page is
 * a render target for a screenshot.
 *
 * Everything goes in the fragment, which browsers never send to a server, so the payload
 * stays between you and whoever opens the link.
 */
export function previewLink(payload: Payload | string, options: PreviewOptions = {}): string {
  const params = new URLSearchParams();
  if (options.headless) params.set("headless", "1");
  if (options.family) params.set("family", options.family.replace(/^system/, "").toLowerCase());
  if (options.scheme) params.set("scheme", options.scheme);
  if (options.device) params.set("device", options.device);
  if (options.entry !== undefined) params.set("entry", String(options.entry));
  if (options.freeze) params.set("freeze", "1");
  if (options.align) params.set("align", options.align);
  // Compact, so the link is as short as the payload allows. A string is passed through as
  // it is: re-serialising it would hide a syntax error the playground should report.
  params.set("payload", typeof payload === "string" ? payload.trim() : JSON.stringify(payload));
  const origin = (options.origin ?? "https://webhookwidget.com").replace(/\/+$/, "");
  return `${origin}/playground/#${params}`;
}
