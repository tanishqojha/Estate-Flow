import { Skeleton } from "@/components/ui/skeleton";

export default function SocialLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-9 rounded-md" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}
