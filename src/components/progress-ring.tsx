export function ProgressRing({ value, size = 58, stroke = 5, color = "#315c4c" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <span className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle className="ring-value" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} stroke={color} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <strong>{value}<small>%</small></strong>
    </span>
  );
}
