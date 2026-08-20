import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import MessPlanningClient from "./planning-client";

export default function MessPlanningPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-40 w-full" />
        </div>
      }
    >
      <MessPlanningClient />
    </Suspense>
  );
}
