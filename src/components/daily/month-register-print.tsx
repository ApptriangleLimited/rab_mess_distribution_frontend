"use client";

import { forwardRef } from "react";
import {
  groupRegisterRowsByWing,
  wingPrintOrderFrom,
} from "@/lib/daily-register-wings";
import { useStore } from "@/hooks/use-store";
import { formatMonthDash, formatMonthLong } from "@/lib/date";
import type { LedgerRow } from "@/lib/reports";
import { tagPrintClass, tagPrintCss, tagPrintFill } from "@/lib/tag-colors";
import { isTrgTag, resolveTrgTone } from "@/lib/trg-tone";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  /** Calendar day numbers shown as columns (1-based). */
  dayNumbers: number[];
  /** `row.days` length must match `dayNumbers`. */
  rows: LedgerRow[];
  /** Show for on-screen review / iframe print capture. */
  preview?: boolean;
};

/** Landscape attendance register — matches paper garrison register layout. */
export const MonthRegisterPrint = forwardRef<HTMLDivElement, Props>(
  function MonthRegisterPrint(
    { month, dayNumbers, rows, preview = false },
    ref,
  ) {
    const state = useStore();
    const monthEn = formatMonthLong(month);
    const coverMonth = formatMonthDash(month);
    const coverTitle = "Attendance Register";
    const sheetTitle = `Attendance Register — ${monthEn}`;

    const dayLabel = (d: number) => String(d);
    const serLabel = (n: number) => String(n);
    const blocks = groupRegisterRowsByWing(
      rows,
      wingPrintOrderFrom(
        state.wings,
        state.wing_parent,
        state.wing_serials ?? {},
      ),
    );

    return (
      <div
        ref={ref}
        data-print-stack="true"
        className={cn(
          "month-register-print text-black",
          preview
            ? "mx-auto block w-[297mm] overflow-visible bg-white text-neutral-900 shadow-sm print:w-full print:max-w-none print:shadow-none"
            : "hidden print:block",
        )}
      >
        <section className="register-cover mb-4 flex h-[210mm] w-[297mm] items-center justify-center bg-[#f4e25a] p-8 print:mb-0 print:h-auto print:w-full">
          <div className="register-cover-label border-[3px] border-double border-black bg-white px-16 py-12 text-center text-black">
            <p className="register-cover-title text-3xl font-bold tracking-wide text-black">
              {coverTitle}
            </p>
            <p className="register-cover-month mt-3 text-lg font-semibold text-black underline decoration-black underline-offset-4">
              {coverMonth}
            </p>
          </div>
        </section>

        <style>{tagPrintCss()}</style>
        {blocks.map((block) => (
        <section
          key={block.key}
          className="register-sheet mb-6 box-border min-h-[210mm] w-[297mm] bg-white p-4 print:mb-0 print:w-full print:p-0 last:mb-0"
        >
        <div className="letter-masthead mb-8 text-center">
          <p className="text-sm font-bold">{block.label}</p>
          <p className="mt-0.5 text-[11px] font-semibold">
            SRB Forces Headquarters
          </p>
          <p className="mt-1 text-[11px] font-semibold">{sheetTitle}</p>
        </div>

        <table className="w-full table-fixed border-collapse text-[8px] leading-tight">
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "12%" }} />
            {dayNumbers.map((d, i) => (
              <col key={`${d}-${i}`} />
            ))}
          </colgroup>
          <thead>
            <tr className="border border-black bg-neutral-100">
              <th className="border border-black px-0 py-0.5">No.</th>
              <th className="border border-black px-0 py-0.5 text-left">
                Personal no
              </th>
              <th className="border border-black px-0 py-0.5 text-left">
                Rank
              </th>
              <th className="border border-black px-0 py-0.5 text-left">
                Name
              </th>
              {dayNumbers.map((d, i) => (
                <th key={`${d}-${i}`} className="border border-black px-0 py-0.5">
                  {dayLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
                <tr key={row.user.id}>
                  <td className="overflow-hidden border border-black px-0 py-0 text-center tabular-nums">
                    {serLabel(i + 1)}
                  </td>
                  <td className="overflow-hidden border border-black px-0 py-0 font-mono truncate">
                    {row.user.personal_id || "—"}
                  </td>
                  <td className="overflow-hidden border border-black px-0 py-0 truncate">
                    {row.user.rank}
                  </td>
                  <td className="overflow-hidden border border-black px-0 py-0 text-left truncate">
                    {row.user.name}
                  </td>
                  {row.days.map((tag, di) => {
                    if (!tag) {
                      return (
                        <td
                          key={`${row.user.id}-${di}`}
                          className="border border-black px-0 py-0"
                        />
                      );
                    }
                    const tone = isTrgTag(tag)
                      ? resolveTrgTone(row.user.force)
                      : undefined;
                    const fill = tagPrintFill(tag, tone);
                    return (
                      <td
                        key={`${row.user.id}-${di}`}
                        className={cn(
                          tagPrintClass(tag, tone),
                          "border border-black px-0 py-0 text-center font-mono text-[7px] font-bold leading-none",
                        )}
                        style={{ backgroundColor: fill.bg, color: fill.fg }}
                      >
                        {tag}
                      </td>
                    );
                  })}
                </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 flex justify-end text-center text-[7px] leading-tight">
          <div className="w-[7.5rem] pt-7">
            <div className="mb-1.5 h-px w-full bg-black" />
            <p>Daily SI</p>
            <p className="mt-0.5 font-semibold">{block.label}</p>
          </div>
        </div>
        </section>
        ))}
      </div>
    );
  },
);
