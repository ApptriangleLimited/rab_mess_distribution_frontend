import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import CcUsersPrintClient from "@/app/(app)/cc/users/print/print-client";

export default function DailyRosterPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      }
    >
      <CcUsersPrintClient listHref="/daily/roster" />
    </Suspense>
  );
}
