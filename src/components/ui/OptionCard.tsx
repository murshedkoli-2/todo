"use client";

import { CheckIcon } from "@/components/ui/icons";

interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  /** One line explaining what picking this actually does. */
  copy?: string;
  icon?: React.ReactNode;
  /** Tone for the icon chip and the selected border, e.g. `var(--green)`. */
  color?: string;
  /**
   * The colour to print *on* `color`. White is not a safe default against every
   * fill in the palette — see the `--on-*` note in `globals.css` — so a caller
   * passing a non-accent tone passes its partner token too.
   */
  onColor?: string;
  /** Renders as a radio for assistive tech; the group needs a `role="radiogroup"`. */
  asRadio?: boolean;
}

/**
 * A full-width choice in a wizard step.
 *
 * The wizard's steps are mostly "pick one of these", and a row of pill buttons
 * gave every option the same weight as a filter chip — the user could not tell
 * a branching decision (which changes the following steps) from a label they
 * were tagging something with. A tile with room for an explanation makes the
 * consequence readable before the click, not after it.
 */
export default function OptionCard({
  selected, onSelect, title, copy, icon,
  color = "var(--accent)", onColor = "var(--on-accent)", asRadio = true,
}: OptionCardProps) {
  return (
    <button
      type="button"
      role={asRadio ? "radio" : undefined}
      aria-checked={asRadio ? selected : undefined}
      aria-pressed={asRadio ? undefined : selected}
      onClick={onSelect}
      className="option-card"
      data-selected={selected}
      style={selected ? { borderColor: color, background: `color-mix(in srgb, ${color} 10%, transparent)` } : undefined}
    >
      {icon && (
        <span
          className="w-9 h-9 rounded-well flex items-center justify-center flex-shrink-0 transition-colors duration-fast"
          style={{
            background: selected
              ? `color-mix(in srgb, ${color} 18%, transparent)`
              : "var(--bg-card)",
            color: selected ? color : "var(--text-muted)",
          }}
        >
          {icon}
        </span>
      )}

      <span className="flex-1 min-w-0">
        <span className="option-card-title">{title}</span>
        {copy && <span className="option-card-copy">{copy}</span>}
      </span>

      {selected && (
        <span
          className="option-card-check mt-0.5"
          style={{ background: color, color: onColor }}
          aria-hidden="true"
        >
          <CheckIcon className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
