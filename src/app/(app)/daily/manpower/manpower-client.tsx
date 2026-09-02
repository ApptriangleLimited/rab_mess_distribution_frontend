"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconExternalLink,
  IconPrinter,
} from "@tabler/icons-react";
import { ManpowerWeb } from "@/components/manpower/manpower-web";
import { StrengthWeb } from "@/components/manpower/strength-web";
import { DailyTabs } from "@/components/layout/daily-tabs";
import { DatePicker } from "@/components/shared/date-picker";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import { useDailyCockpit } from "@/hooks/use-daily-cockpit";
import { useStore } from "@/hooks/use-store";
import { isApiEnabled } from "@/lib/api/mode";
import { formatDateLong, todayISO } from "@/lib/date";
import {
  buildManpowerReport,
  tagForFromCells,
  type ManpowerSnapshot,
} from "@/lib/manpower-report";
import { buildStrengthReport } from "@/lib/strength-report";
import { cn } from "@/lib/utils";
import { useI18n, useT } from "@/i18n/provider";

type FormId = "1" | "2" | "3";

function parseForm(raw: string | null): FormId {
  if (raw === "2" || raw === "3") return raw;
  return "1";
}

export default function ManpowerClient() {
  const t = useT();
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const state = useStore();
  const apiOn = isApiEnabled();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dateParam = searchParams.get("date");
  const [date, setDate] = useState(
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : todayISO(),
  );

  const form = parseForm(searchParams.get("form"));

  const cockpit = useDailyCockpit({
    dateFrom: date,
    dateTo: date,
    q: "",
    rank: "all",
    wing: "all",
  });

  const snapshot: ManpowerSnapshot | undefined = useMemo(() => {
    if (!apiOn || cockpit.loading) return undefined;
    return {
      users: cockpit.users,
      tagFor: tagForFromCells(cockpit.cells, date),
      wingParent: state.wing_parent,
    };
  }, [
    apiOn,
    cockpit.loading,
    cockpit.users,
    cockpit.cells,
    date,
    state.wing_parent,
  ]);

  const form1 = useMemo(
    () => buildManpowerReport(date, snapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state, snapshot],
  );
  const form2 = useMemo(
    () => buildStrengthReport(date, "admin", snapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state, snapshot],
  );
  const form3 = useMemo(
    () => buildStrengthReport(date, "hq", snapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state, snapshot],
  );

  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";
  const printHref = `/daily/manpower/print?date=${encodeURIComponent(date)}&form=${form}`;
  const loading = apiOn && cockpit.loading;

  const formTabs: {
    id: FormId;
    short: string;
    hintKey:
      | "manpower.form1Hint"
      | "manpower.form2Hint"
      | "manpower.form3Hint";
  }[] = [
    {
      id: "1",
      short: t("manpower.form1Short"),
      hintKey: "manpower.form1Hint",
    },
    {
      id: "2",
      short: t("manpower.form2Short"),
      hintKey: "manpower.form2Hint",
    },
    {
      id: "3",
      short: t("manpower.form3Short"),
      hintKey: "manpower.form3Hint",
    },
  ];

  function replaceQuery(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) params.set(k, v);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function pushDate(next: string) {
    setDate(next);
    replaceQuery({ date: next, form });
  }

  function pushForm(next: FormId) {
    replaceQuery({ date, form: next });
  }

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-emerald-50/50 to-sky-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-nav-accent/10 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={t("pages.manpower.title")}
              subtitle={t("pages.manpower.subtitle", {
                date: formatDateLong(date, dateLocale),
              })}
              center={<DailyTabs />}
              actions={
                <div className="flex items-center gap-1.5">
                  <DatePicker
                    value={date}
                    onChange={pushDate}
                    allowClear={false}
                    triggerClassName="h-9 w-[9.25rem] rounded-xl"
                  />
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 rounded-xl px-2.5"
                  >
                    <Link href={printHref} title={t("manpower.openPrint")}>
                      <IconExternalLink className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {t("manpower.openPrint")}
                      </span>
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="h-9 gap-1.5 rounded-xl px-2.5 shadow-sm shadow-primary/20"
                  >
                    <Link href={printHref} title={t("mess.print")}>
                      <IconPrinter className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("mess.print")}</span>
                    </Link>
                  </Button>
                </div>
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 px-2.5 py-2 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
          <span className="shrink-0 px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {t("manpower.formPicker")}
          </span>
          <div
            role="tablist"
            aria-label={t("manpower.formPicker")}
            className="flex min-w-0 flex-1 flex-wrap gap-1.5"
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
                    "rounded-lg border px-2.5 py-1 text-xs font-semibold transition",
                    active
                      ? "border-primary/40 bg-primary text-white shadow-sm shadow-primary/20 dark:border-primary/50"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-primary/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
                  )}
                >
                  {tab.short}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-neutral-50/80 dark:border-neutral-700 dark:bg-neutral-950/40">
          {loading ? (
            <p className="p-4 text-sm text-neutral-500">{t("common.loading")}</p>
          ) : null}
          {form === "1" && !loading ? <ManpowerWeb report={form1} /> : null}
          {form === "2" && !loading ? <StrengthWeb report={form2} /> : null}
          {form === "3" && !loading ? <StrengthWeb report={form3} /> : null}
        </div>
      </motion.div>
    </PagePane>
  );
}
