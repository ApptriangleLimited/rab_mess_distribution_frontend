"use client";

import { ForceRankSheet } from "@/components/manpower/force-rank-sheet";
import type { ForceRankReport } from "@/lib/force-rank-report";

export function ForceRankWeb({
  report,
  readOnly,
}: {
  report: ForceRankReport;
  readOnly?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <ForceRankSheet report={report} editable={!readOnly} />
    </div>
  );
}
