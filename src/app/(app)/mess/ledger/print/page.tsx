import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import MessLedgerPrintClient from "./print-client";

export default function MessLedgerPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      }
    >
      <MessLedgerPrintClient />
    </Suspense>
  );
}
