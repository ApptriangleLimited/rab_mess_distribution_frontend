"use client";

import { forwardRef, type ReactNode } from "react";
import {
  officialHospitalDays,
  officialLeaveDays,
  officialLeaveTotal,
  toBnDigits,
  type OfficialConsumePack,
  type OfficialConsumeRow,
  type OfficialConsumeTable,
} from "@/lib/consume-official-reports";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { cn } from "@/lib/utils";

type Props = {
  pack: OfficialConsumePack;
  preview?: boolean;
};

const SIGNS = [
  "দৈনিক এসআই",
  "কনজিউম এসআই",
  "সিকিউ এসআই",
  "সিনিয়র ডিএডি (প্রশাসন)",
  "সভাপতি\nমেস কমিটি, ফোর্সেস মেস",
  "মেজর\nউপ-পরিচালক (সদর দপ্তর)\nএসআরবি ফোর্সেস সদর দপ্তর",
] as const;

function cell(n: number) {
  return n ? toBnDigits(n) : "০";
}

function Signs() {
  return <ConsumeSignOff labels={SIGNS} className="text-[9px]" />;
}

function Header({ table }: { table: OfficialConsumeTable }) {
  return (
    <header className="mb-3 text-center">
      <p className="text-[12px] font-bold leading-snug">{table.title}</p>
      {table.lines.map((line) => (
        <p key={line} className="text-[10px] leading-snug">
          {line}
        </p>
      ))}
    </header>
  );
}

function ConsumeTable({ table }: { table: OfficialConsumeTable }) {
  const all = [...table.rows, table.totals];
  const pageCol = table.kind !== "consume-pages" && table.showPageNo;
  return (
    <table className="w-full border-collapse text-[9px] text-black">
      <thead>
        <tr>
          <th className="border border-black px-1 py-1 align-bottom">ক্র/নং</th>
          <th className="border border-black px-1 py-1 text-left align-bottom">
            {table.kind === "consume-pages" ? "পাতা নং" : "উইংয়ের নাম"}
          </th>
          {pageCol ? (
            <th className="border border-black px-1 py-1 align-bottom">পাতা নং</th>
          ) : null}
          <th className="border border-black px-1 py-1 align-bottom">জনবল</th>
          <th className="border border-black px-1 py-1 align-bottom">মেস</th>
          <th className="border border-black px-1 py-1 align-bottom">এফআর</th>
          <th className="border border-black px-1 py-1 align-bottom">সিএল</th>
          <th className="border border-black px-1 py-1 align-bottom">পিএল</th>
          <th className="border border-black px-1 py-1 align-bottom">সিডি</th>
          <th className="border border-black px-1 py-1 align-bottom">ট্রেনিং</th>
          <th className="border border-black px-1 py-1 align-bottom">সাক্ষী</th>
          <th className="border border-black px-1 py-1 align-bottom">হাসপাতাল</th>
          <th className="border border-black px-1 py-1 align-bottom leading-tight">
            রেশন বিহীন
          </th>
          <th className="border border-black px-1 py-1 align-bottom">মোট দিন</th>
          {table.remarks ? (
            <th className="border border-black px-1 py-1 align-bottom">মন্তব্য</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {all.map((row) => (
          <DataRow
            key={row.id}
            row={row}
            pageCol={pageCol}
            remarks={table.remarks}
          >
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.manpower)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.tagDays.MS ?? 0)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.tagDays.FR ?? 0)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.tagDays.CL ?? 0)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.tagDays.PL ?? 0)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.tagDays.CD ?? 0)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.tagDays.TRG ?? 0)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialLeaveDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialHospitalDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.tagDays.WR ?? 0)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.totalDays)}
            </td>
          </DataRow>
        ))}
      </tbody>
    </table>
  );
}

function TagTable({ table }: { table: OfficialConsumeTable }) {
  const all = [...table.rows, table.totals];
  return (
    <table className="w-full border-collapse text-[10px] text-black">
      <thead>
        <tr>
          <th className="border border-black px-1.5 py-1 align-bottom">ক্র/নং</th>
          <th className="border border-black px-1.5 py-1 text-left align-bottom">
            উইংয়ের নাম
          </th>
          {table.showPageNo ? (
            <th className="border border-black px-1.5 py-1 align-bottom">পাতা নং</th>
          ) : null}
          <th className="border border-black px-1.5 py-1 align-bottom">জনবল</th>
          <th className="border border-black px-1.5 py-1 align-bottom">
            {table.tagLabel}
          </th>
          {table.remarks ? (
            <th className="border border-black px-1.5 py-1 align-bottom">মন্তব্য</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {all.map((row) => (
          <DataRow
            key={row.id}
            row={row}
            pageCol={table.showPageNo}
            remarks={table.remarks}
          >
            <td className="border border-black px-1.5 py-1 text-center tabular-nums">
              {cell(row.manpower)}
            </td>
            <td className="border border-black px-1.5 py-1 text-center tabular-nums">
              {cell(
                table.tagLabel?.includes("সিডি")
                  ? (row.tagDays.CD ?? 0)
                  : (row.tagDays.FR ?? 0),
              )}
            </td>
          </DataRow>
        ))}
      </tbody>
    </table>
  );
}

function LeaveTable({ table }: { table: OfficialConsumeTable }) {
  const all = [...table.rows, table.totals];
  return (
    <table className="w-full border-collapse text-[10px] text-black">
      <thead>
        <tr>
          <th className="border border-black px-1 py-1 align-bottom">ক্র/নং</th>
          <th className="border border-black px-1 py-1 text-left align-bottom">
            উইংয়ের নাম
          </th>
          {table.showPageNo ? (
            <th className="border border-black px-1 py-1 align-bottom">পাতা নং</th>
          ) : null}
          {table.showManpower ? (
            <th className="border border-black px-1 py-1 align-bottom">জনবল</th>
          ) : null}
          <th className="border border-black px-1 py-1 align-bottom">সিএল</th>
          <th className="border border-black px-1 py-1 align-bottom">পিএল</th>
          <th className="border border-black px-1 py-1 align-bottom">ট্রেনিং</th>
          <th className="border border-black px-1 py-1 align-bottom">সাক্ষী</th>
          <th className="border border-black px-1 py-1 align-bottom">হাসপাতাল</th>
          <th className="border border-black px-1 py-1 align-bottom">সর্বমোট</th>
          {table.remarks ? (
            <th className="border border-black px-1 py-1 align-bottom">মন্তব্য</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {all.map((row) => (
          <DataRow
            key={row.id}
            row={row}
            pageCol={table.showPageNo}
            remarks={table.remarks}
          >
            {table.showManpower ? (
              <td className="border border-black px-1 py-1 text-center tabular-nums">
                {cell(row.manpower)}
              </td>
            ) : null}
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.tagDays.CL ?? 0)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.tagDays.PL ?? 0)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.tagDays.TRG ?? 0)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialLeaveDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialHospitalDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialLeaveTotal(row.tagDays))}
            </td>
          </DataRow>
        ))}
      </tbody>
    </table>
  );
}

function DataRow({
  row,
  pageCol,
  remarks,
  children,
}: {
  row: OfficialConsumeRow;
  pageCol: boolean;
  remarks: boolean;
  children: ReactNode;
}) {
  const isTotal = row.id === "total";
  return (
    <tr className={cn(isTotal && "font-semibold")}>
      <td className="border border-black px-1 py-1 text-center">
        {row.sl ? toBnDigits(row.sl) : ""}
      </td>
      <td className="border border-black px-1 py-1 text-left">{row.label}</td>
      {pageCol ? (
        <td className="border border-black px-1 py-1 text-center">
          {isTotal ? "" : row.pageNo}
        </td>
      ) : null}
      {children}
      {remarks ? <td className="border border-black px-1 py-1" /> : null}
    </tr>
  );
}

function SheetTable({ table }: { table: OfficialConsumeTable }) {
  if (table.kind === "tag") return <TagTable table={table} />;
  if (table.kind === "leave") return <LeaveTable table={table} />;
  return <ConsumeTable table={table} />;
}

export const OfficialConsumeLetter = forwardRef<HTMLDivElement, Props>(
  function OfficialConsumeLetter({ pack, preview = false }, ref) {
    return (
      <div
        ref={ref}
        data-print-stack="true"
        className={cn(
          "official-consume-letter text-black",
          preview
            ? "mx-auto block w-full max-w-[210mm] space-y-6"
            : "hidden",
        )}
      >
        {pack.pages.map((page) => (
          <section
            key={page.id}
            className={cn(
              "bg-white text-black",
              preview &&
                "rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700",
            )}
          >
            {page.tables.map((table) => (
              <div key={table.title + table.lines.join()} className="mb-8 last:mb-0">
                <Header table={table} />
                <SheetTable table={table} />
                <Signs />
              </div>
            ))}
          </section>
        ))}
      </div>
    );
  },
);
