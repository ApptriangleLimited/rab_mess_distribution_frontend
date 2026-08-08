"use client";

import { useEffect, useState } from "react";
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
import { useStore } from "@/hooks/use-store";
import { parseMonthInput } from "@/lib/date";
import { listAllTags } from "@/lib/store/rates";
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
  const state = useStore();
  const tags = listAllTags();
  const [month, setMonth] = useState(defaultMonth);
  const [tag, setTag] = useState<DailyTag | "">("");
  const [senderId, setSenderId] = useState("");

  useEffect(() => {
    if (!open) return;
    setMonth(defaultMonth);
    setTag("");
    setSenderId("");
  }, [open, defaultMonth]);

  const senders = state.senders;
  const canGenerate = Boolean(tag && senderId);

  function senderForTag(nextTag: DailyTag) {
    return (
      senders.find((s) => s.mapped_tags.includes(nextTag)) ??
      senders[0] ??
      null
    );
  }

  function onTagChange(nextTag: DailyTag) {
    setTag(nextTag);
    const match = senderForTag(nextTag);
    if (match) setSenderId(match.id);
  }

  function onGenerate() {
    if (!tag || !senderId) return;
    const parsed = parseMonthInput(month);
    const qs = new URLSearchParams({
      month: parsed,
      tag,
      sender: senderId,
    });
    window.open(`/ration/report/preview?${qs.toString()}`, "_blank");
    onClose();
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
            onValueChange={(v) => onTagChange(v as DailyTag)}
          >
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue placeholder={t("ration.selectTag")} />
            </SelectTrigger>
            <SelectContent>
              {tags.map((code) => (
                <SelectItem key={code} value={code}>
                  {code} — {tagLabel(code, locale)}
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
          >
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue placeholder={t("ration.selectBank")} />
            </SelectTrigger>
            <SelectContent>
              {senders.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                  {s.bank_name ? ` · ${s.bank_name}` : ""}
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
