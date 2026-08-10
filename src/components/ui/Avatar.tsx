/**
 * Initial-based avatar. `variant="square"` renders the rounded-square logo
 * badge used in the top-right of grid cards; `variant="circle"` renders the
 * stacked member avatars.
 */

type AvatarSize = "sm" | "md" | "lg";

/**
 * Semantic colour names rather than raw `var(--…)` strings, because the glyph
 * colour cannot be derived from an arbitrary CSS colour: a saturated fill and
 * that same colour's pale tint need *opposite* text treatments, and only the
 * token set knows which is which.
 */
export type AvatarTone = "accent" | "purple" | "green" | "yellow" | "orange" | "red";

interface AvatarProps {
  name: string;
  /** Overrides the deterministic colour picked from `name`. */
  tone?: AvatarTone;
  size?: AvatarSize;
  variant?: "square" | "circle";
  /** Filled background instead of a 16%-alpha tint. */
  solid?: boolean;
  className?: string;
  title?: string;
}

const SIZES: Record<AvatarSize, string> = {
  sm: "w-7 h-7 text-[11px]",
  md: "w-9 h-9 text-xs",
  lg: "w-11 h-11 text-sm",
};

/**
 * Each tone carries its own two text colours:
 *
 *   `onFill` — for the glyph on the saturated background (`solid`)
 *   `onTint` — for the glyph on the 16% wash (the default)
 *
 * These are not interchangeable. Printing the fill colour on its own tint,
 * which is what this component used to do, measures 1.8:1–3.8:1 in the light
 * theme; `onTint` clears 4.5:1 for every tone.
 */
const TONES: Record<AvatarTone, { fill: string; onFill: string; onTint: string }> = {
  accent: { fill: "var(--accent)", onFill: "var(--on-accent)", onTint: "var(--accent-ink)" },
  purple: { fill: "var(--purple)", onFill: "var(--on-purple)", onTint: "var(--purple-ink)" },
  green:  { fill: "var(--green)",  onFill: "var(--on-green)",  onTint: "var(--green-ink)" },
  yellow: { fill: "var(--yellow)", onFill: "var(--on-yellow)", onTint: "var(--yellow-ink)" },
  orange: { fill: "var(--orange)", onFill: "var(--on-orange)", onTint: "var(--orange-ink)" },
  red:    { fill: "var(--red)",    onFill: "var(--on-red)",    onTint: "var(--red-ink)" },
};

const TONE_ORDER: readonly AvatarTone[] = [
  "accent",
  "purple",
  "green",
  "yellow",
  "orange",
  "red",
];

/** Deterministic palette pick so the same name always gets the same colour. */
export function toneForName(name: string): AvatarTone {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return TONE_ORDER[hash % TONE_ORDER.length];
}

export default function Avatar({
  name,
  tone,
  size = "md",
  variant = "circle",
  solid = false,
  className = "",
  title,
}: AvatarProps) {
  const { fill, onFill, onTint } = TONES[tone ?? toneForName(name)];
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className={`${variant === "square" ? "avatar-badge" : "avatar-ring"} ${SIZES[size]} ${className}`}
      style={
        solid
          ? { background: fill, color: onFill }
          : {
              // `background` is declared twice on purpose: browsers without
              // `color-mix` keep the flat sunken fill instead of going transparent.
              background: "var(--bg-sunken)",
              backgroundImage: `linear-gradient(color-mix(in srgb, ${fill} 16%, transparent), color-mix(in srgb, ${fill} 16%, transparent))`,
              color: onTint,
            }
      }
      title={title ?? name}
    >
      {initial}
    </span>
  );
}
