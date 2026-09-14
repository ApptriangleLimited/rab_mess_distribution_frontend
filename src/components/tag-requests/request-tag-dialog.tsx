"use client";

import { useState } from "react";
import { IconSend, IconSend2 } from "@tabler/icons-react";
import { IconTip } from "@/components/shared/icon-tip";
import { rowActionClass } from "@/components/users/row-action-btn";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ColoredTagGrid } from "@/components/daily/colored-tag-grid";
import { TagChip } from "@/components/tag-requests/tag-chip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import { ApiClientError } from "@/lib/api/client";
import { notifyCcDataChange } from "@/lib/api/cc-events";
import { isCcApiEnabled } from "@/lib/api/mode";
import { createTagRequestApi, requestToTagRequest } from "@/lib/api/tag-requests";
import {
  canRequestTag,
  createTagRequest,
  getCockpitTagOnDate,
  getPendingTagRequest,
  upsertLocalTagRequest,
} from "@/lib/store/tag-requests";
import { isMfrLocked, FR_TAG } from "@/lib/store/daily";
import { todayISO } from "@/lib/date";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { DailyTag, User } from "@/lib/types";

export function RequestTagButton({
  user,
  size = "sm",
  iconOnly = false,
  className,
}: {
  user: User;
  size?: "sm" | "xs";
  iconOnly?: boolean;
  className?: string;
}) {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const state = useStore();
  const apiOn = isCcApiEnabled();
  void state.tag_requests;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = getPendingTagRequest(user.id);
  const today = todayISO();
  const [tag, setTag] = useState<DailyTag | "">(pending?.to_tag ?? "");
  const [from, setFrom] = useState(pending?.from_date || today);
  const [to, setTo] = useState(pending?.to_date || pending?.from_date || today);
  const current = getCockpitTagOnDate(user, from || today);
  const allowed = canRequestTag(user);

  function openDialog(e?: { stopPropagation?: () => void }) {
    e?.stopPropagation?.();
    if (!allowed) {
      toast(t("tagRequest.cannotRequest"), "error");
      return;
    }
    setTag(pending?.to_tag ?? "");
    setFrom(pending?.from_date || today);
    setTo(pending?.to_date || pending?.from_date || today);
    setOpen(true);
  }

  async function confirm() {
    if (busy) return;
    if (!from || !to) {
      toast(t("tagRequest.dateRangeRequired"), "error");
      return;
    }
    if (!tag) {
      toast(t("daily.tagRequired"), "error");
      return;
    }
    if (tag === current) {
      toast(t("tagRequest.sameTag"), "error");
      return;
    }
    if (apiOn) {
      setBusy(true);
      try {
        const created = await createTagRequestApi({
          userId: user.id,
          toTag: tag,
          from,
          to,
        });
        upsertLocalTagRequest(requestToTagRequest(created));
        notifyCcDataChange();
        toast(t("tagRequest.requestToast"), "success");
        setOpen(false);
      } catch (err) {
        toast(
          err instanceof ApiClientError ? err.detail : t("tagRequest.cannotRequest"),
          "error",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    const row = createTagRequest(user.id, tag, "cc", { from, to });
    if (!row) {
      toast(t("tagRequest.cannotRequest"), "error");
      return;
    }
    toast(t("tagRequest.requestToast"), "success");
    setOpen(false);
  }

  if (!allowed && !iconOnly) return null;

  const requestLabel = pending ? t("tagRequest.requested") : t("tagRequest.request");
  const requestButton = (
      <Button
        type="button"
        variant={iconOnly ? "ghost" : pending ? "outline" : "cta"}
        size={iconOnly ? "icon" : "sm"}
        disabled={!allowed}
        className={cn(
          iconOnly
            ? rowActionClass(pending ? "requestPending" : "request")
            : cn("rounded-lg", size === "xs" && "h-7 px-2 text-[11px]"),
          className,
        )}
        title={requestLabel}
        aria-label={requestLabel}
        onClick={openDialog}
      >
        {iconOnly ? (
          <IconSend2 className="h-4 w-4" />
        ) : (
          <IconSend className="h-3.5 w-3.5" />
        )}
        {iconOnly ? null : requestLabel}
      </Button>
  );

  return (
    <>
      {iconOnly ? <IconTip label={requestLabel}>{requestButton}</IconTip> : requestButton}
      <ConfirmDialog
        open={open}
        compact
        tone="success"
        title={t("tagRequest.requestTitle")}
        body={t("tagRequest.requestBody", { name: user.name })}
        confirmLabel={busy ? t("common.sending") : t("tagRequest.request")}
        busy={busy}
        panelClassName="max-w-lg"
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900/60">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {t("tagRequest.currentTag")}
            </span>
            <TagChip tag={current} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {t("common.dateRange")}
            </p>
            <DateRangePicker
              from={from}
              to={to}
              min={user.joining_date || undefined}
              max={user.out_date || undefined}
              maxSpanDays={31}
              onChange={({ from: nextFrom, to: nextTo }) => {
                setFrom(nextFrom);
                setTo(nextTo);
              }}
              label={t("common.dateRange")}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {t("tagRequest.requestedTag")}
            </p>
            <ColoredTagGrid
              value={tag}
              onPick={(next) => setTag(next)}
              locale={locale}
              columns={4}
              allowedTags={isMfrLocked(user) ? [FR_TAG] : undefined}
            />
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
