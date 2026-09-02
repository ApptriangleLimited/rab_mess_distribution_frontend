import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ManpowerClient from "./manpower-client";

export default function ManpowerPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      }
    >
      <ManpowerClient />
    </Suspense>
  );
}
