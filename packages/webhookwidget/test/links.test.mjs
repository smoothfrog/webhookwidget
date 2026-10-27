import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { previewLink, registerLink } from "../dist/index.js";

// The same cases the app's RegistrationLinkConformanceTests read back, so a change to how
// links are written fails here and a change to how the app reads them fails there.
const { cases } = JSON.parse(readFileSync(new URL("link-cases.json", import.meta.url), "utf8"));

test("writes every setup link in the shared cases", () => {
  assert.ok(cases.length >= 5);
  for (const { description, hook, link } of cases) {
    assert.equal(registerLink(hook), link, description);
  }
});

test("percent-encodes every value, so nothing in one runs into the link", () => {
  for (const { hook, link } of cases) {
    const query = link.slice("webhookwidget://register?".length);
    for (const pair of query.split("&")) {
      const [key, value] = pair.split("=");
      assert.match(key, /^(name|url|auth|username|header|secret)$/);
      assert.doesNotMatch(value, /[&=#?\s]/, `${hook.name}: ${key}`);
    }
  }
});

test("writes only the fields in use", () => {
  const plain = registerLink({ name: "A", url: "https://example.com/" });
  assert.equal(plain, "webhookwidget://register?name=A&url=https%3A%2F%2Fexample.com%2F");
  assert.doesNotMatch(plain, /auth=/);
});

test("refuses what the app would refuse", () => {
  assert.throws(() => registerLink({ name: "A", url: "http://example.com/" }), /https/);
  assert.throws(() => registerLink({ name: "A", url: "example.com/feed" }), /Not a URL/);
  assert.throws(() => registerLink({ name: "  ", url: "https://example.com/" }), /name/);
});

test("puts the payload and options in the fragment, which never reaches a server", () => {
  const payload = { v: 1, view: { type: "text", text: "50% & rising #1" } };
  const link = new URL(previewLink(payload, { family: "systemSmall", scheme: "light", headless: true, entry: 2 }));
  assert.equal(link.origin + link.pathname, "https://webhookwidget.com/playground/");
  assert.equal(link.search, "");
  const params = new URLSearchParams(link.hash.slice(1));
  assert.equal(params.get("headless"), "1");
  assert.equal(params.get("family"), "small");
  assert.equal(params.get("scheme"), "light");
  assert.equal(params.get("entry"), "2");
  // The playground reads it with URLSearchParams too, and takes text starting "{" as JSON.
  assert.deepEqual(JSON.parse(params.get("payload")), payload);
});

test("passes a string payload through untouched, so the playground reports its errors", () => {
  const params = new URLSearchParams(new URL(previewLink(' {"v": 1,} ')).hash.slice(1));
  assert.equal(params.get("payload"), '{"v": 1,}');
  assert.equal(params.has("headless"), false);
});

test("takes another origin, for a local copy of the site", () => {
  assert.match(previewLink("{}", { origin: "http://localhost:4321/" }), /^http:\/\/localhost:4321\/playground\/#/);
});
