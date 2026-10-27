#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseArgs, type ParseArgsConfig } from "node:util";

import { previewLink, registerLink, type Hook, type HookAuth, type PreviewOptions } from "./links.js";
import { qrPng, qrSvg, qrTerminal } from "./qr.js";

const HELP = `webhookwidget: setup links, QR codes and previews for Webhook Widget

Usage
  webhookwidget link    --name <name> --url <https url> [auth]
  webhookwidget qr      --name <name> --url <https url> [auth] [--png <file> | --svg <file>]
  webhookwidget preview [<file> | <url> | -] [--family small|medium|large] [--scheme light|dark]
                        [--device <id>] [--entry <n>] [--headless] [--freeze] [--open] [auth]

link     Prints a webhookwidget://register link. Opened on an iPhone, it fills in the app's
         hook editor; nothing is saved until the person taps Save.
qr       Draws that link as a QR code for the iPhone camera: in the terminal, or as a PNG or
         SVG file to hand to someone.
preview  Prints a playground link that draws a payload with the app's own engine. Reads a
         JSON file, stdin (-), or a live endpoint, fetched the way the app fetches it.
         --headless is the screenshot version: the widget alone, and the page title becomes
         preview-ready once it has drawn.

Auth, when the endpoint needs it. The secret is read from an environment variable, so it
stays out of your shell history:
  --auth bearer --secret-env <VAR>
  --auth basic  --username <name> --secret-env <VAR>
  --auth header --header <name> --secret-env <VAR>
A credential already in the URL (?key=..., or https://user:pass@host/) needs no --auth.

The link and the QR code carry the secret. Keep them out of chats, issues, commits and logs.

Docs: https://webhookwidget.com/docs/   Agents: https://webhookwidget.com/llms.txt`;

/** A failure the message fully explains: printed without a stack trace. */
class CliError extends Error {}

const AUTH_OPTIONS = {
  auth: { type: "string" },
  username: { type: "string" },
  header: { type: "string" },
  "secret-env": { type: "string" },
} satisfies ParseArgsConfig["options"];

const COMMANDS = {
  link: { name: { type: "string" }, url: { type: "string" }, ...AUTH_OPTIONS },
  qr: {
    name: { type: "string" },
    url: { type: "string" },
    png: { type: "string" },
    svg: { type: "string" },
    ...AUTH_OPTIONS,
  },
  preview: {
    family: { type: "string" },
    scheme: { type: "string" },
    device: { type: "string" },
    entry: { type: "string" },
    headless: { type: "boolean" },
    freeze: { type: "boolean" },
    open: { type: "boolean" },
    ...AUTH_OPTIONS,
  },
} satisfies Record<string, ParseArgsConfig["options"]>;

type Values = Record<string, string | boolean | undefined>;

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }
  if (command === "--version" || command === "-v") {
    console.log(createRequire(import.meta.url)("../package.json").version);
    return;
  }
  if (!(command in COMMANDS)) throw new CliError(`Unknown command "${command}". Run webhookwidget --help.`);

  const name = command as keyof typeof COMMANDS;
  let parsed;
  try {
    parsed = parseArgs({ args: rest, options: COMMANDS[name], allowPositionals: name === "preview" });
  } catch (error) {
    throw new CliError((error as Error).message);
  }
  const values = parsed.values as Values;

  if (name === "link") {
    const hook = hookFrom(values);
    console.log(registerLink(hook));
    if (hook.auth) console.error("This link contains the secret. Keep it out of chats, issues, commits and logs.");
  } else if (name === "qr") {
    qr(hookFrom(values), values);
  } else {
    await preview(parsed.positionals, values);
  }
}

function text(values: Values, key: string): string | undefined {
  const value = values[key];
  return typeof value === "string" ? value : undefined;
}

function hookFrom(values: Values): Hook {
  const name = text(values, "name");
  const url = text(values, "url");
  if (!name) throw new CliError("--name is required: what the widget is called in the app.");
  if (!url) throw new CliError("--url is required: the https address the app fetches.");
  const auth = authFrom(values);
  try {
    registerLink({ name, url, auth });
  } catch (error) {
    throw new CliError((error as Error).message);
  }
  return { name, url, auth };
}

function authFrom(values: Values): HookAuth | undefined {
  const type = text(values, "auth");
  const variable = text(values, "secret-env");
  if (!type) {
    if (variable) throw new CliError("--secret-env needs --auth bearer, basic or header.");
    return undefined;
  }
  if (!variable) {
    throw new CliError(`--auth ${type} needs --secret-env <VAR>, the environment variable holding the secret.`);
  }
  const secret = process.env[variable];
  if (!secret) throw new CliError(`The environment variable ${variable} is empty or not set.`);

  if (type === "bearer") return { type, token: secret };
  if (type === "basic") {
    const username = text(values, "username");
    if (!username) throw new CliError("--auth basic needs --username.");
    return { type, username, password: secret };
  }
  if (type === "header") {
    const header = text(values, "header");
    if (!header) throw new CliError("--auth header needs --header <name>, such as X-API-Key.");
    return { type, name: header, value: secret };
  }
  throw new CliError(`--auth must be bearer, basic or header, not "${type}".`);
}

function qr(hook: Hook, values: Values): void {
  const link = registerLink(hook);
  const png = text(values, "png");
  const svg = text(values, "svg");
  if (png) writeFileSync(png, qrPng(link));
  if (svg) writeFileSync(svg, qrSvg(link));
  if (!png && !svg) {
    console.log(qrTerminal(link, process.stdout.isTTY === true && !process.env.NO_COLOR));
  }
  const host = new URL(hook.url).host;
  const saved = [png, svg].filter(Boolean).join(" and ");
  console.error(
    `${saved ? `Wrote ${saved}. ` : ""}Scan with the iPhone camera to add "${hook.name}" (${host}).` +
      (hook.auth ? " The code contains the secret." : ""),
  );
}

/** The slot sizes of the playground's default device, sent as the app would send its own. */
const SLOTS = {
  systemSmall: [158, 158],
  systemMedium: [338, 158],
  systemLarge: [338, 354],
} as const;

async function preview(positionals: string[], values: Values): Promise<void> {
  if (positionals.length > 1) throw new CliError("preview takes one payload: a file, a URL, or - for stdin.");
  const source = positionals[0] ?? "-";

  const family = text(values, "family") ?? "medium";
  const systemFamily = `system${family.replace(/^system/i, "").replace(/^./, (c) => c.toUpperCase())}`;
  if (!(systemFamily in SLOTS)) throw new CliError(`--family must be small, medium or large, not "${family}".`);
  const scheme = text(values, "scheme") ?? "dark";
  if (scheme !== "light" && scheme !== "dark") throw new CliError(`--scheme must be light or dark, not "${scheme}".`);
  const entryText = text(values, "entry");
  const entry = entryText === undefined ? undefined : Number(entryText);
  if (entry !== undefined && !(Number.isInteger(entry) && entry >= 0)) {
    throw new CliError(`--entry must be a whole number from 0, not "${entryText}".`);
  }

  let body: string;
  if (/^https?:\/\//i.test(source)) {
    body = await fetchPayload(source, systemFamily as keyof typeof SLOTS, scheme, authFrom(values));
  } else {
    if (text(values, "auth")) throw new CliError("--auth is for fetching a URL; a file or stdin needs none.");
    try {
      body = readFileSync(source === "-" ? 0 : source, "utf8");
    } catch (error) {
      throw new CliError(`Couldn't read ${source === "-" ? "stdin" : source}: ${(error as Error).message}`);
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    throw new CliError(`${source === "-" ? "stdin" : source} isn't JSON: ${(error as Error).message}`);
  }

  const options: PreviewOptions = {
    family: systemFamily as PreviewOptions["family"],
    scheme,
    device: text(values, "device"),
    entry,
    headless: values.headless === true,
    freeze: values.freeze === true,
  };
  // Re-serialised compactly: the playground reads the same JSON, in a shorter link.
  const link = previewLink(JSON.stringify(payload), options);
  console.log(link);
  if (values.open === true) open(link);
}

/** Fetches a payload with the query string and credentials the app would send. */
async function fetchPayload(
  source: string,
  family: keyof typeof SLOTS,
  scheme: string,
  auth: HookAuth | undefined,
): Promise<string> {
  const url = new URL(source);
  const headers = new Headers({ Accept: "application/json" });
  // The app moves credentials in the address into a header before the request leaves the
  // phone, and fetch refuses a URL that still has them.
  if (url.username || url.password) {
    const pair = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
    headers.set("Authorization", `Basic ${Buffer.from(pair).toString("base64")}`);
    url.username = "";
    url.password = "";
  }
  if (auth?.type === "bearer") headers.set("Authorization", `Bearer ${auth.token}`);
  if (auth?.type === "basic") {
    headers.set("Authorization", `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`);
  }
  if (auth?.type === "header") headers.set(auth.name, auth.value);

  const [width, height] = SLOTS[family];
  const intl = Intl.DateTimeFormat().resolvedOptions();
  const query = {
    family,
    w: String(width),
    h: String(height),
    scale: "3",
    scheme,
    locale: intl.locale.replace("-", "_"),
    tz: intl.timeZone,
    v: "1",
    rev: "1",
  };
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  let response: Response;
  try {
    response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new CliError(`Couldn't fetch ${url.origin}${url.pathname}: ${(error as Error).message}`);
  }
  if (!response.ok) {
    const hint = response.status === 401 || response.status === 403 ? " Check --auth and --secret-env." : "";
    throw new CliError(`${url.origin}${url.pathname} answered HTTP ${response.status}.${hint}`);
  }
  if (response.headers.get("content-type")?.startsWith("image/")) {
    throw new CliError("That endpoint answered with an image (bitmap mode). The playground draws JSON payloads only.");
  }
  return response.text();
}

function open(link: string): void {
  const [command, args] =
    process.platform === "darwin" ? ["open", [link]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", link]]
    : ["xdg-open", [link]];
  spawn(command, args, { stdio: "ignore", detached: true }).unref();
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof CliError) {
    console.error(`webhookwidget: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.error(error);
    process.exitCode = 1;
  }
});
