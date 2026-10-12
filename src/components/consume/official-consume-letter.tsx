"use client";

import { forwardRef, type ReactNode } from "react";
import {
  officialBghDays,
  officialFrDays,
  officialLeaveTotal,
  officialLnkDays,
  officialMedDays,
  officialMsDays,
  officialWitDays,
  officialWrDays,
  type OfficialConsumePack,
  type OfficialConsumeRow,
  type OfficialConsumeTable,
} from "@/lib/consume-official-reports";
import { consumeHqLine } from "@/components/consume/consume-report-masthead";
import { ConsumeSignOff } from "@/components/consume/consume-sign-off";
import { cn } from "@/lib/utils";

type Props = {
  pack: OfficialConsumePack;
  preview?: boolean;
};

const SIGNS = [
  "Daily SI",
  "Consume SI",
  "Mess CQ SI",
  "Senior DAD (Admin)",
  "President\nMess Committee, Forces Mess",
  "Major\nDeputy Director (HQ)\nSRB Forces Headquarters",
] as const;

function cell(n: number) {
  return n ? String(n) : "0";
}

function Signs() {
  return (
    <ConsumeSignOff labels={SIGNS} className="mt-0 text-[9px]" centerAll />
  );
}

function tableColCount(table: OfficialConsumeTable) {
  if (table.kind === "tag") {
    return 4 + (table.showPageNo ? 1 : 0) + (table.remarks ? 1 : 0);
  }
  if (table.kind === "leave") {
    return (
      10 +
      (table.showPageNo ? 1 : 0) +
      (table.showManpower ? 1 : 0) +
      (table.remarks ? 1 : 0)
    );
  }
  const pageCol = table.kind !== "consume-pages" && table.showPageNo;
  return 15 + (pageCol ? 1 : 0) + (table.remarks ? 1 : 0);
}

function TitleHead({ table }: { table: OfficialConsumeTable }) {
  return (
    <tr className="official-title-row">
      <th
        colSpan={tableColCount(table)}
        className="official-title-cell border-0 bg-white pb-3 text-center"
      >
        <div className="consume-masthead letter-masthead">
          <p className="text-[16px] font-bold leading-snug">{table.title}</p>
          <p className="mt-1.5 text-[9px] font-normal leading-snug text-neutral-400">
            {consumeHqLine()}
          </p>
        </div>
      </th>
    </tr>
  );
}

function ConsumeTable({ table }: { table: OfficialConsumeTable }) {
  const all = [...table.rows, table.totals];
  const pageCol = table.kind !== "consume-pages" && table.showPageNo;
  return (
    <table className="w-full border-collapse text-[9px] text-black">
      <thead>
        <TitleHead table={table} />
        <tr className="consume-col-titles">
          <th className="border border-black px-1 py-1 align-bottom">SL</th>
          <th className="border border-black px-1 py-1 align-bottom">
            {table.kind === "consume-pages" ? "Page no" : "Wing"}
          </th>
          {pageCol ? (
            <th className="border border-black px-1 py-1 align-bottom">
              Page no
            </th>
          ) : null}
          <th className="border border-black px-1 py-1 align-bottom">
            Manpower
          </th>
          <th className="border border-black px-1 py-1 align-bottom">MS</th>
          <th className="border border-black px-1 py-1 align-bottom">FR</th>
          <th className="border border-black px-1 py-1 align-bottom">CL</th>
          <th className="border border-black px-1 py-1 align-bottom">PL</th>
          <th className="border border-black px-1 py-1 align-bottom">CD</th>
          <th className="border border-black px-1 py-1 align-bottom">TRG</th>
          <th className="border border-black px-1 py-1 align-bottom">WT</th>
          <th className="border border-black px-1 py-1 align-bottom">MED</th>
          <th className="border border-black px-1 py-1 align-bottom">BGH</th>
          <th className="border border-black px-1 py-1 align-bottom">LNK</th>
          <th className="border border-black px-1 py-1 align-bottom">WR</th>
          <th className="border border-black px-1 py-1 align-bottom">
            Total days
          </th>
          {table.remarks ? (
            <th className="border border-black px-1 py-1 align-bottom">
              Remarks
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {all.map((row) => (
          <DataRow
            key={row.id}
            row={row}
            pageCol={pageCol}
            centerLabel={table.kind === "consume-pages"}
            remarks={table.remarks}
          >
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(row.manpower)}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialMsDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialFrDays(row.tagDays))}
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
              {cell(officialWitDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialMedDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialBghDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialLnkDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialWrDays(row.tagDays))}
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
  const isCd = (table.tagLabel ?? "").toUpperCase().includes("CD");
  return (
    <table className="w-full border-collapse text-[10px] text-black">
      <thead>
        <TitleHead table={table} />
        <tr className="consume-col-titles">
          <th className="border border-black px-1.5 py-1 align-bottom">SL</th>
          <th className="border border-black px-1.5 py-1 align-bottom">
            Wing
          </th>
          {table.showPageNo ? (
            <th className="border border-black px-1.5 py-1 align-bottom">
              Page no
            </th>
          ) : null}
          <th className="border border-black px-1.5 py-1 align-bottom">
            Manpower
          </th>
          <th className="border border-black px-1.5 py-1 align-bottom">
            {table.tagLabel ?? (isCd ? "Total CD" : "Total FR")}
          </th>
          {table.remarks ? (
            <th className="border border-black px-1.5 py-1 align-bottom">
              Remarks
            </th>
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
              {cell(isCd ? (row.tagDays.CD ?? 0) : officialFrDays(row.tagDays))}
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
        <TitleHead table={table} />
        <tr className="consume-col-titles">
          <th className="border border-black px-1 py-1 align-bottom">SL</th>
          <th className="border border-black px-1 py-1 align-bottom">
            Wing
          </th>
          {table.showPageNo ? (
            <th className="border border-black px-1 py-1 align-bottom">
              Page no
            </th>
          ) : null}
          {table.showManpower ? (
            <th className="border border-black px-1 py-1 align-bottom">
              Manpower
            </th>
          ) : null}
          <th className="border border-black px-1 py-1 align-bottom">CL</th>
          <th className="border border-black px-1 py-1 align-bottom">PL</th>
          <th className="border border-black px-1 py-1 align-bottom">TRG</th>
          <th className="border border-black px-1 py-1 align-bottom">WT</th>
          <th className="border border-black px-1 py-1 align-bottom">MED</th>
          <th className="border border-black px-1 py-1 align-bottom">BGH</th>
          <th className="border border-black px-1 py-1 align-bottom">LNK</th>
          <th className="border border-black px-1 py-1 align-bottom">Total</th>
          {table.remarks ? (
            <th className="border border-black px-1 py-1 align-bottom">
              Remarks
            </th>
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
              {cell(officialWitDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialMedDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialBghDays(row.tagDays))}
            </td>
            <td className="border border-black px-1 py-1 text-center tabular-nums">
              {cell(officialLnkDays(row.tagDays))}
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
  centerLabel = false,
  remarks,
  children,
}: {
  row: OfficialConsumeRow;
  pageCol: boolean;
  centerLabel?: boolean;
  remarks: boolean;
  children: ReactNode;
}) {
  const isTotal = row.id === "total";
  const leadSpan = 2 + (pageCol ? 1 : 0);
  if (isTotal) {
    return (
      <tr className="font-semibold">
        <td
          colSpan={leadSpan}
          className="border border-black px-1 py-1 text-left"
        >
          {row.label || "Total"}
        </td>
        {children}
        {remarks ? <td className="border border-black px-1 py-1" /> : null}
      </tr>
    );
  }
  return (
    <tr>
      <td className="border border-black px-1 py-1 text-center">
        {row.sl || ""}
      </td>
      <td
        className={cn(
          "border border-black px-1 py-1",
          centerLabel ? "consume-page-no text-center" : "text-left",
        )}
      >
        {row.label}
      </td>
      {pageCol ? (
        <td className="consume-page-no border border-black px-1 py-1 text-center">
          {row.pageNo}
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
              "official-consume-page flex flex-col bg-white text-black",
              preview &&
                "min-h-[277mm] rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700",
            )}
          >
            <div className="min-w-0 flex-1">
              {page.tables.map((table, tableIndex) => (
                <div
                  key={`${page.id}-${tableIndex}-${table.rows[0]?.id ?? table.title}`}
                  className="mb-8 last:mb-0"
                >
                  <SheetTable table={table} />
                </div>
              ))}
            </div>
            <div className="consume-bill-signs">
              <Signs />
            </div>
          </section>
        ))}
      </div>
    );
  },
);
