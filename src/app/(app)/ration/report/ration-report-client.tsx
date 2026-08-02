"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { monthKey, parseMonthInput } from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { buildRationReportClean, formatBdt } from "@/lib/reports";
import { useT } from "@/i18n/provider";

export default function RationReportClient() {
  const t = useT();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const month = parseMonthInput(searchParams.get("month") ?? monthKey());

  const report = useMemo(
    () => buildRationReportClean(month),
    [state.assignments, state.users, state.senders, state.rates, month],
  );

  function setMonth(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function onExport() {
    const rows = [
      [
        t("ration.fromAccount"),
        t("ration.toRecipient"),
        "RAB ID",
        "Tag",
        t("ration.days"),
        t("ration.rate"),
        t("ration.amount"),
      ],
    ];
    for (const group of report.groups) {
      for (const line of group.lines) {
        rows.push([
          group.sender.label,
          line.user.name,
          line.user.rab_id,
          line.tag,
          String(line.days),
          String(line.rate),
          String(line.amount),
        ]);
      }
    }
    for (const line of report.unmapped) {
      rows.push([
        "(unmapped)",
        line.user.name,
        line.user.rab_id,
        line.tag,
        String(line.days),
        String(line.rate),
        String(line.amount),
      ]);
    }
    downloadCsv(`ration-report-${month}.csv`, rows);
  }

  return (
    <PagePane className="print:border-0">
      <PageHeader
        title={t("pages.rationReport.title")}
        subtitle={t("pages.rationReport.subtitle", { month })}
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            <Button variant="outline" onClick={onExport}>
              {t("ration.exportCsv")}
            </Button>
            <Button variant="cta" onClick={() => window.print()}>
              {t("ration.print")}
            </Button>
          </div>
        }
      />

      <SectionCard className="no-print">
        <p className="mb-3 text-sm text-neutral-600">{t("ration.reportHint")}</p>
        <p className="mb-4 text-xs font-medium text-amber-700">
          {t("ration.noSendMoney")}
        </p>
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
            {t("ration.grandTotal")}: {formatBdt(report.total)}
          </Badge>
        </div>
      </SectionCard>

      {report.groups.map((group) => (
        <SectionCard key={group.sender.id}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">{group.sender.label}</h2>
              <p className="text-sm text-neutral-600">
                {group.sender.bank_name} · {group.sender.account_number}
              </p>
              <p className="text-xs text-neutral-500">
                {t("ration.fromAccount")}: {group.sender.account_name} · tags:{" "}
                {group.sender.mapped_tags.join(", ")}
              </p>
            </div>
            <Badge className="bg-nav-accent/10 text-nav-accent">
              {t("ration.senderTotal")}: {formatBdt(group.total)}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500 dark:bg-neutral-800">
                <tr>
                  <th className="px-3 py-2">{t("ration.toRecipient")}</th>
                  <th className="px-3 py-2">Tag</th>
                  <th className="px-3 py-2">{t("ration.days")}</th>
                  <th className="px-3 py-2">{t("ration.rate")}</th>
                  <th className="px-3 py-2">{t("ration.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {group.lines.map((line) => (
                  <tr
                    key={`${group.sender.id}-${line.user.id}-${line.tag}`}
                    className="border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{line.user.name}</div>
                      <div className="font-mono text-xs text-neutral-500">
                        {line.user.rab_id} · {line.user.account_number}
                      </div>
                    </td>
                    <td className="px-3 py-2">{line.tag}</td>
                    <td className="px-3 py-2">{line.days}</td>
                    <td className="px-3 py-2">{formatBdt(line.rate)}</td>
                    <td className="px-3 py-2">{formatBdt(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ))}

      {report.unmapped.length > 0 ? (
        <SectionCard>
          <h2 className="mb-3 text-base font-semibold text-amber-800">
            {t("ration.unmapped")}
          </h2>
          <ul className="space-y-1 text-sm">
            {report.unmapped.map((line) => (
              <li key={`${line.user.id}-${line.tag}`}>
                {line.user.name} · {line.tag} · {line.days}d ·{" "}
                {formatBdt(line.amount)}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </PagePane>
  );
}
