"use client";

import { forwardRef, type ReactNode } from "react";
import {
  officialBghDays,
  officialFrDays,
  officialLeaveTotal,
  officialMedDays,
  officialMsDays,
  officialWitDays,
  officialWrDays,
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
  return <ConsumeSignOff labels={SIGNS} className="text-[9px]" />;
}

function Header({ table }: { table: OfficialConsumeTable }) {
  const [first, ...rest] = table.lines;
  return (
    <header className="letter-masthead mb-10 text-center">
      <p className="text-[16px] font-bold leading-snug">{table.title}</p>
      {first ? (
        <p className="mt-1.5 text-[9px] font-normal leading-snug text-neutral-400">
          {first}
        </p>
      ) : null}
      {rest.map((line) => (
        <p
          key={line}
          className="text-[9px] font-normal leading-snug text-neutral-400"
        >
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
          <th className="border border-black px-1 py-1 align-bottom">SL</th>
          <th className="border border-black px-1 py-1 text-left align-bottom">
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
        <tr>
          <th className="border border-black px-1.5 py-1 align-bottom">SL</th>
          <th className="border border-black px-1.5 py-1 text-left align-bottom">
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
        <tr>
          <th className="border border-black px-1 py-1 align-bottom">SL</th>
          <th className="border border-black px-1 py-1 text-left align-bottom">
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
        {row.sl || ""}
      </td>
      <td className="border border-black px-1 py-1 text-left">
        {isTotal ? row.label || "Total" : row.label}
      </td>
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
              "official-consume-page bg-white text-black",
              preview &&
                "rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700",
            )}
          >
            {page.tables.map((table, tableIndex) => (
              <div
                key={`${page.id}-${tableIndex}-${table.rows[0]?.id ?? table.title}`}
                className="mb-8 last:mb-0"
              >
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
