import { describe, expect, test } from "vitest";
import { detectImageType } from "@/lib/imageType";

/** Builds a buffer whose leading bytes are `bytes`, padded to 32. */
function bufferOf(bytes: number[]): ArrayBuffer {
  const view = new Uint8Array(32);
  view.set(bytes);
  return view.buffer;
}

const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0));

describe("detectImageType", () => {
  test("recognises JPEG", () => {
    expect(detectImageType(bufferOf([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });

  test("recognises PNG", () => {
    expect(detectImageType(bufferOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
      .toBe("image/png");
  });

  test("recognises GIF", () => {
    expect(detectImageType(bufferOf(ascii("GIF89a")))).toBe("image/gif");
  });

  test("recognises BMP", () => {
    expect(detectImageType(bufferOf(ascii("BM")))).toBe("image/bmp");
  });

  test("recognises WebP via the RIFF container", () => {
    const bytes = [...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")];
    expect(detectImageType(bufferOf(bytes))).toBe("image/webp");
  });

  test("recognises AVIF via the ftyp brand", () => {
    const bytes = [0, 0, 0, 0x20, ...ascii("ftyp"), ...ascii("avif")];
    expect(detectImageType(bufferOf(bytes))).toBe("image/avif");
  });

  test("rejects a RIFF container that is not WebP", () => {
    const wav = [...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")];
    expect(detectImageType(bufferOf(wav))).toBeNull();
  });

  test("rejects an executable mislabelled as an image", () => {
    // The whole reason for sniffing: `File.type` is set by the client.
    expect(detectImageType(bufferOf(ascii("MZ\x90\x00")))).toBeNull();
  });

  test("rejects a script payload", () => {
    expect(detectImageType(bufferOf(ascii("<script>alert(1)</script>")))).toBeNull();
  });

  test("rejects an empty buffer without throwing", () => {
    expect(detectImageType(new ArrayBuffer(0))).toBeNull();
  });

  test("rejects a truncated signature", () => {
    // Two of PNG's eight magic bytes must not be enough.
    expect(detectImageType(new Uint8Array([0x89, 0x50]).buffer)).toBeNull();
  });
});
