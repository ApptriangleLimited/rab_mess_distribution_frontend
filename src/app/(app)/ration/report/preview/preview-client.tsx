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
import {
  downloadFrTransferPdf,
  downloadStaffPayoutPdf,
} from "@/lib/download-letter-pdf";
import { formatMonthLong, parseMonthInput, todayISO } from "@/lib/date";
import { printLetterElement } from "@/lib/print-letter-pdf";
import {
  buildFrTransferSheetsByMemberBank,
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

  const staffSheets = useMemo(() => {
    if (!tag || !senderId || isFr) return [];
    return buildRationStaffLines(month, senderId, tag);
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
    return buildFrTransferSheetsByMemberBank(month, senderId, todayISO());
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

  function onDownload() {
    if (frSheets.length > 0) {
      downloadFrTransferPdf(
        frSheets,
        `ration-fr-transfer-${month}-${senderId}.pdf`,
      );
      return;
    }
    if (!staffSheets.length || !tag) return;
    downloadStaffPayoutPdf(
      staffSheets,
      `ration-staff-${month}-${tag}-${senderId}.pdf`,
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
    : staffSheets.length === 0 ||
      staffSheets.every((s) => s.lines.length === 0);
  const canAct = isFr
    ? frSheets.length > 0
    : staffSheets.some((s) => s.lines.length > 0);

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("ration.reportPreview")}
          subtitle={
            invalid
              ? t("ration.reportPreviewHint")
              : isFr
                ? `FR · ${monthLabel} · ${sender!.label} · ${frSheets.length} bank letter(s)`
                : `${tagLabel(tag!, locale)} · ${monthLabel} · ${sender!.label} · ${staffSheets.length} bank letter(s)`
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
            {frSheets.map((sheet, i) => {
              const bank = sheet.lines[0]?.user.bank_name || "—";
              return (
                <FrTransferLetterPrint
                  key={`${bank}-${i}`}
                  sheet={sheet}
                  transferToBank={bank}
                />
              );
            })}
          </div>
        </div>
      ) : staffSheets.length > 0 ? (
        <StaffPayoutPrint
          ref={letterRef}
          sheets={staffSheets}
          preview
        />
      ) : null}
    </PagePane>
  );
}
