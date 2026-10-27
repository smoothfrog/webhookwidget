/**
 * What the app tells your server about the widget it is drawing.
 *
 * Every fetch is a GET to your URL with these added to the query string, so one endpoint can
 * answer each slot with a layout that suits it: https://webhookwidget.com/docs/request/
 */

/** Home Screen sizes, then the Lock Screen's. */
export type Family =
  | "systemSmall"
  | "systemMedium"
  | "systemLarge"
  | "accessoryCircular"
  | "accessoryRectangular"
  | "accessoryInline";

const FAMILIES: readonly string[] = [
  "systemSmall",
  "systemMedium",
  "systemLarge",
  "accessoryCircular",
  "accessoryRectangular",
  "accessoryInline",
];

/**
 * Each field is absent when the request didn't come from the app (opening the URL in a
 * browser, say), so give every one a fallback.
 */
export interface WidgetRequest {
  family?: Family;
  /** The slot's size in points, for this exact device. */
  width?: number;
  height?: number;
  /** 2 or 3. Multiply by `width` and `height` for pixels. */
  scale?: number;
  /** A hint: a widget drawn in semantic colours adapts without it. */
  scheme?: "light" | "dark";
  /** Such as `en_GB`. */
  locale?: string;
  /** An IANA time zone, such as `Europe/London`. */
  timeZone?: string;
  /** The protocol version the app speaks. */
  version?: number;
  /** Which revision of that version it understands. */
  revision?: number;
}

/** Reads the widget's parameters from a request, a URL, or a URL string. */
export function readRequest(input: { url: string } | URL | string): WidgetRequest {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const query = url.searchParams;
  const number = (name: string) => {
    const raw = query.get(name);
    const value = raw === null || raw === "" ? NaN : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const family = query.get("family") ?? "";
  const scheme = query.get("scheme");
  return {
    family: FAMILIES.includes(family) ? (family as Family) : undefined,
    width: number("w"),
    height: number("h"),
    scale: number("scale"),
    scheme: scheme === "light" || scheme === "dark" ? scheme : undefined,
    locale: query.get("locale") || undefined,
    timeZone: query.get("tz") || undefined,
    version: number("v"),
    revision: number("rev"),
  };
}
