import assert from "node:assert/strict";
import { test } from "node:test";

import { readRequest } from "../dist/index.js";

// The query string the docs show the app sending.
const FROM_THE_APP =
  "https://you.example/widget?key=s3cret&family=systemMedium&w=338&h=158&scale=3&scheme=dark" +
  "&locale=en_GB&tz=Europe/London&v=1&rev=1";

test("reads what the app sends", () => {
  assert.deepEqual(readRequest(FROM_THE_APP), {
    family: "systemMedium",
    width: 338,
    height: 158,
    scale: 3,
    scheme: "dark",
    locale: "en_GB",
    timeZone: "Europe/London",
    version: 1,
    revision: 1,
  });
});

test("takes a Request, a URL or a string", () => {
  const expected = readRequest(FROM_THE_APP);
  assert.deepEqual(readRequest(new Request(FROM_THE_APP)), expected);
  assert.deepEqual(readRequest(new URL(FROM_THE_APP)), expected);
});

test("leaves out what a browser doesn't send, rather than guessing", () => {
  const request = readRequest("https://you.example/widget");
  assert.deepEqual(Object.values(request).filter((value) => value !== undefined), []);
});

test("leaves out values that aren't the app's", () => {
  const request = readRequest("https://you.example/w?family=huge&w=wide&scheme=sepia&v=");
  assert.equal(request.family, undefined);
  assert.equal(request.width, undefined);
  assert.equal(request.scheme, undefined);
  assert.equal(request.version, undefined);
});

test("knows the Lock Screen families", () => {
  for (const family of ["accessoryCircular", "accessoryRectangular", "accessoryInline"]) {
    assert.equal(readRequest(`https://you.example/w?family=${family}`).family, family);
  }
});
