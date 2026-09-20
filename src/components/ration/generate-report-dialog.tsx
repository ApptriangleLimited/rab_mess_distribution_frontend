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
import { loadLiveReportSource } from "@/lib/api/report-source";
import { parseMonthInput } from "@/lib/date";
import { CONSUME_LEDGER_TAGS } from "@/lib/constants";
import { sendersForReportTag } from "@/lib/store/senders";
import type { DailyTag } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";

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
  const [senderId, setSenderId] = useState("");
  const previewMonth = parseMonthInput(month || defaultMonth);
  useReportSource({ month: previewMonth });

  useEffect(() => {
    if (!open) return;
    setMonth(defaultMonth);
    setTag("");
    setSenderId("");
  }, [open, defaultMonth]);

  const senders = sendersForReportTag(state.senders, tag);
  const canGenerate = Boolean(tag && senderId);

  function onTagChange(nextTag: DailyTag | "all") {
    setTag(nextTag);
    const match = sendersForReportTag(state.senders, nextTag)[0] ?? null;
    setSenderId(match?.id ?? "");
  }

  function onGenerate() {
    if (!tag || !senderId) return;
    const parsed = parseMonthInput(month);
    const qs = new URLSearchParams({
      month: parsed,
      tag,
      sender: senderId,
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
              {CONSUME_LEDGER_TAGS.map((code) => (
                <SelectItem key={code} value={code}>
                  {tagLabel(code, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("ration.reportBank")}</Label>
          <Select
            value={senderId || undefined}
            onValueChange={setSenderId}
            disabled={!tag}
          >
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue placeholder={t("ration.selectBank")} />
            </SelectTrigger>
            <SelectContent>
              {senders.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!canGenerate ? (
          <p className="text-xs text-neutral-500">
            {`${t("ration.selectTag")} · ${t("ration.selectBank")}`}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
