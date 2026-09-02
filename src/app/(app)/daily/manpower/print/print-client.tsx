"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";
import { ManpowerLetter } from "@/components/manpower/manpower-letter";
import { StrengthLetter } from "@/components/manpower/strength-letter";
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
import { printLetterElement } from "@/lib/print-letter-pdf";
import { useI18n, useT } from "@/i18n/provider";

type FormId = "1" | "2" | "3";

function parseForm(raw: string | null): FormId {
  if (raw === "2" || raw === "3") return raw;
  return "1";
}

export function ManpowerPrintClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const apiOn = isApiEnabled();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const dateParam = searchParams.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : todayISO();
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
  }, [apiOn, cockpit.loading, cockpit.users, cockpit.cells, date, state.wing_parent]);

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
  const loading = apiOn && cockpit.loading;

  const titleKey =
    form === "1"
      ? "manpower.form1Title"
      : form === "2"
        ? "manpower.form2Title"
        : "manpower.form3Title";

  async function onPrint() {
    const el = printRef.current;
    if (!el) return;
    setPrinting(true);
    try {
      await printLetterElement(
        el,
        `manpower-form${form}-${date}.pdf`,
        "landscape",
      );
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("pages.manpowerPrint.title")}
          subtitle={`${t(titleKey)} · ${formatDateLong(date, dateLocale)}`}
          leading={
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link
                href={`/daily/manpower?date=${encodeURIComponent(date)}&form=${form}`}
              >
                <IconArrowLeft className="h-4 w-4" />
                {t("common.back")}
              </Link>
            </Button>
          }
          actions={
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              disabled={printing || loading}
              onClick={onPrint}
            >
              <IconPrinter className="h-4 w-4" />
              {printing || loading ? t("common.loading") : t("mess.print")}
            </Button>
          }
        />
      </div>

      {loading ? (
        <p className="p-4 text-sm text-neutral-500">{t("common.loading")}</p>
      ) : null}
      {form === "1" && !loading ? (
        <ManpowerLetter ref={printRef} report={form1} locale={dateLocale} />
      ) : null}
      {form === "2" && !loading ? (
        <StrengthLetter ref={printRef} report={form2} locale={dateLocale} />
      ) : null}
      {form === "3" && !loading ? (
        <StrengthLetter ref={printRef} report={form3} locale={dateLocale} />
      ) : null}
    </PagePane>
  );
}
