import type { ReactNode } from "react";

interface Props {
  progress: number; // 0..1
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}

export function ProgressRing({
  progress,
  color,
  size = 260,
  stroke = 12,
  children
}: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="ring-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-progress"
        />
      </svg>
      <div className="ring-inner">{children}</div>
    </div>
  );
}
