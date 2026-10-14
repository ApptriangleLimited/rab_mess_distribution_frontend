import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import MemberFullListReportClient from "@/app/(app)/cc/users/list-report/list-report-client";

export default function DailyRosterFullReportPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      }
    >
      <MemberFullListReportClient listHref="/daily/roster" />
    </Suspense>
  );
}
