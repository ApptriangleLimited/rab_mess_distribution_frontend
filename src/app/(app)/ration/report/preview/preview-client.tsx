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
  buildFrMemberTransferSheet,
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
  const userId = searchParams.get("user") ?? "";
  const isFrMember = tag === "FR" && Boolean(userId);

  const staffSheet = useMemo(() => {
    if (!tag || !senderId || isFrMember) return null;
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
    isFrMember,
  ]);

  const transferSheet = useMemo(() => {
    if (!isFrMember || !senderId || !userId) return null;
    return buildFrMemberTransferSheet(month, senderId, userId, todayISO());
  }, [
    state.assignments,
    state.users,
    state.senders,
    state.rates,
    month,
    senderId,
    userId,
    isFrMember,
  ]);

  const sender = state.senders.find((s) => s.id === senderId);
  const monthLabel = formatMonthLong(month);
  const subject =
    tag && sender && !isFrMember
      ? RATION_REPORT_META.subjectTagBill
          .replace("{monthLabel}", monthLabel)
          .replace("{bank}", sender.bank_name || sender.label)
      : undefined;

  function onDownload() {
    if (transferSheet) {
      downloadFrTransferPdf(
        transferSheet,
        `ration-fr-transfer-${transferSheet.month}-${userId}.pdf`,
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
      const name = transferSheet
        ? `ration-fr-transfer-${month}-${userId}.pdf`
        : `ration-staff-${month}-${tag}-${senderId}.pdf`;
      await printLetterElement(
        el,
        name,
        isFrMember ? "landscape" : "portrait",
      );
    } finally {
      setPrinting(false);
    }
  }

  const invalid = !tag || !senderId || !sender || (isFrMember && !userId);
  const empty = isFrMember
    ? !transferSheet
    : !staffSheet || staffSheet.lines.length === 0;
  const canAct = isFrMember
    ? Boolean(transferSheet?.lines.length)
    : Boolean(staffSheet?.lines.length);

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("ration.reportPreview")}
          subtitle={
            invalid
              ? t("ration.reportPreviewHint")
              : isFrMember
                ? `FR · ${monthLabel} · ${sender!.label} · ${transferSheet?.lines[0]?.customerAccountName ?? ""}`
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
      ) : isFrMember && transferSheet ? (
        <FrTransferLetterPrint
          ref={letterRef}
          sheet={transferSheet}
          transferToBank={transferSheet.lines[0]?.user.bank_name}
        />
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
