import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import RationMonthlyClient from "./ration-monthly-client";

export default function RationMonthlyPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      }
    >
      <RationMonthlyClient />
    </Suspense>
  );
}
