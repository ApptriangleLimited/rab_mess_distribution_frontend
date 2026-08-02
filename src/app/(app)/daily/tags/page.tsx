import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import TagsPageClient from "./tags-client";

export default function TagsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-pane">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <TagsPageClient />
    </Suspense>
  );
}
