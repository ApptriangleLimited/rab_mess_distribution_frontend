"use client";

import { useMemo, useState } from "react";
import { IconSearch, IconUsers } from "@tabler/icons-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RANKS, WINGS } from "@/lib/constants";
import { formatBdt } from "@/lib/reports";
import type { User } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type AllConsumeRow = {
  user: User;
  totalDays: number;
  allowanceDays: number;
  amount: number;
};

type Props = {
  month: string;
  rows: AllConsumeRow[];
  totalAmount: number;
  assignmentCount: number;
  allowanceDays: number;
};

/** Month rollup — all tags combined. */
export function AllConsumePanel({
  month,
  rows,
  totalAmount,
  assignmentCount,
  allowanceDays,
}: Props) {
  const t = useT();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");

  const members = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (rank !== "all" && row.user.rank !== rank) return false;
      if (wing !== "all" && row.user.wing !== wing) return false;
      if (!query) return true;
      return [row.user.name, row.user.rab_id, row.user.wing, row.user.rank]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [rows, q, rank, wing]);

  const filteredTotal = useMemo(
    () => members.reduce((sum, row) => sum + row.amount, 0),
    [members],
  );

  const filteredDays = useMemo(
    () => members.reduce((sum, row) => sum + row.totalDays, 0),
    [members],
  );

  const fieldClass =
    "h-11 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  return (
    <div className="flex flex-col gap-4 no-print">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 pb-4 dark:border-neutral-800">
        <div>
          <p className="text-base font-semibold text-neutral-900 dark:text-white">
            {t("common.all")}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {month} · {rows.length} {t("consume.users")}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <MiniStat
            label={t("consume.statDays")}
            value={String(assignmentCount)}
          />
          <MiniStat
            label={t("consume.statMembers")}
            value={String(rows.length)}
          />
          <MiniStat
            label={t("consume.statAllowance")}
            value={String(allowanceDays)}
          />
          <MiniStat
            label={t("consume.statAmount")}
            value={formatBdt(totalAmount)}
            accent
          />
        </div>
      </div>

      <div className="flex w-full flex-wrap items-end gap-3 rounded-2xl border border-neutral-200/90 bg-neutral-50/60 p-3.5 dark:border-neutral-700 dark:bg-neutral-900/50">
        <div className="min-w-[17rem] max-w-lg w-full shrink-0 sm:w-96 space-y-1.5">
          <p className="text-[11px] font-medium text-neutral-400">
            {t("common.search")}
          </p>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("consume.searchPlaceholder")}
              aria-label={t("common.search")}
              className={cn(fieldClass, "w-full pl-9")}
            />
          </div>
        </div>
        <div className="min-w-[10rem] flex-1 basis-[10rem] space-y-1.5">
          <p className="text-[11px] font-medium text-neutral-400">
            {t("cc.filterRank")}
          </p>
          <Select value={rank} onValueChange={setRank}>
            <SelectTrigger
              className={cn(fieldClass, "w-full")}
              aria-label={t("cc.filterRank")}
            >
              <SelectValue placeholder={t("cc.selectRank")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {RANKS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[10rem] flex-1 basis-[10rem] space-y-1.5">
          <p className="text-[11px] font-medium text-neutral-400">
            {t("cc.filterWing")}
          </p>
          <Select value={wing} onValueChange={setWing}>
            <SelectTrigger
              className={cn(fieldClass, "w-full")}
              aria-label={t("cc.filterWing")}
            >
              <SelectValue placeholder={t("cc.selectWing")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {WINGS.map((w) => (
                <SelectItem key={w} value={w}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t("consume.empty")}
          description={t("consume.emptyHint")}
        />
      ) : members.length === 0 ? (
        <EmptyState title={t("common.noResults")} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-neutral-200/90 dark:border-neutral-700">
          <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/80 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <IconUsers className="h-4 w-4 text-neutral-400" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">
              {t("consume.perUser")}
            </span>
            <span className="ml-auto font-mono text-xs tabular-nums text-neutral-400">
              {members.length}/{rows.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-base">
              <thead className="border-b border-neutral-100 text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400 dark:border-neutral-800">
                <tr>
                  <th className="w-12 px-3 py-3 text-center">
                    {t("consume.colSl")}
                  </th>
                  <th className="px-3 py-3">{t("consume.colId")}</th>
                  <th className="px-3 py-3">{t("consume.colRank")}</th>
                  <th className="min-w-[9.5rem] px-3 py-3">
                    {t("consume.colName")}
                  </th>
                  <th className="px-3 py-3 text-center">
                    {t("consume.totalDays")}
                  </th>
                  <th className="px-3 py-3 text-center">
                    {t("consume.allowanceDays")}
                  </th>
                  <th className="px-3 py-3 text-right">
                    {t("consume.colGrandTotal")}
                  </th>
                  <th className="min-w-[6rem] px-3 py-3">
                    {t("consume.colRemarks")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((row, i) => (
                  <tr
                    key={row.user.id}
                    className="border-t border-neutral-100/90 transition-colors hover:bg-primary/[0.03] dark:border-neutral-800/80 dark:hover:bg-primary/5"
                  >
                    <td className="px-3 py-2.5 text-center font-mono text-xs tabular-nums text-neutral-400">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-neutral-600 dark:text-neutral-300">
                      {row.user.rab_id}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                      {row.user.rank || "—"}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-neutral-900 dark:text-white">
                      {row.user.name}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.totalDays}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.allowanceDays}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-base font-semibold tabular-nums text-primary">
                      {formatBdt(row.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-neutral-500">—</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50/90 dark:border-neutral-700 dark:bg-neutral-900/70">
                  <td
                    colSpan={4}
                    className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400"
                  >
                    {t("consume.billTotal")}
                  </td>
                  <td className="px-3 py-3 text-center font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                    {filteredDays}
                  </td>
                  <td className="px-3 py-3 text-center font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                    {members.reduce((s, r) => s + r.allowanceDays, 0)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-lg font-semibold tabular-nums text-primary">
                    {formatBdt(filteredTotal)}
                  </td>
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-right">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold tabular-nums",
          accent ? "text-primary" : "text-neutral-800 dark:text-neutral-100",
        )}
      >
        {value}
      </p>
    </div>
  );
}
