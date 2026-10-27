import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import { encode } from "uqr";

import { qrPng, qrTerminal } from "../dist/qr.js";

const LINK = "webhookwidget://register?name=Hello&url=https%3A%2F%2Fwebhookwidget.com%2Fdemo%2Fhello";
const { data: modules } = encode(LINK, { ecc: "M", border: 4 });

/** Reads half-block art back into rows of modules, `filled` meaning a block was drawn. */
function unpack(art) {
  const rows = [];
  for (const line of art.replace(/\x1b\[[0-9;]*m/g, "").split("\n")) {
    const chars = [...line];
    rows.push(chars.map((c) => c === "█" || c === "▀"));
    rows.push(chars.map((c) => c === "█" || c === "▄"));
  }
  return rows.slice(0, modules.length);
}

test("in colour, draws every dark module as a block", () => {
  assert.deepEqual(unpack(qrTerminal(LINK, true)), modules);
});

test("without colour, draws every light module instead, for a dark terminal", () => {
  assert.deepEqual(unpack(qrTerminal(LINK, false)), modules.map((row) => row.map((dark) => !dark)));
});

test("pins black on white in colour, whatever the terminal's theme", () => {
  for (const line of qrTerminal(LINK, true).split("\n")) {
    assert.ok(line.startsWith("\x1b[30;107m") && line.endsWith("\x1b[0m"));
  }
});

test("writes a PNG whose pixels are the modules", () => {
  const scale = 3;
  const png = Buffer.from(qrPng(LINK, scale));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR, then IDAT, then IEND, each checked against its length.
  const chunks = [];
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    chunks.push({ type: png.toString("latin1", offset + 4, offset + 8), body: png.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  assert.deepEqual(chunks.map((c) => c.type), ["IHDR", "IDAT", "IEND"]);

  const size = modules.length * scale;
  const header = chunks[0].body;
  assert.equal(header.readUInt32BE(0), size);
  assert.equal(header.readUInt32BE(4), size);
  assert.deepEqual([...header.subarray(8)], [1, 0, 0, 0, 0]);

  const raw = inflateSync(chunks[1].body);
  const stride = Math.ceil(size / 8) + 1;
  for (let y = 0; y < size; y++) {
    assert.equal(raw[y * stride], 0, "filter type");
    for (let x = 0; x < size; x++) {
      const white = (raw[y * stride + 1 + (x >> 3)] >> (7 - (x & 7))) & 1;
      assert.equal(white === 0, modules[Math.floor(y / scale)][Math.floor(x / scale)], `pixel ${x},${y}`);
    }
  }
});
