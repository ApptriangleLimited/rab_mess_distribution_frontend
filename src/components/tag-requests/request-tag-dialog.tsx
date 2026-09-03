"use client";

import { useState } from "react";
import { IconSend } from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ColoredTagGrid } from "@/components/daily/colored-tag-grid";
import { TagChip } from "@/components/tag-requests/tag-chip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import {
  canRequestTag,
  createTagRequest,
  getCockpitTagOnDate,
  getPendingTagRequest,
} from "@/lib/store/tag-requests";
import { todayISO } from "@/lib/date";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { DailyTag, User } from "@/lib/types";

export function RequestTagButton({
  user,
  size = "sm",
  className,
}: {
  user: User;
  size?: "sm" | "xs";
  className?: string;
}) {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const state = useStore();
  void state.tag_requests;
  const [open, setOpen] = useState(false);
  const current = getCockpitTagOnDate(user, todayISO());
  const pending = getPendingTagRequest(user.id);
  const [tag, setTag] = useState<DailyTag | "">(pending?.to_tag ?? "");
  const allowed = canRequestTag(user);

  function openDialog(e?: { stopPropagation?: () => void }) {
    e?.stopPropagation?.();
    if (!allowed) {
      toast(t("tagRequest.cannotRequest"), "error");
      return;
    }
    setTag(pending?.to_tag ?? "");
    setOpen(true);
  }

  function confirm() {
    if (!tag) {
      toast(t("daily.tagRequired"), "error");
      return;
    }
    if (tag === current) {
      toast(t("tagRequest.sameTag"), "error");
      return;
    }
    const row = createTagRequest(user.id, tag);
    if (!row) {
      toast(t("tagRequest.cannotRequest"), "error");
      return;
    }
    toast(t("tagRequest.requestToast"), "success");
    setOpen(false);
  }

  if (!allowed) return null;

  return (
    <>
      <Button
        type="button"
        variant={pending ? "outline" : "cta"}
        size={size === "xs" ? "sm" : "sm"}
        className={cn("rounded-lg", size === "xs" && "h-7 px-2 text-[11px]", className)}
        onClick={openDialog}
      >
        <IconSend className="h-3.5 w-3.5" />
        {pending ? t("tagRequest.requested") : t("tagRequest.request")}
      </Button>
      <ConfirmDialog
        open={open}
        compact
        tone="success"
        title={t("tagRequest.requestTitle")}
        body={t("tagRequest.requestBody", { name: user.name })}
        confirmLabel={t("tagRequest.request")}
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
              {t("tagRequest.requestedTag")}
            </p>
            <ColoredTagGrid
              value={tag}
              onPick={(next) => setTag(next)}
              locale={locale}
              columns={4}
            />
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
