/**
 * Two-segment outcome split (won vs lost). Outcomes are states, so the
 * reserved status colors apply — always paired with visible labels + counts
 * (never color alone). 2px surface gap between segments.
 */
export function SplitBar({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
}) {
  const total = leftValue + rightValue;
  const leftPct = total === 0 ? 50 : (leftValue / total) * 100;

  return (
    <div
      role="img"
      aria-label={`${leftLabel} ${leftValue}, ${rightLabel} ${rightValue}`}
      className="space-y-2"
    >
      <div className="chart-bar-x flex h-5 w-full gap-[2px] overflow-hidden">
        <span
          className="rounded-[4px] bg-[var(--viz-good)]"
          style={{ width: `${total === 0 ? 50 : Math.max(leftValue > 0 ? 4 : 0, leftPct)}%` }}
        />
        <span
          className="flex-1 rounded-[4px] bg-[var(--viz-critical)]"
          style={{ opacity: total === 0 ? 0.25 : 1 }}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 text-[var(--viz-ink-secondary)]">
          <span className="size-2 rounded-full bg-[var(--viz-good)]" aria-hidden />
          {leftLabel}{" "}
          <span className="font-semibold tabular-nums text-[var(--viz-ink)]">{leftValue}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[var(--viz-ink-secondary)]">
          <span className="size-2 rounded-full bg-[var(--viz-critical)]" aria-hidden />
          {rightLabel}{" "}
          <span className="font-semibold tabular-nums text-[var(--viz-ink)]">{rightValue}</span>
        </span>
      </div>
    </div>
  );
}
