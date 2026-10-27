/**
 * What a hook returns: the payload the app decodes into a widget.
 *
 * These mirror the app's own decoders field for field, so a payload that type-checks here is
 * one the phone accepts. The reference, with a rendered demo of every node, is
 * https://webhookwidget.com/docs/schema/. Return the object with `Response.json(payload)` or
 * anything else that calls `JSON.stringify`.
 */

/** Colours that adapt to light, dark and the tinted Home Screen by themselves. */
export type SemanticColor =
  | "primary" | "secondary" | "tertiary" | "accent"
  | "red" | "orange" | "yellow" | "green" | "mint" | "teal" | "cyan" | "blue" | "indigo"
  | "purple" | "pink" | "brown" | "gray" | "white" | "black" | "clear";

/**
 * A semantic colour, optionally at a percentage of its opacity (`"red/20"`), or hex: `#RGB`,
 * `#RGBA`, `#RRGGBB` or `#RRGGBBAA`, which may carry a percentage too (`"#3DDC84/50"`).
 * Prefer semantic colours: hex is drawn as written in light and dark alike.
 */
export type Color = SemanticColor | `${SemanticColor}/${number}` | `#${string}`;

/** An ISO 8601 date and time. A `Date` works too: `JSON.stringify` writes it as one. */
export type DateTime = string | Date;

/** Dynamic Type styles, which scale with the reader's text size. `size` overrides them. */
export type FontStyle =
  | "largeTitle" | "title" | "title2" | "title3" | "headline" | "subheadline"
  | "body" | "callout" | "footnote" | "caption" | "caption2";

export type FontWeight =
  | "ultraLight" | "thin" | "light" | "regular" | "medium" | "semibold" | "bold" | "heavy" | "black";

export type FontDesign = "default" | "rounded" | "serif" | "monospaced";

/** One vocabulary for every axis; each stack reads the part that applies to it. */
export type Align = "leading" | "center" | "trailing" | "top" | "bottom";

/** A number insets all four edges, in points; an object insets only the edges it names. */
export type Edges = number | { top?: number; bottom?: number; leading?: number; trailing?: number };

/** A width or height in points, or `"fill"` for everything the parent offers. */
export type Size = number | "fill";

/** What a stack or grid does with children that don't fit: cut the last, or leave whole ones out. */
export type Overflow = "clip" | "drop";

/** Modifiers every node accepts, alongside its own fields. */
export interface Modifiers {
  padding?: Edges;
  /** Filled behind the node, padding included, inside its `corner`. */
  bg?: Color;
  /** A colour draws a 1 pt line; an object sets the width. */
  border?: Color | { color: Color; width?: number };
  corner?: number;
  /** 0 to 1, for the node and everything inside it. */
  opacity?: number;
  w?: Size;
  h?: Size;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  /** When space runs out, lower priorities give way first. */
  priority?: number;
  /** Keeps the node legible on a tinted Home Screen. */
  accentable?: boolean;
}

/**
 * Text fields a container hands down to every text, timer and symbol inside it, as its
 * `text` object. The nearest container that sets a field wins, and a node's own fields beat
 * all of them.
 */
export interface TextDefaults {
  style?: FontStyle;
  /** A fixed point size. It opts out of Dynamic Type, and clears an inherited `style`. */
  size?: number;
  weight?: FontWeight;
  design?: FontDesign;
  color?: Color;
  lines?: number;
  align?: Align;
  /** Equal-width digits, so numbers that change don't jiggle. */
  monoDigits?: boolean;
  /** How far text may shrink, as a fraction of its size, before it truncates. */
  minScale?: number;
  italic?: boolean;
  tracking?: number;
  uppercase?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}

export interface StackNode extends Modifiers {
  type: "vstack" | "hstack" | "zstack";
  children?: Node[];
  /** Points between children. 8 unless set. */
  spacing?: number;
  align?: Align;
  overflow?: Overflow;
  /** Shown in place of dropped children; `{count}` in its text becomes how many. */
  more?: Node;
  text?: TextDefaults;
}

/** One styled run of a text node. Fields it leaves out come from the node. */
export interface Span {
  text: string;
  weight?: FontWeight;
  design?: FontDesign;
  italic?: boolean;
  monoDigits?: boolean;
  tracking?: number;
  color?: Color;
  strikethrough?: boolean;
  underline?: boolean;
  uppercase?: boolean;
}

interface TextFields extends Modifiers, TextDefaults {
  type: "text";
}

/** Plain text in `text`, or several differently styled runs in `spans`. */
export type TextNode = TextFields & ({ text: string; spans?: never } | { spans: Span[]; text?: never });

interface TimerFields extends Modifiers {
  type: "timer";
  /** `timer`, `relative` and `offset` count on the phone between fetches; `date` and `time` don't move. */
  style?: "timer" | "relative" | "offset" | "date" | "time";
  /** A text style for the timer. Named `font` because `style` is taken. */
  font?: FontStyle;
  size?: number;
  weight?: FontWeight;
  design?: FontDesign;
  color?: Color;
}

/** A date the phone counts towards (`until`) or up from (`from`) by itself. */
export type TimerNode = TimerFields & ({ until: DateTime; from?: never } | { from: DateTime; until?: never });

export interface SymbolNode extends Modifiers {
  type: "symbol";
  /** An SF Symbols name, such as `"bolt.fill"`. */
  name: string;
  style?: FontStyle;
  size?: number;
  weight?: FontWeight;
  color?: Color;
  mode?: "monochrome" | "hierarchical" | "palette" | "multicolor";
  /** Further colours for `palette`, after `color`. */
  colors?: Color[];
  /** 0 to 1, for symbols with variable fill. */
  variable?: number;
}

export interface ImageNode extends Modifiers {
  type: "image";
  /** An `https` address. */
  url: string;
  fit?: "fit" | "fill";
  /** Draws the image as a template in this colour, which survives tinting. */
  tint?: Color;
}

interface GaugeFields extends Modifiers {
  type: "gauge" | "progress";
  /** 0 unless set. */
  min?: number;
  /** 1 unless set; must be above `min`. */
  max?: number;
  label?: string;
  style?: "bar" | "ring";
  tint?: Color;
}

/**
 * A value between `min` and `max`, or a progress the phone animates by itself from `from`
 * to `until`. The system draws a live progress with its own view, which has no `track`,
 * `thickness` or `center`: overlay a label with a `zstack` instead.
 */
export type GaugeNode = GaugeFields & (
  | {
      value: number;
      from?: never;
      until?: never;
      track?: Color;
      thickness?: number;
      /** Drawn in the middle of a ring. */
      center?: Node;
    }
  | { from: DateTime; until: DateTime; value?: number; track?: never; thickness?: never; center?: never }
);

export interface ShapeNode extends Modifiers {
  type: "rect" | "circle" | "capsule";
  fill?: Color;
  stroke?: Color;
  lineWidth?: number;
}

export interface SpacerNode extends Modifiers {
  type: "spacer";
  /** The least space it holds. 0 unless set, so a bare spacer vanishes when space is short. */
  minLength?: number;
}

/** A hairline across a vertical stack, or down a horizontal one. */
export interface DividerNode extends Modifiers {
  type: "divider";
  color?: Color;
}

export interface GridColumn {
  w?: Size;
  minW?: number;
  maxW?: number;
  align?: Align;
  priority?: number;
  /** Text defaults for this column's cells. */
  text?: TextDefaults;
}

/** A node, a string (a text node styled by the grid, column and row defaults), or `null` for an empty cell. */
export type GridCell = Node | string | null;

export type GridRow =
  | GridCell[]
  | {
      cells: GridCell[];
      bg?: Color;
      corner?: number;
      opacity?: number;
      priority?: number;
      text?: TextDefaults;
    };

export interface GridNode extends Modifiers {
  type: "grid";
  /** Without columns, each column is as wide as its widest cell. */
  columns?: GridColumn[];
  rows?: GridRow[];
  /** Between columns. 8 unless set. */
  spacing?: number;
  /** Between rows. 4 unless set. */
  rowSpacing?: number;
  rowPadding?: Edges;
  /** Vertical placement of cells within their row. */
  align?: Align;
  overflow?: Overflow;
  more?: Node;
  text?: TextDefaults;
}

export type Node =
  | StackNode
  | GridNode
  | TextNode
  | TimerNode
  | SymbolNode
  | ImageNode
  | GaugeNode
  | ShapeNode
  | SpacerNode
  | DividerNode;

/** One state of a timeline, shown from `at` until the next. */
export interface Entry {
  at?: DateTime;
  view: Node;
  /** VoiceOver's reading while this entry is on screen. */
  accessibility?: string;
}

interface Envelope {
  /** The protocol version. Always 1 for now. */
  v: 1;
  /** Seconds until the next fetch, clamped to 300–86400. 900 unless set. */
  refresh?: number;
  /** What VoiceOver reads. Without it, the widget's text is read aloud. */
  accessibility?: string;
  /** Opened when the widget is tapped: a web address or another app's link. */
  url?: string;
}

/** A single `view`, or a timeline of up to 60 `entries` at least five minutes apart. */
export type Payload = Envelope & ({ view: Node; entries?: never } | { entries: Entry[]; view?: never });
