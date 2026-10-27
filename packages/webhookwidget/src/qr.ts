import { deflateSync } from "node:zlib";
import { encode, renderSVG } from "uqr";

/**
 * QR codes for setup links, drawn where the command runs. Error correction M survives a code
 * scanned off a laptop screen across a desk; a quiet zone of four modules is what the
 * standard asks for, and what phone cameras find the code by.
 */
const OPTIONS = { ecc: "M", border: 4 } as const;

/**
 * Two modules per character cell, using half blocks. In colour it pins black on white, so
 * the code reads the right way round on any terminal theme. Without colour it can only
 * assume, and assumes a dark terminal: light modules are drawn, dark ones left blank.
 */
export function qrTerminal(text: string, colour: boolean): string {
  const { data } = encode(text, OPTIONS);
  const lines: string[] = [];
  for (let y = 0; y < data.length; y += 2) {
    let line = "";
    for (let x = 0; x < data[y].length; x++) {
      const top = data[y][x];
      const bottom = data[y + 1]?.[x] ?? false;
      // Which halves of the cell to fill: dark modules in colour, light ones without. A
      // missing last row is quiet zone, which comes out white in colour and blank without.
      const [upper, lower] = colour ? [top, bottom] : [!top, !(data[y + 1] ? bottom : true)];
      line += upper && lower ? "█" : upper ? "▀" : lower ? "▄" : " ";
    }
    lines.push(colour ? `\x1b[30;107m${line}\x1b[0m` : line);
  }
  return lines.join("\n");
}

export function qrSvg(text: string): string {
  return renderSVG(text, { ...OPTIONS, pixelSize: 10 });
}

/** A 1-bit greyscale PNG, `scale` pixels to a module. */
export function qrPng(text: string, scale = 10): Uint8Array {
  const { data } = encode(text, OPTIONS);
  const size = data.length * scale;
  const stride = Math.ceil(size / 8);
  const raw = new Uint8Array((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = data[Math.floor(y / scale)];
    const offset = y * (stride + 1); // Each row starts with filter type 0, none.
    for (let x = 0; x < size; x++) {
      // In greyscale a set bit is white, so light modules are the ones written.
      if (!row[Math.floor(x / scale)]) raw[offset + 1 + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  header.set([1, 0, 0, 0, 0], 8); // Bit depth 1, greyscale, deflate, no filter, no interlace.
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
