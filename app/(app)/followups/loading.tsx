import { Skeleton } from "@/components/ui/skeleton";

export default function FollowupsLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-32" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}
