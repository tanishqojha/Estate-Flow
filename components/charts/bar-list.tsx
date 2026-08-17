/**
 * Horizontal category bars for a single measure (magnitude across categories):
 * one hue, direct value labels in ink (never series color), recessive track.
 * Values are visible text, so the data reads without color or hover.
 */
export interface BarListItem {
  label: string;
  value: number;
}

export function BarList({ items, title }: { items: BarListItem[]; title: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div role="img" aria-label={`${title}: ${items.map((i) => `${i.label} ${i.value}`).join(", ")}`}>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.label} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2">
            <span className="truncate text-xs text-[var(--viz-ink-secondary)]">{item.label}</span>
            <span className="h-4 overflow-hidden rounded-[4px] bg-[var(--viz-track)]">
              <span
                className="chart-bar-x block h-full rounded-[4px] bg-[var(--viz-series-1)]"
                style={{
                  width: `${Math.max(item.value > 0 ? 3 : 0, (item.value / max) * 100)}%`,
                  animationDelay: `${i * 40}ms`,
                }}
              />
            </span>
            <span className="text-right text-xs font-medium tabular-nums text-[var(--viz-ink)]">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
