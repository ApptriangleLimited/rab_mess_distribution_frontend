"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconEdit,
  IconEyeFilled,
  IconPlus,
  IconPrinter,
  IconUsersGroup,
} from "@tabler/icons-react";
import { DailyTabs } from "@/components/layout/daily-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { PaperStatusBadge } from "@/components/reports/paper-status-badge";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { Button } from "@/components/ui/button";
import { rowActionClass } from "@/components/users/row-action-btn";
import { useStore } from "@/hooks/use-store";
import { formatDateDisplay } from "@/lib/date";
import { listPaperReports } from "@/lib/store/paper-reports";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";

type FormId = "1" | "2" | "3" | "4";

function parseForm(raw: string | null): FormId {
  if (raw === "2" || raw === "3" || raw === "4") return raw;
  return "1";
}

export default function ManpowerClient() {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const form = parseForm(searchParams.get("form"));
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const formTabs: {
    id: FormId;
    short: string;
    hintKey:
      | "manpower.form1Hint"
      | "manpower.form2Hint"
      | "manpower.form3Hint"
      | "manpower.form4Hint";
  }[] = [
    {
      id: "1",
      short: t("manpower.form1Short"),
      hintKey: "manpower.form1Hint",
    },
    {
      id: "3",
      short: t("manpower.form3Short"),
      hintKey: "manpower.form3Hint",
    },
    {
      id: "2",
      short: t("manpower.form2Short"),
      hintKey: "manpower.form2Hint",
    },
    {
      id: "4",
      short: t("manpower.form4Short"),
      hintKey: "manpower.form4Hint",
    },
  ];

  const rows = useMemo(() => {
    void state.paper_report_requests;
    return listPaperReports("manpower").filter((row) => (row.form ?? "1") === form);
  }, [form, state.paper_report_requests]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (dateFrom && row.date < dateFrom) return false;
      if (dateTo && row.date > dateTo) return false;
      if (!query) return true;
      return [row.date, row.title, row.status, row.form ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [rows, q, dateFrom, dateTo]);

  const createHref = `/daily/manpower/new?form=${form}`;

  function pushForm(next: FormId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("form", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-emerald-50/50 to-sky-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={t("pages.manpower.title")}
              subtitle={t("pages.manpower.subtitle", {
                count: String(rows.length),
              })}
              center={<DailyTabs />}
              actions={
                <Button
                  asChild
                  variant="cta"
                  size="sm"
                  className="h-10 gap-1.5 rounded-xl shadow-sm shadow-primary/20"
                >
                  <Link href={createHref}>
                    <IconPlus className="h-4 w-4" />
                    {t("manpower.new")}
                  </Link>
                </Button>
              }
            />
          </div>
        </div>

        <div className="rounded-2xl border-2 border-primary/25 bg-white px-3 py-3 shadow-md dark:border-primary/40 dark:bg-neutral-950">
          <span className="mb-2 block px-0.5 text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
            {t("manpower.formPicker")}
          </span>
          <div
            role="tablist"
            aria-label={t("manpower.formPicker")}
            className="flex min-w-0 flex-wrap gap-2.5"
          >
            {formTabs.map((tab) => {
              const active = tab.id === form;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={t(tab.hintKey)}
                  onClick={() => pushForm(tab.id)}
                  className={cn(
                    "min-w-[9.5rem] rounded-xl border-2 px-5 py-2.5 text-sm font-bold transition sm:min-w-[11rem] sm:px-6 sm:py-3 sm:text-base",
                    active
                      ? "border-primary bg-primary text-white shadow-md shadow-primary/25 dark:border-primary"
                      : "border-neutral-300 bg-neutral-50 text-neutral-800 hover:border-primary/50 hover:bg-primary/5 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100",
                  )}
                >
                  {tab.short}
                </button>
              );
            })}
          </div>
        </div>

        <SearchFilterBar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("manpower.searchPlaceholder")}
          searchClassName="w-64 shrink-0 sm:w-72"
        >
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={({ from, to }) => {
              setDateFrom(from);
              setDateTo(to);
            }}
            label={t("common.dateRange")}
            triggerClassName="h-10 min-w-[13.5rem] rounded-xl px-3 text-sm"
          />
        </SearchFilterBar>

        {filtered.length === 0 ? (
          <EmptyState
            title={t("manpower.listEmpty")}
            description={t("manpower.listEmptyHint")}
            action={
              <Button
                asChild
                variant="cta"
                size="sm"
                className="h-9 rounded-xl px-3"
              >
                <Link href={createHref}>
                  <IconPlus className="h-3.5 w-3.5" />
                  {t("manpower.new")}
                </Link>
              </Button>
            }
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <IconUsersGroup className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {form === "1"
                  ? t("manpower.form1Title")
                  : form === "2"
                    ? t("manpower.form2Title")
                    : form === "3"
                      ? t("manpower.form3Title")
                      : t("manpower.form4Title")}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-3">{t("paperReports.colDate")}</th>
                    <th className="px-4 py-3">{t("paperReports.colTitle")}</th>
                    <th className="px-4 py-3">{t("paperReports.colStatus")}</th>
                    <th className="px-4 py-3 text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const href = `/daily/manpower/new?date=${encodeURIComponent(row.ref)}&form=${row.form ?? form}`;
                    const editHref = `${href}&edit=1`;
                    const printHref = `/daily/manpower/print?date=${encodeURIComponent(row.ref)}&form=${row.form ?? form}`;
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-neutral-100 transition hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                      >
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                          {formatDateDisplay(row.date)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={href}
                            className="font-semibold text-neutral-900 hover:underline dark:text-white"
                          >
                            {row.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <PaperStatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              className={rowActionClass("view")}
                            >
                              <Link href={href} aria-label={t("common.view")}>
                                <IconEyeFilled className="h-4 w-4" />
                              </Link>
                            </Button>
                            {row.status === "draft" || row.status === "submitted" ? (
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className={rowActionClass("edit")}
                              >
                                <Link href={editHref} aria-label={t("common.edit")}>
                                  <IconEdit className="h-4 w-4" />
                                </Link>
                              </Button>
                            ) : null}
                            {row.status === "submitted" ||
                            row.status === "approved" ? (
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className={rowActionClass("print")}
                              >
                                <Link
                                  href={printHref}
                                  aria-label={t("paperReports.print")}
                                >
                                  <IconPrinter className="h-4 w-4" />
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </motion.div>
    </PagePane>
  );
}
