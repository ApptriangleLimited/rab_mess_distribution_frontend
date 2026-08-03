"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MemberSearchSelect } from "@/components/ration/member-search-select";
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
import { DAILY_TAGS } from "@/lib/constants";
import { parseMonthInput } from "@/lib/date";
import { buildRationStaffLines } from "@/lib/reports";
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
  const [month, setMonth] = useState(defaultMonth);
  const [tag, setTag] = useState<DailyTag | "">("");
  const [senderId, setSenderId] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    if (!open) return;
    setMonth(defaultMonth);
    setTag("");
    setSenderId("");
    setUserId("");
  }, [open, defaultMonth]);

  const senders = state.senders;
  const isFr = tag === "FR";

  const frMembers = useMemo(() => {
    if (!isFr || !senderId) return [];
    const parsed = parseMonthInput(month);
    const sheets = buildRationStaffLines(parsed, senderId, "FR");
    return sheets[0]?.lines.map((l) => l.user) ?? [];
  }, [isFr, senderId, month, state.assignments, state.users, state.rates]);

  useEffect(() => {
    if (!isFr) {
      setUserId("");
      return;
    }
    if (userId && !frMembers.some((u) => u.id === userId)) {
      setUserId("");
    }
  }, [isFr, frMembers, userId]);

  const canGenerate = Boolean(
    tag && senderId && (!isFr || userId),
  );

  function senderForTag(nextTag: DailyTag) {
    return (
      senders.find((s) => s.mapped_tags.includes(nextTag)) ??
      senders[0] ??
      null
    );
  }

  function onTagChange(nextTag: DailyTag) {
    setTag(nextTag);
    setUserId("");
    const match = senderForTag(nextTag);
    if (match) setSenderId(match.id);
  }

  function onGenerate() {
    if (!tag || !senderId) return;
    if (isFr && !userId) return;
    const parsed = parseMonthInput(month);
    const qs = new URLSearchParams({
      month: parsed,
      tag,
      sender: senderId,
    });
    if (isFr) qs.set("user", userId);
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
            onChange={(e) => {
              setMonth(e.target.value);
              setUserId("");
            }}
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
              {DAILY_TAGS.map((opt) => (
                <SelectItem key={opt.code} value={opt.code}>
                  {opt.code} — {tagLabel(opt.code, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("ration.reportBank")}</Label>
          <Select
            value={senderId || undefined}
            onValueChange={(id) => {
              setSenderId(id);
              setUserId("");
            }}
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
        {isFr ? (
          <div className="space-y-1.5">
            <Label>{t("ration.reportMember")}</Label>
            <MemberSearchSelect
              users={frMembers}
              value={userId}
              onChange={setUserId}
            />
          </div>
        ) : null}
        {!canGenerate ? (
          <p className="text-xs text-neutral-500">
            {isFr
              ? `${t("ration.selectTag")} · ${t("ration.selectBank")} · ${t("ration.selectMember")}`
              : `${t("ration.selectTag")} · ${t("ration.selectBank")}`}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
