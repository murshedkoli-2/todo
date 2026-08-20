import { PRIORITY_LABELS, PRIORITY_SHORT_LABELS, PRIORITY_TEXT_COLORS } from "@/lib/types";
import type { TodoPriority } from "@/lib/schemas/todo";
import { FlagIcon } from "@/components/ui/icons";

interface PriorityFlagProps {
  priority: TodoPriority;
  /** `flag` for dense surfaces, `pill` where the level needs naming. */
  variant?: "flag" | "pill";
  className?: string;
}

/** Tint matching the level, for the pill's surface. */
const TINT: Record<TodoPriority, string> = {
  none: "var(--bg-sunken)",
  low: "var(--bg-sunken)",
  medium: "var(--accent-dim)",
  high: "var(--orange-soft)",
  urgent: "var(--red-soft)",
};

/**
 * Priority indicator.
 *
 * `none` renders nothing at all rather than a grey "No priority" chip: an
 * untriaged task should look untriaged, and a badge on every card would make
 * the three real levels harder to pick out, not easier — which is the whole
 * point of having them.
 */
export default function PriorityFlag({
  priority, variant = "flag", className = "",
}: PriorityFlagProps) {
  if (priority === "none") return null;

  const color = PRIORITY_TEXT_COLORS[priority];
  const label = PRIORITY_LABELS[priority];

  if (variant === "pill") {
    return (
      <span
        className={`pill ${className}`}
        style={{ background: TINT[priority], color }}
        title={label}
      >
        <FlagIcon className="w-3.5 h-3.5" aria-hidden="true" />
        {PRIORITY_SHORT_LABELS[priority]}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ color }}
      title={label}
    >
      {/* The icon alone carries no meaning to a screen reader, so the level is
          spelled out here rather than left to the colour. */}
      <span className="sr-only">{label}</span>
      <FlagIcon className="w-3.5 h-3.5" aria-hidden="true" />
    </span>
  );
}
