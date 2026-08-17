import { Skeleton } from "@/components/ui/skeleton";

export default function PropertiesLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-10 rounded-md" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}
