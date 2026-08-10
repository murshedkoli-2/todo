import { formatMoney } from "@/lib/money";

type MoneySize = "sm" | "md" | "lg" | "hero";
type MoneyTone = "auto" | "positive" | "negative" | "neutral" | "inherit";

interface MoneyProps {
  /** Integer minor units. */
  minor: number;
  currency?: string;
  size?: MoneySize;
  /**
   * `auto` colours by sign — the default for balances, where direction is the
   * point. Use `neutral` for figures where sign carries no meaning.
   */
  tone?: MoneyTone;
  /** Prefix positives with `+`. Only meaningful alongside `tone="auto"`. */
  signed?: boolean;
  /** Drop the decimals when the amount is a whole major unit. */
  compact?: boolean;
  className?: string;
}

const SIZE_CLASS: Record<MoneySize, string> = {
  sm: "money-sm",
  md: "money-md",
  lg: "money-lg",
  hero: "money-hero",
};

function toneClass(tone: MoneyTone, minor: number): string {
  if (tone === "inherit") return "";
  if (tone === "auto") {
    if (minor > 0) return "money-positive";
    if (minor < 0) return "money-negative";
    return "money-neutral";
  }
  return `money-${tone}`;
}

/**
 * The single place an amount is rendered.
 *
 * Every call site previously formatted inline with its own `Intl` instance and
 * hard-coded `৳`, which is how the same value ended up styled four different
 * ways across three pages.
 */
export default function Money({
  minor,
  currency = "BDT",
  size = "md",
  tone = "auto",
  signed = false,
  compact = false,
  className = "",
}: MoneyProps) {
  const text = formatMoney(minor, currency, { signed, compact });

  return (
    <span
      className={`money ${SIZE_CLASS[size]} ${toneClass(tone, minor)} ${className}`.trim()}
    >
      {text}
    </span>
  );
}
