/**
 * Small single-series daily trend (SVG bars): one hue, rounded data-ends
 * anchored to the baseline, 2px gaps, sparse muted tick labels, native
 * per-bar tooltips via <title>. Single series → no legend (title names it).
 */
export interface TrendPoint {
  label: string;
  value: number;
}

const W = 320;
const H = 96;
const BASELINE_Y = H - 16;
const TOP_PAD = 12;

export function TrendBars({ points, title }: { points: TrendPoint[]; title: string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const gap = 2;
  const barW = (W - gap * (points.length - 1)) / points.length;
  const plotH = BASELINE_Y - TOP_PAD;

  // Sparse ticks: first, middle, last
  const tickIdx = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`${title}: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}`}
    >
      <line
        x1={0}
        y1={BASELINE_Y}
        x2={W}
        y2={BASELINE_Y}
        stroke="var(--viz-baseline)"
        strokeWidth={1}
      />
      {points.map((p, i) => {
        const h = p.value === 0 ? 0 : Math.max(3, (p.value / max) * plotH);
        const x = i * (barW + gap);
        const isMax = p.value === max && max > 0;
        return (
          <g key={p.label}>
            {h > 0 ? (
              <rect
                x={x}
                y={BASELINE_Y - h}
                width={barW}
                height={h}
                rx={Math.min(4, barW / 2)}
                fill="var(--viz-series-1)"
                className="chart-bar-y"
                style={{ animationDelay: `${i * 28}ms` }}
              >
                <title>{`${p.label}: ${p.value}`}</title>
              </rect>
            ) : (
              <rect x={x} y={BASELINE_Y - 1} width={barW} height={1} fill="var(--viz-grid)">
                <title>{`${p.label}: 0`}</title>
              </rect>
            )}
            {isMax ? (
              <text
                x={x + barW / 2}
                y={BASELINE_Y - h - 4}
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                fill="var(--viz-ink)"
              >
                {p.value}
              </text>
            ) : null}
            {tickIdx.has(i) ? (
              <text
                x={x + barW / 2}
                y={H - 4}
                textAnchor="middle"
                fontSize={9}
                fill="var(--viz-muted)"
              >
                {p.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
