interface ProgressBarProps {
  /** 0–100. Clamped internally. */
  value: number;
  /** Fill colour; defaults to the positive green from the design system. */
  color?: string;
  className?: string;
  label?: string;
}

export default function ProgressBar({ value, color, className = "", label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <div
      className={`progress-track ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
