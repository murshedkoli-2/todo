interface SparklineProps {
  /** Balance at each point in time, oldest first. Integer minor units. */
  points: number[];
  color?: string;
  className?: string;
  /** Described to assistive tech; the shape itself is decorative. */
  label: string;
}

const WIDTH = 120;
const HEIGHT = 32;

/**
 * Balance history as a single line. Deliberately axis-free and unlabelled — it
 * answers "which way is this going" at a glance, and the exact figure is
 * already rendered next to it.
 */
export default function Sparkline({
  points,
  color = "var(--accent)",
  className = "",
  label,
}: SparklineProps) {
  // A single point has no direction to show, and zero points has nothing.
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  // A flat series would divide by zero; render it as a centred line instead.
  const span = max - min || 1;

  const coordinates = points.map((value, index) => {
    const x = (index / (points.length - 1)) * WIDTH;
    const y = HEIGHT - ((value - min) / span) * (HEIGHT - 4) - 2;
    return [x, y] as const;
  });

  const line = coordinates
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;
  const trendingUp = points[points.length - 1]! >= points[0]!;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={`${label}: trending ${trendingUp ? "up" : "down"}`}
    >
      <path d={area} fill={`color-mix(in srgb, ${color} 14%, transparent)`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
