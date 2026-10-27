/**
 * Compile-time tests: every payload here must type-check, and every line under
 * `@ts-expect-error` must not. `npm test` compiles this file; it never runs.
 */
import type { Node, Payload } from "../src/index.js";

export const view: Payload = {
  v: 1,
  refresh: 600,
  url: "https://example.com/",
  view: {
    type: "vstack",
    align: "leading",
    padding: { top: 12, leading: 16 },
    text: { style: "footnote", color: "secondary" },
    overflow: "drop",
    more: { type: "text", text: "+{count} more" },
    children: [
      { type: "text", text: "Hi", weight: "bold", color: "red/20", lines: 2 },
      { type: "text", spans: [{ text: "50" }, { text: "%", color: "#3DDC84/50" }] },
      { type: "timer", until: new Date(), style: "relative", font: "caption" },
      { type: "timer", from: "2026-10-26T12:00:00Z" },
      { type: "symbol", name: "bolt.fill", mode: "palette", colors: ["orange", "#FFF"] },
      { type: "image", url: "https://example.com/a.png", fit: "fill", w: "fill", h: 40 },
      { type: "gauge", value: 0.4, style: "ring", center: { type: "text", text: "40%" } },
      { type: "progress", from: "2026-10-26T09:00:00Z", until: "2026-10-26T17:00:00Z" },
      { type: "capsule", fill: "accent", w: 40, h: 6 },
      { type: "divider" },
      { type: "spacer", minLength: 4 },
      {
        type: "grid",
        columns: [{ w: "fill" }, { align: "trailing", text: { monoDigits: true } }],
        rows: [["Name", "Total"], { cells: ["Lee", null], bg: "blue/10", corner: 6 }],
      },
    ],
  },
};

export const timeline: Payload = {
  v: 1,
  entries: [
    { at: "2026-10-26T12:00:00Z", view: { type: "text", text: "Now" } },
    { at: new Date(), view: { type: "text", text: "Later" }, accessibility: "Later" },
  ],
};

// The README's example, so the package's front page can't show code that doesn't compile.
const family = "systemSmall" as string | undefined;
export const readme = {
  v: 1,
  refresh: 900,
  view: {
    type: "vstack",
    align: "leading",
    padding: 16,
    children: [
      { type: "text", text: "Deploys today", style: "caption", color: "secondary" },
      { type: "text", text: "12", style: family === "systemSmall" ? "title" : "largeTitle", weight: "bold" },
      { type: "timer", from: new Date(), style: "relative", font: "caption2" },
    ],
  },
} satisfies Payload;

// @ts-expect-error The version is required.
export const noVersion: Payload = { view: { type: "spacer" } };

// @ts-expect-error A view or entries is required.
export const empty: Payload = { v: 1 };

// @ts-expect-error A view and entries together are ambiguous.
export const both: Payload = { v: 1, view: { type: "spacer" }, entries: [] };

// @ts-expect-error There is no version 2 yet.
export const future: Payload = { v: 2, view: { type: "spacer" } };

export const wrong: Node[] = [
  // @ts-expect-error Not a node type.
  { type: "button" },
  // @ts-expect-error A text node needs text or spans.
  { type: "text" },
  // @ts-expect-error Not both.
  { type: "text", text: "a", spans: [] },
  // @ts-expect-error A timer needs a date to count towards or from.
  { type: "timer" },
  // @ts-expect-error A gauge needs a value, or a live range.
  { type: "gauge" },
  // @ts-expect-error A live range needs both ends.
  { type: "gauge", from: "2026-10-26T09:00:00Z" },
  // @ts-expect-error The system draws a live ring, and ignores a center.
  { type: "gauge", style: "ring", from: "2026-10-26T09:00:00Z", until: "2026-10-26T17:00:00Z", center: { type: "spacer" } },
  // @ts-expect-error Not a colour.
  { type: "text", text: "a", color: "chartreuse" },
  // @ts-expect-error Not a weight.
  { type: "text", text: "a", weight: "extrabold" },
  // @ts-expect-error A size is points or "fill".
  { type: "spacer", w: "auto" },
  // @ts-expect-error A symbol needs a name.
  { type: "symbol" },
];
