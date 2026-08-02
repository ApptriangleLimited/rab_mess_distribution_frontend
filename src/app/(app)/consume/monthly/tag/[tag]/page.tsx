import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ConsumeTagMembersClient from "./tag-members-client";

export default function ConsumeTagMembersPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      }
    >
      <ConsumeTagMembersClient />
    </Suspense>
  );
}
