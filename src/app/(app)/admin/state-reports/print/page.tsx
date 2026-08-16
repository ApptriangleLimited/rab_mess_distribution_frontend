import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StateReportPrintClient } from "@/components/state-report/state-report-print-client";

export default function AdminStateReportPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      }
    >
      <StateReportPrintClient backBase="/admin/state-reports" />
    </Suspense>
  );
}
