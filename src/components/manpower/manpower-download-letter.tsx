"use client";

import { useEffect, useMemo, useRef } from "react";
import { ForceRankLetter } from "@/components/manpower/force-rank-letter";
import { ManpowerLetter } from "@/components/manpower/manpower-letter";
import { StrengthLetter } from "@/components/manpower/strength-letter";
import { useManpowerDay } from "@/hooks/use-manpower-day";
import { useStore } from "@/hooks/use-store";
import {
  downloadLetterElementPdf,
  manpowerPdfFilename,
} from "@/lib/download-letter-element";
import { buildForceRankReport } from "@/lib/force-rank-report";
import { buildManpowerReport } from "@/lib/manpower-report";
import { isPaperVerified } from "@/lib/store/paper-reports";
import { buildStrengthReport } from "@/lib/strength-report";
import type { ManpowerFormId } from "@/lib/types";
import { useI18n } from "@/i18n/provider";

export function ManpowerDownloadLetter({
  form,
  date,
  wing = "all",
  onDone,
  onError,
}: {
  form: ManpowerFormId;
  date: string;
  wing?: string;
  onDone: () => void;
  onError: () => void;
}) {
  const letterRef = useRef<HTMLDivElement>(null);
  const { locale } = useI18n();
  const state = useStore();
  const { apiOn, loading, snapshot } = useManpowerDay(date);
  const reportSnapshot = apiOn
    ? snapshot ?? {
        users: [],
        tagFor: () => "" as const,
        prefiltered: true,
      }
    : undefined;
  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";
  const verified = isPaperVerified("manpower", date, form);

  const form1 = useMemo(
    () => buildManpowerReport(date, reportSnapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state, reportSnapshot],
  );
  const form2 = useMemo(
    () => buildStrengthReport(date, "admin", reportSnapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state, reportSnapshot],
  );
  const form3 = useMemo(
    () => buildStrengthReport(date, "hq", reportSnapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state, reportSnapshot],
  );
  const form4 = useMemo(
    () => buildForceRankReport(date, reportSnapshot, wing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, state, reportSnapshot, wing],
  );

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const el = letterRef.current;
        if (!el || cancelled) return;
        try {
          await downloadLetterElementPdf(
            el,
            manpowerPdfFilename(form, date, wing),
            form === "4" ? "landscape" : "portrait",
          );
          if (!cancelled) onDone();
        } catch {
          if (!cancelled) onError();
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, form, date, wing, form1, form2, form3, form4, onDone, onError]);

  if (loading) return null;

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[-1] bg-white"
      style={{
        width: form === "4" ? "297mm" : "210mm",
      }}
      aria-hidden
    >
      {form === "1" ? (
        <ManpowerLetter
          ref={letterRef}
          report={form1}
          locale={dateLocale}
          verified={verified}
        />
      ) : null}
      {form === "2" ? (
        <StrengthLetter
          ref={letterRef}
          report={form2}
          locale={dateLocale}
          verified={verified}
        />
      ) : null}
      {form === "3" ? (
        <StrengthLetter
          ref={letterRef}
          report={form3}
          locale={dateLocale}
          verified={verified}
        />
      ) : null}
      {form === "4" ? (
        <ForceRankLetter ref={letterRef} report={form4} verified={verified} />
      ) : null}
    </div>
  );
}
