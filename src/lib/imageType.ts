/**
 * Image type detection from the file's own bytes.
 *
 * The browser-supplied `File.type` is attacker-controlled: any content can be
 * labelled `image/png`. Sniffing the magic number means what we forward to the
 * image host is actually the format we claim it is.
 */

export type DetectedImageType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "image/avif"
  | "image/bmp";

const ASCII = (text: string) => Array.from(text, (character) => character.charCodeAt(0));

interface Signature {
  type: DetectedImageType;
  offset: number;
  bytes: number[];
}

const SIGNATURES: Signature[] = [
  { type: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/gif", offset: 0, bytes: ASCII("GIF8") },
  { type: "image/bmp", offset: 0, bytes: ASCII("BM") },
];

function matches(view: Uint8Array, { offset, bytes }: Signature): boolean {
  if (view.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => view[offset + index] === byte);
}

/** Both formats are ISO-BMFF/RIFF containers, so they need a two-part check. */
function isRiffContainer(view: Uint8Array, fourCC: string): boolean {
  if (view.length < 12) return false;
  const riff = ASCII("RIFF").every((byte, index) => view[index] === byte);
  const tag = ASCII(fourCC).every((byte, index) => view[8 + index] === byte);
  return riff && tag;
}

function isAvif(view: Uint8Array): boolean {
  if (view.length < 12) return false;
  const hasFtyp = ASCII("ftyp").every((byte, index) => view[4 + index] === byte);
  if (!hasFtyp) return false;
  const brand = String.fromCharCode(...view.slice(8, 12));
  return brand === "avif" || brand === "avis";
}

/** Returns the detected type, or `null` when the bytes are not a known image. */
export function detectImageType(buffer: ArrayBuffer): DetectedImageType | null {
  const view = new Uint8Array(buffer.slice(0, 32));

  for (const signature of SIGNATURES) {
    if (matches(view, signature)) return signature.type;
  }
  if (isRiffContainer(view, "WEBP")) return "image/webp";
  if (isAvif(view)) return "image/avif";

  return null;
}
