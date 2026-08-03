"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import {
  parseMonthInput,
  previousMonthKey,
  shiftMonthKey,
} from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { buildRationMonth, formatBdt } from "@/lib/reports";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

export default function RationMonthlyClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const month = parseMonthInput(
    searchParams.get("month") ?? previousMonthKey(),
  );

  const report = useMemo(
    () => buildRationMonth(month),
    [state.assignments, state.users, state.rates, month],
  );

  function setMonth(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function onExport() {
    const rows = [
      [
        t("cc.fields.name"),
        t("cc.fields.rabId"),
        "Tag",
        t("ration.days"),
        t("ration.rate"),
        t("ration.amount"),
      ],
    ];
    for (const row of report.rows) {
      for (const part of row.parts) {
        rows.push([
          row.user.name,
          row.user.rab_id,
          part.tag,
          String(part.days),
          String(part.rate),
          String(part.amount),
        ]);
      }
    }
    downloadCsv(`ration-${month}.csv`, rows);
  }

  return (
    <PagePane className="gap-5">
      <PageHeader
        title={t("pages.rationMonthly.title")}
        subtitle={t("pages.rationMonthly.subtitle", { month })}
        actions={
          <>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                aria-label={t("ration.prevMonth")}
                onClick={() => setMonth(shiftMonthKey(month, -1))}
              >
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <div className="relative w-[11rem] shrink-0">
                <IconCalendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  aria-label={t("ration.month")}
                  className={cn(fieldClass, "h-9 w-[11rem] pl-8")}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl"
                aria-label={t("ration.nextMonth")}
                onClick={() => setMonth(shiftMonthKey(month, 1))}
              >
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              onClick={onExport}
              disabled={!report.rows.length}
            >
              <IconDownload className="h-3.5 w-3.5" />
              {t("ration.exportCsv")}
            </Button>
            <Button asChild variant="cta" size="sm" className="h-9 rounded-xl">
              <Link href={`/ration/report?month=${month}`}>
                {t("ration.openReport")}
              </Link>
            </Button>
          </>
        }
      />

      <SectionCard>
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-primary/10 text-primary">
            {t("ration.totalPayout")}: {formatBdt(report.totalAmount)}
          </Badge>
          <p className="text-sm text-neutral-500">{t("ration.eligibleOnly")}</p>
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="mb-3 text-base font-semibold">{t("consume.byTag")}</h2>
        {report.byTag.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("ration.emptyNoEligible")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {report.byTag.map((row) => (
              <Badge key={row.tag} className="bg-nav-accent/10 text-nav-accent">
                {row.tag} ({tagLabel(row.tag, locale)}): {row.days}d ·{" "}
                {formatBdt(row.amount)}
              </Badge>
            ))}
          </div>
        )}
      </SectionCard>

      {report.rows.length === 0 ? (
        <EmptyState title={t("ration.emptyNoEligible")} />
      ) : (
        <SectionCard>
          <h2 className="mb-3 text-base font-semibold">{t("ration.perUser")}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500 dark:bg-neutral-800">
                <tr>
                  <th className="px-3 py-2">{t("cc.fields.name")}</th>
                  <th className="px-3 py-2">Tag</th>
                  <th className="px-3 py-2">{t("ration.days")}</th>
                  <th className="px-3 py-2">{t("ration.rate")}</th>
                  <th className="px-3 py-2">{t("ration.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.flatMap((row) =>
                  row.parts.map((part) => (
                    <tr
                      key={`${row.user.id}-${part.tag}`}
                      className="border-t border-neutral-100 dark:border-neutral-800"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.user.name}</div>
                        <div className="font-mono text-xs text-neutral-500">
                          {row.user.rab_id}
                        </div>
                      </td>
                      <td className="px-3 py-2">{part.tag}</td>
                      <td className="px-3 py-2">{part.days}</td>
                      <td className="px-3 py-2">{formatBdt(part.rate)}</td>
                      <td className="px-3 py-2">{formatBdt(part.amount)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </PagePane>
  );
}
