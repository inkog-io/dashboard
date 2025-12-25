"use client";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  className?: string;
}

/**
 * Pure SVG Sparkline component - minimal overhead, no external dependencies.
 * Perfect for showing 7-day trends in dashboard cards.
 */
export function Sparkline({
  data,
  width = 60,
  height = 20,
  color = "#22c55e",
  showArea = true,
  className,
}: SparklineProps) {
  // Handle edge cases
  if (!data || data.length === 0) return null;
  if (data.length === 1) {
    // Single point - render as a small circle
    return (
      <svg width={width} height={height} className={className}>
        <circle cx={width / 2} cy={height / 2} r={2} fill={color} />
      </svg>
    );
  }

  // Calculate bounds with padding
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = height * 0.1;

  // Generate points
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padding + (height - 2 * padding) * (1 - (val - min) / range);
    return { x, y };
  });

  // Build polyline path
  const linePoints = points.map(p => `${p.x},${p.y}`).join(" ");

  // Build area path (for fill)
  const areaPath = showArea
    ? `M0,${height} L${linePoints} L${width},${height} Z`
    : undefined;

  // Determine trend direction for color override
  const isUpward = data[data.length - 1] > data[0];
  const isDanger = color.includes("red") || color.includes("danger");
  const effectiveColor = isDanger ? "#ef4444" : isUpward ? "#22c55e" : "#f59e0b";

  return (
    <svg
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Trend: ${isUpward ? "increasing" : "decreasing"}`}
    >
      {showArea && areaPath && (
        <path
          d={areaPath}
          fill={effectiveColor}
          fillOpacity={0.1}
        />
      )}
      <polyline
        points={linePoints}
        fill="none"
        stroke={effectiveColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End point dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2}
        fill={effectiveColor}
      />
    </svg>
  );
}
