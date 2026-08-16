import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import StateReportClient from "./state-report-client";

export default function StateReportPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <StateReportClient />
    </Suspense>
  );
}
