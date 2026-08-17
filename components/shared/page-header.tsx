import { cn } from "@/lib/utils";

/**
 * Standard page heading: title (+ optional subtitle) on the left, an optional
 * primary action on the right. Centralizes what every top-level screen used to
 * hand-roll, so title size, tracking and the title/action baseline stay
 * identical across the app.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-balance text-xl font-bold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
