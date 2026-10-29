"use client";

import { forwardRef } from "react";
import { ForceRankSheet } from "@/components/manpower/force-rank-sheet";
import {
  ManpowerVerifiedByFooter,
  ManpowerVerifiedWatermark,
} from "@/components/manpower/verified-by-footer";
import type { ForceRankReport } from "@/lib/force-rank-report";
import { cn } from "@/lib/utils";

type Props = {
  report: ForceRankReport;
  verified?: boolean;
};

/** A4 landscape print of দৈনিক শক্তি প্রতিবেদন. */
export const ForceRankLetter = forwardRef<HTMLDivElement, Props>(
  function ForceRankLetter({ report, verified = false }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "force-rank-letter relative box-border mx-auto block w-[297mm] min-h-[210mm] overflow-visible",
          "bg-white p-4 text-neutral-900 shadow-sm",
          "print:w-full print:max-w-none print:p-0 print:shadow-none",
        )}
      >
        <ManpowerVerifiedWatermark show={verified} />
        <div className="relative z-[1]">
          <ForceRankSheet report={report} compact />
          <ManpowerVerifiedByFooter show={verified} className="mt-6" />
        </div>
      </div>
    );
  },
);
