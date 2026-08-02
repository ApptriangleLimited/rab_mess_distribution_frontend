import { Skeleton } from "@/components/ui/skeleton";

export default function RouteLoading() {
  return (
    <div className="page-pane">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="mt-2 h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
