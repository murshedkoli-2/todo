/**
 * Money is stored and computed exclusively in **integer minor units**
 * (paisa for BDT, cents for USD). Floating point never touches a stored
 * amount — `0.1 + 0.2` problems compound badly once a ledger sums hundreds
 * of entries, and a balance that is off by 1e-13 still renders wrong.
 *
 * Conversion to a decimal happens only at the two edges:
 *   - `toMinor`   — parsing what the user typed
 *   - `formatMoney` — rendering
 */

export const DEFAULT_CURRENCY = "BDT";

/** Minor units per major unit, by ISO 4217 code. Everything here is 2. */
const MINOR_UNIT_EXPONENT: Record<string, number> = {
  BDT: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  INR: 2,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  BDT: "৳",
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
};

/** Largest amount we accept, in minor units — ~90 billion major units. */
export const MAX_MINOR = Number.MAX_SAFE_INTEGER / 100_000;

export function minorFactor(currency: string = DEFAULT_CURRENCY): number {
  return 10 ** (MINOR_UNIT_EXPONENT[currency.toUpperCase()] ?? 2);
}

export function currencySymbol(currency: string = DEFAULT_CURRENCY): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
}

/**
 * Parses a user-entered major-unit amount into integer minor units.
 * Returns `null` for anything that is not a finite, in-range number so callers
 * are forced to decide what a bad amount means rather than silently getting 0.
 */
export function toMinor(
  major: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY
): number | null {
  if (major === null || major === undefined || major === "") return null;

  const value = typeof major === "string" ? Number(major.trim()) : major;
  if (!Number.isFinite(value)) return null;

  // Scale then round: `2.99 * 100` is 298.99999999999994 in IEEE-754, and
  // truncating would lose a paisa on a large fraction of real inputs.
  const minor = Math.round(value * minorFactor(currency));
  if (!Number.isSafeInteger(minor) || Math.abs(minor) > MAX_MINOR) return null;

  return minor;
}

/** Integer minor units back to a major-unit number. Display only. */
export function fromMinor(minor: number, currency: string = DEFAULT_CURRENCY): number {
  return minor / minorFactor(currency);
}

interface FormatOptions {
  /** Prefix positive values with `+` and negatives with `−`. */
  signed?: boolean;
  /** Render the currency symbol. Defaults to true. */
  symbol?: boolean;
  /** Drop the decimal part when the amount is a whole major unit. */
  compact?: boolean;
}

/**
 * Formats minor units for display. Uses a typographic minus (U+2212) rather
 * than a hyphen so figures line up in a tabular-nums column.
 */
export function formatMoney(
  minor: number,
  currency: string = DEFAULT_CURRENCY,
  { signed = false, symbol = true, compact = false }: FormatOptions = {}
): string {
  const safeMinor = Number.isFinite(minor) ? minor : 0;
  const exponent = MINOR_UNIT_EXPONENT[currency.toUpperCase()] ?? 2;
  const digits = compact && safeMinor % minorFactor(currency) === 0 ? 0 : exponent;

  const body = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(fromMinor(safeMinor, currency)));

  const sign = safeMinor < 0 ? "−" : signed ? "+" : "";
  return `${sign}${symbol ? currencySymbol(currency) : ""}${body}`;
}

/** Sums minor-unit amounts. Integer addition, so the result is always exact. */
export function sumMinor(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/**
 * Reads an amount from a document that may predate the minor-units migration.
 *
 * `scripts/migrate-money.mjs` backfills every collection, but a deploy can land
 * before the migration runs, so reads fall back to the legacy float column
 * rather than rendering a balance of zero.
 */
export function readMinor(
  minorValue: number | null | undefined,
  legacyMajor: number | null | undefined,
  currency: string = DEFAULT_CURRENCY
): number {
  if (typeof minorValue === "number" && Number.isFinite(minorValue)) {
    return Math.round(minorValue);
  }
  if (typeof legacyMajor === "number" && Number.isFinite(legacyMajor)) {
    return Math.round(legacyMajor * minorFactor(currency));
  }
  return 0;
}
