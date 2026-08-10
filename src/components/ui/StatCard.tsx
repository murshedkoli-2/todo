import ProgressBar from "@/components/ui/ProgressBar";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  /** Pre-formatted string, or a `<Money>` element for currency figures. */
  value: React.ReactNode;
  hint?: string;
  /** Accent for the icon tile, active border, and progress fill. */
  color: string;
  /** Renders a share-of-total bar under the label when provided. */
  progress?: number;
  /** Turns the card into a filter toggle. */
  onClick?: () => void;
  active?: boolean;
}

export default function StatCard({
  icon, label, value, hint, color, progress, onClick, active = false,
}: StatCardProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={`card-tile !p-4 sm:!p-5 ${onClick ? "cursor-pointer" : ""}`}
      style={{
        borderColor: active ? color : undefined,
        boxShadow: active
          ? `0 0 0 3px color-mix(in srgb, ${color} 18%, transparent)`
          : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className="w-10 h-10 rounded-well flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
        >
          {icon}
        </span>
        <span className="mt-1 min-w-0 truncate text-right">{value}</span>
      </div>

      <p
        className="text-sm font-semibold"
        style={active ? { color } : undefined}
      >
        <span className={active ? "" : "text-ink"}>{label}</span>
      </p>

      {hint && <p className="text-xs mt-0.5 truncate text-ink-muted">{hint}</p>}

      {progress !== undefined && (
        <ProgressBar
          value={progress}
          color={color}
          className="mt-3 !flex-none"
          label={`${label} share`}
        />
      )}
    </Tag>
  );
}
