"use client";

export interface Segment<T extends string> {
  value: T;
  label: string;
  color: string;
  icon?: React.ReactNode;
}

interface SegmentedToggleProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** Two-or-more-way switch used for receivable/payable and credit/debit choices. */
export default function SegmentedToggle<T extends string>({
  segments, value, onChange, ariaLabel,
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-1 p-1 rounded-well"
      style={{
        background: "var(--bg-sunken)",
        gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))`,
      }}
    >
      {segments.map((segment) => {
        const active = value === segment.value;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(segment.value)}
            className="flex items-center justify-center gap-1.5 h-9 rounded-control text-xs font-bold px-2"
            style={{
              background: active ? "var(--bg-card)" : "transparent",
              color: active ? segment.color : "var(--text-secondary)",
              boxShadow: active ? "var(--shadow-xs)" : "none",
            }}
          >
            {segment.icon}
            <span className="truncate">{segment.label}</span>
          </button>
        );
      })}
    </div>
  );
}
