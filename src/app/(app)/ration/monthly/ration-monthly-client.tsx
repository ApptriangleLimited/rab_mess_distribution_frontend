"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { monthKey, parseMonthInput } from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { buildRationMonth, formatBdt } from "@/lib/reports";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";

export default function RationMonthlyClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const month = parseMonthInput(searchParams.get("month") ?? monthKey());

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
    <PagePane>
      <PageHeader
        title={t("pages.rationMonthly.title")}
        subtitle={t("pages.rationMonthly.subtitle", { month })}
        actions={
          <Button variant="outline" onClick={onExport} disabled={!report.rows.length}>
            {t("ration.exportCsv")}
          </Button>
        }
      />

      <SectionCard>
        <div className="flex flex-wrap items-end gap-4">
          <div className="max-w-xs space-y-2">
            <Label>{t("ration.month")}</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <Badge className="bg-primary/10 text-primary">
            {t("ration.totalPayout")}: {formatBdt(report.totalAmount)}
          </Badge>
          <p className="text-sm text-neutral-500">{t("ration.eligibleOnly")}</p>
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="mb-3 text-base font-semibold">{t("consume.byTag")}</h2>
        {report.byTag.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("ration.empty")}</p>
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
        <EmptyState title={t("ration.empty")} />
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
