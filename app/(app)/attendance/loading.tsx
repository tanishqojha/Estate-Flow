import { Skeleton } from "@/components/ui/skeleton";

export default function AttendanceLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-56 rounded-xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}
