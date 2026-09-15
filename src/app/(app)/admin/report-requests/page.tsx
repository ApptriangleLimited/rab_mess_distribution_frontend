import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import AdminReportRequestsClient from "./report-requests-client";

export default function AdminReportRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-40 w-full" />
        </div>
      }
    >
      <AdminReportRequestsClient />
    </Suspense>
  );
}
