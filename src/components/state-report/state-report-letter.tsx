"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META } from "@/lib/constants";
import { formatDateLong } from "@/lib/date";
import { tagCellClass } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import type { DailyStateReport } from "@/lib/types";

type Props = {
  report: DailyStateReport;
  locale?: string;
};

export const StateReportLetter = forwardRef<HTMLDivElement, Props>(
  function StateReportLetter({ report, locale = "en-GB" }, ref) {
    const dateLabel = formatDateLong(report.date, locale);
    const tagEntries = Object.entries(report.totals.by_tag).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const status =
      report.status === "pending"
        ? "PENDING"
        : report.status === "approved"
          ? "APPROVED"
          : "REJECTED";

    return (
      <div
        ref={ref}
        className="mx-auto w-full max-w-[210mm] bg-white p-8 text-neutral-900 shadow-sm print:max-w-none print:p-0 print:shadow-none"
      >
        <header className="border-b border-neutral-300 pb-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide">
            {CONSUME_REPORT_META.wing}
          </p>
          <h1 className="mt-1 text-xl font-bold">Daily State Report</h1>
          <p className="mt-1 text-xs text-neutral-600">
            {CONSUME_REPORT_META.orgName} Camp, {CONSUME_REPORT_META.station}
          </p>
        </header>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 text-sm">
          <div>
            <p>
              <span className="font-semibold">Date:</span> {dateLabel}
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              Submitted by {report.submitted_by}
              {report.submitted_at
                ? ` · ${new Date(report.submitted_at).toLocaleString(locale)}`
                : ""}
            </p>
            {report.reviewed_by && report.reviewed_at ? (
              <p className="mt-0.5 text-xs text-neutral-600">
                Reviewed by {report.reviewed_by} ·{" "}
                {new Date(report.reviewed_at).toLocaleString(locale)}
              </p>
            ) : null}
            {report.boro_khana ? (
              <p className="mt-2 text-xs font-semibold text-orange-700">
                Boro Khana day — everyone eats
              </p>
            ) : null}
            {report.note ? (
              <p className="mt-2 text-xs text-rose-700">Note: {report.note}</p>
            ) : null}
          </div>
          <span className="rounded border border-neutral-400 px-2 py-0.5 text-xs font-bold tracking-wide">
            {status}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span>
            Active: <strong>{report.totals.active}</strong>
          </span>
          <span>
            Mess: <strong>{report.totals.mess_eaters}</strong>
          </span>
          {tagEntries.map(([tag, n]) => (
            <span key={tag}>
              {tag}: <strong>{n}</strong>
            </span>
          ))}
        </div>

        <table className="mt-4 w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b-2 border-neutral-800">
              <th className="py-1.5 pr-2 font-semibold">#</th>
              <th className="py-1.5 pr-2 font-semibold">Number</th>
              <th className="py-1.5 pr-2 font-semibold">Rank</th>
              <th className="py-1.5 pr-2 font-semibold">Name</th>
              <th className="py-1.5 pr-2 font-semibold">Wing</th>
              <th className="py-1.5 pr-2 font-semibold">Tag</th>
              {report.boro_khana ? (
                <th className="py-1.5 font-semibold">Mess</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {report.members.length === 0 ? (
              <tr>
                <td colSpan={report.boro_khana ? 7 : 6} className="py-6 text-center text-neutral-500">
                  No active members
                </td>
              </tr>
            ) : (
              report.members.map((m, i) => (
                <tr key={m.user_id} className="border-b border-neutral-200">
                  <td className="py-1.5 pr-2 tabular-nums">{i + 1}</td>
                  <td className="py-1.5 pr-2 font-mono text-[10px]">
                    {m.rab_id}
                  </td>
                  <td className="py-1.5 pr-2">{m.rank}</td>
                  <td className="py-1.5 pr-2 font-medium">{m.name}</td>
                  <td className="py-1.5 pr-2">{m.wing}</td>
                  <td className="py-1.5 pr-2">
                    {m.tag ? (
                      <span
                        className={cn(
                          "inline-block rounded px-1 print:border print:border-neutral-400 print:bg-transparent",
                          tagCellClass(m.tag),
                        )}
                      >
                        {m.tag}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  {report.boro_khana ? (
                    <td className="py-1.5">{m.mess_reason ?? "—"}</td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <footer className="mt-12 grid grid-cols-3 gap-4 text-center text-[10px] text-neutral-700">
          {["Daily SI", "Admin Officer", "Commandant"].map((label) => (
            <div key={label}>
              <div className="mb-8 border-b border-neutral-400" />
              {label}
            </div>
          ))}
        </footer>
      </div>
    );
  },
);
