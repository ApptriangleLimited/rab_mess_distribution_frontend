"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessTodayList } from "@/components/mess/mess-today-list";
import { useStore } from "@/hooks/use-store";
import { todayISO } from "@/lib/date";
import { downloadCsv } from "@/lib/csv";
import { countByField, getMessEaters } from "@/lib/store/mess";
import { getServedIds, toggleServed } from "@/lib/served";
import { useT } from "@/i18n/provider";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function MessTodayClient() {
  const t = useT();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const date = dateParam && isValidDate(dateParam) ? dateParam : todayISO();

  const [servedTick, setServedTick] = useState(0);
  const servedIds = useMemo(() => {
    void servedTick;
    return getServedIds(date);
  }, [date, servedTick]);

  const eaters = useMemo(
    () => getMessEaters(date),
    [state.users, state.assignments, date],
  );

  const byWing = useMemo(() => countByField(eaters, "wing"), [eaters]);
  const byRank = useMemo(() => countByField(eaters, "rank"), [eaters]);

  const setDate = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", next);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  function onExport() {
    const rows = [
      [
        "#",
        t("mess.colName"),
        t("mess.colRabId"),
        t("mess.colRank"),
        t("mess.colWing"),
        t("mess.colPhone"),
        t("mess.colServed"),
      ],
      ...eaters.map((u, i) => [
        String(i + 1),
        u.name,
        u.rab_id,
        u.rank,
        u.wing,
        u.phone,
        servedIds.has(u.id) ? "yes" : "no",
      ]),
    ];
    downloadCsv(`mess-${date}.csv`, rows);
  }

  return (
    <PagePane className="print:border-0 print:p-0">
      <PageHeader
        title={t("pages.messToday.title")}
        subtitle={t("pages.messToday.subtitle", {
          count: eaters.length,
          date,
        })}
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            <Button variant="outline" onClick={onExport}>
              {t("mess.exportCsv")}
            </Button>
            <Button variant="cta" onClick={() => window.print()}>
              {t("mess.print")}
            </Button>
          </div>
        }
      />

      <SectionCard className="print:shadow-none">
        <p className="mb-4 text-sm text-neutral-600 no-print">
          {t("mess.hint")}
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 no-print">
          <div className="space-y-2">
            <Label>{t("mess.date")}</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              {t("mess.total")}
            </p>
            <p className="mt-1 text-3xl font-semibold text-primary">
              {eaters.length}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              {t("mess.served")}
            </p>
            <p className="mt-1 text-3xl font-semibold text-neutral-900 dark:text-white">
              {[...servedIds].filter((id) => eaters.some((e) => e.id === id))
                .length}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 no-print">
          <div>
            <p className="mb-2 text-sm font-medium">{t("mess.byWing")}</p>
            <div className="flex flex-wrap gap-2">
              {byWing.map(([wing, n]) => (
                <Badge key={wing} className="bg-nav-accent/10 text-nav-accent">
                  {wing}: {n}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t("mess.byRank")}</p>
            <div className="flex flex-wrap gap-2">
              {byRank.map(([rank, n]) => (
                <Badge key={rank} className="bg-primary/10 text-primary">
                  {rank}: {n}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {eaters.length === 0 ? (
        <EmptyState title={t("mess.empty")} />
      ) : (
        <MessTodayList
          eaters={eaters}
          servedIds={servedIds}
          onToggleServed={(userId) => {
            toggleServed(date, userId);
            setServedTick((n) => n + 1);
          }}
        />
      )}
    </PagePane>
  );
}
