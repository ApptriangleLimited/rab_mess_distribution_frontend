import { Skeleton } from "@/components/ui/skeleton";

export default function CcUsersLoading() {
  return (
    <div className="page-pane">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-4 h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
