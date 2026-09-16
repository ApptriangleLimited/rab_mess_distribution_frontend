"use client";

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconDownload, IconFileSpreadsheet, IconPrinter } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { CommunityBankLetterPrint } from "@/components/ration/community-bank-letter-print";
import { CommunityFuelLetterPrint } from "@/components/ration/community-fuel-letter-print";
import { FrTransferLetterPrint } from "@/components/ration/fr-transfer-letter-print";
import { SonaliBankLetterPrint } from "@/components/ration/sonali-bank-letter-print";
import { SonaliFuelLetterPrint } from "@/components/ration/sonali-fuel-letter-print";
import { StaffPayoutPrint } from "@/components/ration/staff-payout-print";
import { TrustBankLetterPrint } from "@/components/ration/trust-bank-letter-print";
import { Button } from "@/components/ui/button";
import { useReportSource } from "@/hooks/use-report-source";
import { useStore } from "@/hooks/use-store";
import {
  downloadFrTransferPdf,
  downloadStaffPayoutPdf,
} from "@/lib/download-letter-pdf";
import {
  downloadFrTransferExcel,
  downloadStaffPayoutExcel,
} from "@/lib/download-ration-excel";
import { formatMonthLong, parseMonthInput, todayISO } from "@/lib/date";
import { printLetterElement } from "@/lib/print-letter-pdf";
import {
  buildFrTransferSheetsByMemberBank,
  buildRationStaffLines,
  staffSheetToTransferSheet,
  withReportSource,
} from "@/lib/reports";
import {
  isCommunityBankSheet,
  isCommunityFuelStaffSheet,
} from "@/lib/community-bank-letter";
import { isSonaliBankSheet, isSonaliFuelStaffSheet } from "@/lib/sonali-bank-letter";
import { isTrustBankSheet, isTrustFuelStaffSheet } from "@/lib/trust-bank-letter";
import { REPORT_PAYOUT_TAGS } from "@/lib/official-senders";
import type { DailyTag } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";

const TAGS = new Set<string>([
  ...REPORT_PAYOUT_TAGS,
  "PL",
  "WR",
  "WIT",
  "MS",
]);

function parseTag(raw: string | null): DailyTag | "all" | null {
  if (!raw) return null;
  if (raw.toLowerCase() === "all") return "all";
  const match = [...TAGS].find(
    (code) => code.toLowerCase() === raw.toLowerCase(),
  );
  return match ? (match as DailyTag) : null;
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
  const isAll = tag === "all";
  const isFr = tag === "FR";

  const { source } = useReportSource({ month });

  const staffSheets = useMemo(() => {
    if (!tag || !senderId || isFr) return [];
    return withReportSource(source, () =>
      buildRationStaffLines(month, senderId, isAll ? undefined : tag),
    );
  }, [
    state.assignments,
    state.users,
    state.senders,
    state.rates,
    month,
    tag,
    senderId,
    isAll,
    isFr,
    source,
  ]);

  const frSheets = useMemo(() => {
    if (!isFr || !senderId) return [];
    return withReportSource(source, () =>
      buildFrTransferSheetsByMemberBank(month, senderId, todayISO()),
    );
  }, [
    state.assignments,
    state.users,
    state.senders,
    state.rates,
    month,
    senderId,
    isFr,
    source,
  ]);

  const sender = state.senders.find((s) => s.id === senderId);
  const monthLabel = formatMonthLong(month);

  function onDownloadPdf() {
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

  function onDownloadExcel() {
    if (frSheets.length > 0) {
      downloadFrTransferExcel(
        frSheets,
        `ration-fr-transfer-${month}-${senderId}.xls`,
      );
      return;
    }
    if (!staffSheets.length || !tag) return;
    downloadStaffPayoutExcel(
      staffSheets,
      `ration-staff-${month}-${tag}-${senderId}.xls`,
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
      const landscape =
        frSheets.length > 0 ||
        staffSheets.some(
          (sheet) =>
            (isTrustBankSheet(sheet) && !isTrustFuelStaffSheet(sheet)) ||
            (isCommunityBankSheet(sheet) && !isCommunityFuelStaffSheet(sheet)) ||
            (isSonaliBankSheet(sheet) && !isSonaliFuelStaffSheet(sheet)),
        );
      await printLetterElement(el, name, landscape ? "landscape" : "portrait", {
        skipInlineStyles: true,
      });
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
                : `${isAll ? t("common.all") : tagLabel(tag!, locale)} · ${monthLabel} · ${sender!.label} · ${staffSheets.length} bank letter(s)`
          }
          actions={
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={!canAct}
                onClick={onDownloadExcel}
              >
                <IconFileSpreadsheet className="h-3.5 w-3.5" />
                {t("ration.exportExcel")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={!canAct}
                onClick={onDownloadPdf}
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
              if (isTrustBankSheet(sheet)) {
                return (
                  <TrustBankLetterPrint key={`${bank}-${i}`} sheet={sheet} />
                );
              }
              if (isCommunityBankSheet(sheet)) {
                return (
                  <CommunityBankLetterPrint
                    key={`${bank}-${i}`}
                    sheet={sheet}
                  />
                );
              }
              if (isSonaliBankSheet(sheet)) {
                return (
                  <SonaliBankLetterPrint key={`${bank}-${i}`} sheet={sheet} />
                );
              }
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
        staffSheets.some(
          (sheet) =>
            isTrustBankSheet(sheet) ||
            isCommunityBankSheet(sheet) ||
            isSonaliBankSheet(sheet),
        ) ? (
          <div className="w-full overflow-x-auto pb-2">
            <div
              ref={letterRef}
              data-print-stack="true"
              className="flex w-max min-w-full flex-col gap-6"
            >
              {staffSheets.map((sheet, i) => {
                const bank = sheet.memberBank || sheet.sender.bank_name || "—";
                if (isTrustFuelStaffSheet(sheet)) {
                  return (
                    <StaffPayoutPrint
                      key={`${bank}-${i}`}
                      sheets={[sheet]}
                      preview
                    />
                  );
                }
                if (isTrustBankSheet(sheet)) {
                  return (
                    <TrustBankLetterPrint
                      key={`${bank}-${i}`}
                      sheet={staffSheetToTransferSheet(sheet)}
                    />
                  );
                }
                if (isCommunityFuelStaffSheet(sheet)) {
                  return (
                    <CommunityFuelLetterPrint
                      key={`${bank}-${i}`}
                      sheet={sheet}
                    />
                  );
                }
                if (isCommunityBankSheet(sheet)) {
                  return (
                    <CommunityBankLetterPrint
                      key={`${bank}-${i}`}
                      sheet={staffSheetToTransferSheet(sheet)}
                    />
                  );
                }
                if (isSonaliFuelStaffSheet(sheet)) {
                  return (
                    <SonaliFuelLetterPrint
                      key={`${bank}-${i}`}
                      sheet={sheet}
                    />
                  );
                }
                if (isSonaliBankSheet(sheet)) {
                  return (
                    <SonaliBankLetterPrint
                      key={`${bank}-${i}`}
                      sheet={staffSheetToTransferSheet(sheet)}
                    />
                  );
                }
                return (
                  <StaffPayoutPrint
                    key={`${bank}-${i}`}
                    sheets={[sheet]}
                    preview
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <StaffPayoutPrint ref={letterRef} sheets={staffSheets} preview />
        )
      ) : null}
    </PagePane>
  );
}
