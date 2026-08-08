"use client";

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconDownload, IconPrinter } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { FrTransferLetterPrint } from "@/components/ration/fr-transfer-letter-print";
import { StaffPayoutPrint } from "@/components/ration/staff-payout-print";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { RATION_REPORT_META } from "@/lib/constants";
import {
  downloadFrTransferPdf,
  downloadStaffPayoutPdf,
} from "@/lib/download-letter-pdf";
import { formatMonthLong, parseMonthInput, todayISO } from "@/lib/date";
import { printLetterElement } from "@/lib/print-letter-pdf";
import {
  buildFrTransferSheetsPerUser,
  buildRationStaffLines,
} from "@/lib/reports";
import type { DailyTag } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";

const TAGS = new Set<string>([
  "FR",
  "CL",
  "PL",
  "WR",
  "CD",
  "WIT",
  "MED",
  "TRG",
  "MS",
]);

function parseTag(raw: string | null): DailyTag | null {
  if (!raw || !TAGS.has(raw)) return null;
  return raw as DailyTag;
}

export default function RationReportPreviewClient() {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const searchParams = useSearchParams();
  const letterRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const month = parseMonthInput(searchParams.get("month") ?? "");
  const tag = parseTag(searchParams.get("tag"));
  const senderId = searchParams.get("sender") ?? "";
  const isFr = tag === "FR";

  const staffSheet = useMemo(() => {
    if (!tag || !senderId || isFr) return null;
    const sheets = buildRationStaffLines(month, senderId, tag);
    return sheets[0] ?? null;
  }, [
    state.assignments,
    state.users,
    state.senders,
    state.rates,
    month,
    tag,
    senderId,
    isFr,
  ]);

  const frSheets = useMemo(() => {
    if (!isFr || !senderId) return [];
    return buildFrTransferSheetsPerUser(month, senderId, todayISO());
  }, [
    state.assignments,
    state.users,
    state.senders,
    state.rates,
    month,
    senderId,
    isFr,
  ]);

  const sender = state.senders.find((s) => s.id === senderId);
  const monthLabel = formatMonthLong(month);
  const subject =
    tag && sender && !isFr
      ? RATION_REPORT_META.subjectTagBill
          .replace("{monthLabel}", monthLabel)
          .replace("{bank}", sender.bank_name || sender.label)
      : undefined;

  function onDownload() {
    if (frSheets.length > 0) {
      downloadFrTransferPdf(
        frSheets,
        `ration-fr-transfer-${month}-${senderId}.pdf`,
      );
      return;
    }
    if (!staffSheet || !tag) return;
    downloadStaffPayoutPdf(
      staffSheet,
      subject ??
        RATION_REPORT_META.subjectTagBill
          .replace("{monthLabel}", monthLabel)
          .replace("{bank}", staffSheet.sender.bank_name || staffSheet.sender.label),
      `ration-staff-${staffSheet.month}-${tag}-${staffSheet.sender.id}.pdf`,
    );
  }

  async function onPrint() {
    const el = letterRef.current;
    if (!el) return;
    setPrinting(true);
    try {
      const name =
        frSheets.length > 0
          ? `ration-fr-transfer-${month}-${senderId}.pdf`
          : `ration-staff-${month}-${tag}-${senderId}.pdf`;
      await printLetterElement(
        el,
        name,
        frSheets.length > 0 ? "landscape" : "portrait",
      );
    } finally {
      setPrinting(false);
    }
  }

  const invalid = !tag || !senderId || !sender;
  const empty = isFr
    ? frSheets.length === 0
    : !staffSheet || staffSheet.lines.length === 0;
  const canAct = isFr
    ? frSheets.length > 0
    : Boolean(staffSheet?.lines.length);

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("ration.reportPreview")}
          subtitle={
            invalid
              ? t("ration.reportPreviewHint")
              : isFr
                ? `FR · ${monthLabel} · ${sender!.label}`
                : `${tagLabel(tag!, locale)} · ${monthLabel} · ${sender!.label}`
          }
          actions={
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={!canAct}
                onClick={onDownload}
              >
                <IconDownload className="h-3.5 w-3.5" />
                {t("ration.downloadReport")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="cta"
                className="rounded-lg"
                disabled={!canAct || printing}
                onClick={() => void onPrint()}
              >
                <IconPrinter className="h-3.5 w-3.5" />
                {t("ration.print")}
              </Button>
            </>
          }
        />
      </div>

      {invalid ? (
        <EmptyState
          title={t("ration.reportEmpty")}
          description={t("ration.generateReportHint")}
        />
      ) : empty ? (
        <EmptyState
          title={t("ration.reportEmpty")}
          description={t("ration.reportPreviewHint")}
        />
      ) : isFr && frSheets.length > 0 ? (
        <div className="w-full overflow-x-auto pb-2">
          <div
            ref={letterRef}
            data-print-stack="true"
            className="flex w-max min-w-full flex-col gap-6"
          >
            {frSheets.map((sheet) => {
              const user = sheet.lines[0]?.user;
              return (
                <FrTransferLetterPrint
                  key={user?.id ?? sheet.lines[0]?.refNo}
                  sheet={sheet}
                  transferToBank={user?.bank_name}
                />
              );
            })}
          </div>
        </div>
      ) : staffSheet ? (
        <StaffPayoutPrint
          ref={letterRef}
          sheets={[staffSheet]}
          preview
          subject={subject}
        />
      ) : null}
    </PagePane>
  );
}
