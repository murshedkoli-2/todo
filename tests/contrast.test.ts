import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Contrast guard for the colour tokens.
 *
 * The palette pairs every fill with a text colour — `--on-*` for the saturated
 * fill, `--*-ink` for that colour's pale tint. Which of the two applies is easy
 * to get wrong, and the failure is invisible to type checking and to every
 * other test in this suite: the page still renders, the label is simply
 * unreadable. Before these tokens were wired up, white-on-fill measured 1.9:1
 * and a vivid glyph on its own tint measured 1.8:1.
 *
 * Reading the real stylesheet rather than a copied table is deliberate — a
 * duplicated palette would drift and pass while the app regressed.
 */

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** WCAG 2.1 AA for body-sized text. */
const AA_NORMAL = 4.5;

interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(value: string): Rgb {
  const text = value.trim();

  const fn = text.match(/rgba?\(([^)]+)\)/);
  if (fn) {
    const parts = fn[1].split(",").map((p) => Number.parseFloat(p.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }

  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3
      ? hex[1].split("").map((c) => c + c).join("")
      : hex[1];
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }

  throw new Error(`Unsupported colour literal: ${value}`);
}

/** Composites a translucent colour over an opaque one. */
function over(fg: Rgb, bg: Rgb): Rgb {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

/** Applies an explicit alpha, as `color-mix(… N%, transparent)` does. */
function withAlpha(color: Rgb, alpha: number): Rgb {
  return { ...color, a: alpha };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (raw: number) => {
    const v = raw / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(fg: Rgb, bg: Rgb): number {
  const [lighter, darker] = [relativeLuminance(fg), relativeLuminance(bg)].sort(
    (a, b) => b - a
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pulls `--name: value;` declarations out of one rule body. */
function tokensIn(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  if (start === -1) throw new Error(`Selector not found in globals.css: ${selector}`);

  const open = CSS.indexOf("{", start);
  const close = CSS.indexOf("}", open);
  const body = CSS.slice(open + 1, close);

  const tokens: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

const light = tokensIn(":root");
/* Dark only overrides a subset, so it layers on top of the light defaults. */
const dark = { ...light, ...tokensIn("html:not(.light)") };

const THEMES: ReadonlyArray<readonly [string, Record<string, string>]> = [
  ["light", light],
  ["dark", dark],
];

const FILLS = ["accent", "purple", "green", "yellow", "orange", "red"] as const;

describe("colour tokens meet WCAG AA", () => {
  test.each(THEMES)("%s: every token pair referenced by the tests exists", (_name, tokens) => {
    for (const fill of FILLS) {
      expect(tokens[`--${fill}`], `--${fill}`).toBeDefined();
      expect(tokens[`--on-${fill}`], `--on-${fill}`).toBeDefined();
      expect(tokens[`--${fill}-ink`], `--${fill}-ink`).toBeDefined();
    }
  });

  describe.each(THEMES)("%s theme", (_name, tokens) => {
    /* Solid controls: filled buttons, active chips, `solid` avatars. */
    test.each(FILLS)("--on-%s reads on the saturated --%s fill", (fill) => {
      const ratio = contrast(
        parseColor(tokens[`--on-${fill}`]),
        parseColor(tokens[`--${fill}`])
      );
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    /*
     * Tinted surfaces: the default avatar draws a 16% wash of its tone over
     * `--bg-sunken`, which is the exact composite the glyph has to survive.
     */
    test.each(FILLS)("--%s-ink reads on a 16%% tint of --%s", (fill) => {
      const tint = over(withAlpha(parseColor(tokens[`--${fill}`]), 0.16), parseColor(tokens["--bg-sunken"]));
      const ratio = contrast(parseColor(tokens[`--${fill}-ink`]), tint);
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    /* Alert bodies and `.btn-danger`, which sit on the `*-soft` tints. */
    test.each([
      ["--red-ink", "--red-soft"],
      ["--green-ink", "--green-soft"],
    ] as const)("%s reads on %s over a card", (ink, soft) => {
      const surface = over(parseColor(tokens[soft]), parseColor(tokens["--bg-card"]));
      expect(contrast(parseColor(tokens[ink]), surface)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    /* Body copy, which is the most-read pairing in the app. */
    test.each(["--text-primary", "--text-secondary"] as const)(
      "%s reads on the card surface",
      (token) => {
        const ratio = contrast(parseColor(tokens[token]), parseColor(tokens["--bg-card"]));
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    );
  });
});

describe("no literal white is printed on a vivid fill", () => {
  /*
   * The regression this suite exists for: `color: #fff` next to
   * `background: var(--accent)`. White clears AA on the light accent and
   * nowhere else, so the literal has to stay out of the token-driven rules.
   */
  test("globals.css sets no `color: #fff` declarations", () => {
    const offenders = [...CSS.matchAll(/color:\s*(#fff(?:fff)?|white)\s*;/gi)].map((m) => m[0]);
    expect(offenders).toEqual([]);
  });
});
