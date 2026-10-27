import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "webhookwidget-cli-"));

// The test runner sets FORCE_COLOR when it prints to a colour terminal, and Node warns on stderr
// when that meets NO_COLOR, so the CLI never inherits it.
const { FORCE_COLOR, ...inherited } = process.env;

function run(args, { env = {}, input } = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    input,
    env: { ...inherited, NO_COLOR: "1", ...env },
  });
  return { code: result.status, out: result.stdout.trim(), err: result.stderr.trim() };
}

/** The same, for a test that serves something to the CLI from this process. */
async function runAsync(args, options = {}) {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { env: { ...inherited, ...options.env } });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}

test("prints help with no command, and the version", () => {
  assert.match(run([]).out, /webhookwidget link/);
  assert.match(run(["--version"]).out, /^\d+\.\d+\.\d+$/);
});

test("link prints the setup link, and warns when it carries a secret", () => {
  const plain = run(["link", "--name", "Hello", "--url", "https://webhookwidget.com/demo/hello"]);
  assert.equal(plain.code, 0);
  assert.equal(plain.out, "webhookwidget://register?name=Hello&url=https%3A%2F%2Fwebhookwidget.com%2Fdemo%2Fhello");
  assert.equal(plain.err, "");

  const secret = run(["link", "--name", "R", "--url", "https://e.com/", "--auth", "bearer", "--secret-env", "T"], {
    env: { T: "a&b" },
  });
  assert.equal(secret.out, "webhookwidget://register?name=R&url=https%3A%2F%2Fe.com%2F&auth=bearer&secret=a%26b");
  assert.match(secret.err, /contains the secret/);
});

test("reads secrets only from the environment, and says what's missing", () => {
  const base = ["link", "--name", "R", "--url", "https://e.com/"];
  assert.match(run([...base, "--auth", "bearer"]).err, /--secret-env/);
  assert.match(run([...base, "--auth", "bearer", "--secret-env", "UNSET_FOR_THIS_TEST"]).err, /UNSET_FOR_THIS_TEST.*not set/);
  assert.match(run([...base, "--auth", "basic", "--secret-env", "T"], { env: { T: "x" } }).err, /--username/);
  assert.match(run([...base, "--auth", "header", "--secret-env", "T"], { env: { T: "x" } }).err, /--header/);
  assert.match(run([...base, "--auth", "magic", "--secret-env", "T"], { env: { T: "x" } }).err, /bearer, basic or header/);
  assert.match(run([...base, "--secret-env", "T"]).err, /needs --auth/);
});

test("fails with a message and a non-zero code", () => {
  const result = run(["link", "--name", "R", "--url", "http://e.com/"]);
  assert.equal(result.code, 1);
  assert.equal(result.out, "");
  assert.match(result.err, /^webhookwidget: .*https/);
  assert.match(run(["nonsense"]).err, /Unknown command/);
  assert.match(run(["link", "--nmae", "x"]).err, /nmae/);
});

test("qr writes files, and never prints the secret itself", () => {
  const png = join(dir, "code.png");
  const svg = join(dir, "code.svg");
  const result = run(
    ["qr", "--name", "R", "--url", "https://e.com/", "--auth", "bearer", "--secret-env", "T", "--png", png, "--svg", svg],
    { env: { T: "super-secret-token" } },
  );
  assert.equal(result.code, 0);
  assert.equal(readFileSync(png).subarray(1, 4).toString(), "PNG");
  assert.match(readFileSync(svg, "utf8"), /^<svg/);
  assert.doesNotMatch(result.out + result.err, /super-secret-token/);
  assert.match(result.err, /contains the secret/);
});

test("qr draws in the terminal when no file is asked for", () => {
  const result = run(["qr", "--name", "Hello", "--url", "https://webhookwidget.com/demo/hello"]);
  assert.equal(result.code, 0);
  assert.match(result.out, /[█▀▄]/);
  assert.match(result.err, /Scan with the iPhone camera/);
});

test("preview reads a file or stdin and prints a playground link", () => {
  const payload = { v: 1, view: { type: "text", text: "Hi" } };
  const file = join(dir, "payload.json");
  writeFileSync(file, JSON.stringify(payload, null, 2));

  for (const result of [
    run(["preview", file, "--family", "small", "--headless"]),
    run(["preview", "-", "--family", "small", "--headless"], { input: JSON.stringify(payload) }),
  ]) {
    assert.equal(result.code, 0, result.err);
    const params = new URLSearchParams(new URL(result.out).hash.slice(1));
    assert.equal(params.get("family"), "small");
    assert.equal(params.get("headless"), "1");
    assert.equal(params.get("payload"), JSON.stringify(payload));
  }
});

test("preview refuses what isn't JSON, and options it doesn't know", () => {
  assert.match(run(["preview", "-"], { input: "{nope" }).err, /isn't JSON/);
  assert.match(run(["preview", "-", "--family", "huge"], { input: "{}" }).err, /small, medium or large/);
  assert.match(run(["preview", "-", "--entry", "1.5"], { input: "{}" }).err, /whole number/);
  assert.match(run(["preview", "-", "--auth", "bearer", "--secret-env", "T"], { env: { T: "x" }, input: "{}" }).err, /fetching a URL/);
});

test("preview fetches a URL the way the app does, credentials and all", async () => {
  const seen = [];
  const server = createServer((request, response) => {
    seen.push({ url: new URL(request.url, "http://localhost"), authorization: request.headers.authorization });
    if (request.headers.authorization !== "Bearer t0k") {
      response.writeHead(401).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" }).end('{"v":1,"view":{"type":"spacer"}}');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/widget?team=a`;
  try {
    const ok = await runAsync(["preview", url, "--family", "large", "--auth", "bearer", "--secret-env", "T"], {
      env: { T: "t0k" },
    });
    assert.equal(ok.code, 0, ok.err);
    assert.equal(new URLSearchParams(new URL(ok.out).hash.slice(1)).get("payload"), '{"v":1,"view":{"type":"spacer"}}');

    const query = seen[0].url.searchParams;
    assert.equal(query.get("team"), "a");
    assert.equal(query.get("family"), "systemLarge");
    assert.equal(query.get("w"), "338");
    assert.equal(query.get("h"), "354");
    assert.equal(query.get("v"), "1");

    const refused = await runAsync(["preview", url]);
    assert.equal(refused.code, 1);
    assert.match(refused.err, /HTTP 401.*--auth/);
  } finally {
    server.close();
  }
});
