import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** KPI stat tile — a headline number is not a chart (dataviz form rule). */
export function StatTile({
  label,
  value,
  icon: Icon,
  href,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  href?: string;
  sub?: string;
  tone?: "default" | "attention";
}) {
  const body = (
    <Card
      className={cn(
        "flex h-full flex-col gap-1 p-4 transition-[background-color,border-color,box-shadow]",
        href &&
          "group-hover:border-ring/40 group-hover:bg-accent/60 group-active:bg-accent",
        tone === "attention" && "border-[var(--viz-critical)]/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-balance text-muted-foreground">{label}</p>
        <Icon
          className={cn(
            "size-4 shrink-0",
            tone === "attention" ? "text-[var(--viz-critical)]" : "text-muted-foreground",
          )}
          aria-hidden
        />
      </div>
      <p className="text-2xl font-bold leading-tight tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
  return href ? (
    <Link
      href={href}
      className="group block h-full rounded-xl outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {body}
    </Link>
  ) : (
    body
  );
}
