"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReportSource } from "@/hooks/use-report-source";
import { useStore } from "@/hooks/use-store";
import { isApiEnabled } from "@/lib/api/mode";
import { loadLiveReportSource } from "@/lib/api/report-source";
import { listSenders } from "@/lib/api/settings";
import { parseMonthInput } from "@/lib/date";
import { FUEL_RATE_TAG } from "@/lib/constants";
import { senderForMemberBank } from "@/lib/store/senders";
import type { DailyTag, SenderAccount } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";

const REPORT_DIALOG_TAGS: DailyTag[] = [
  "FR",
  FUEL_RATE_TAG,
  "MS",
  "CL",
  "PL",
  "CD",
  "TRG",
  "WIT",
  "MED",
  "BGH",
];

type Props = {
  open: boolean;
  defaultMonth: string;
  onClose: () => void;
};

export function GenerateReportDialog({
  open,
  defaultMonth,
  onClose,
}: Props) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const state = useStore();
  const [month, setMonth] = useState(defaultMonth);
  const [tag, setTag] = useState<DailyTag | "all" | "">("");
  const [memberBank, setMemberBank] = useState("");
  const [liveSenders, setLiveSenders] = useState<SenderAccount[] | null>(null);
  const previewMonth = parseMonthInput(month || defaultMonth);
  useReportSource({ month: previewMonth });

  useEffect(() => {
    if (!open) return;
    setMonth(defaultMonth);
    setTag("");
    setMemberBank("");
  }, [open, defaultMonth]);

  useEffect(() => {
    if (!open || !isApiEnabled()) return;
    let cancelled = false;
    void listSenders()
      .then((res) => {
        if (!cancelled) setLiveSenders(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setLiveSenders(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const memberBanks = state.member_banks;
  const senderAccounts = liveSenders ?? state.senders;
  const matchedSender = senderForMemberBank(senderAccounts, tag, memberBank);
  const canGenerate = Boolean(tag && memberBank && matchedSender);

  function onTagChange(nextTag: DailyTag | "all") {
    setTag(nextTag);
  }

  function onGenerate() {
    if (!tag || !memberBank || !matchedSender) return;
    const parsed = parseMonthInput(month);
    const qs = new URLSearchParams({
      month: parsed,
      tag,
      sender: matchedSender.id,
      back: `${pathname}?month=${parsed}`,
    });
    void loadLiveReportSource({ month: parsed });
    onClose();
    router.push(`/ration/report/preview?${qs.toString()}`);
  }

  if (!open) return null;

  return (
    <ConfirmDialog
      open
      tone="default"
      rootClassName="no-print"
      title={t("ration.generateReportTitle")}
      body={t("ration.generateReportHint")}
      confirmLabel={t("ration.generatePreview")}
      panelClassName="max-w-[33.6rem]"
      onCancel={onClose}
      onConfirm={onGenerate}
    >
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label>{t("ration.reportDate")}</Label>
          <Input
            type="month"
            value={parseMonthInput(month)}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 rounded-lg"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("ration.reportTag")}</Label>
          <Select
            value={tag || undefined}
            onValueChange={(v) => onTagChange(v as DailyTag | "all")}
          >
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue placeholder={t("ration.selectTag")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {REPORT_DIALOG_TAGS.map((code) => (
                <SelectItem key={code} value={code}>
                  {tagLabel(code, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings.tabMemberBank")}</Label>
          <Select
            value={memberBank || undefined}
            onValueChange={setMemberBank}
          >
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue placeholder={t("ration.selectBank")} />
            </SelectTrigger>
            <SelectContent>
              {memberBanks.map((bank) => (
                <SelectItem key={bank} value={bank}>
                  {bank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {memberBanks.length === 0 ? (
          <p className="text-xs text-neutral-500">{t("settings.memberBankEmpty")}</p>
        ) : !canGenerate ? (
          <p className="text-xs text-neutral-500">
            {`${t("ration.selectTag")} · ${t("ration.selectBank")}`}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
