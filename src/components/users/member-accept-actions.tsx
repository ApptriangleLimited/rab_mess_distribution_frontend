"use client";

import { useState, type ReactNode } from "react";
import { IconCircleCheckFilled, IconCircleXFilled } from "@tabler/icons-react";
import { rowActionClass } from "@/components/users/row-action-btn";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserConfirmCard } from "@/components/daily/user-confirm-card";
import { UserDetail } from "@/components/users/user-detail";
import { TagSelector } from "@/components/daily/tag-selector";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import { approveUser, rejectUser } from "@/lib/store/daily";
import { getAssignment, setTag } from "@/lib/store/assignments";
import { updateUser } from "@/lib/store/users";
import { userToFormValues } from "@/components/users/user-form";
import {
  createDutyTagRequest,
  dutyTagQueue,
} from "@/lib/store/tag-requests";
import {
  isTrgTag,
  needsTrgSardaPrompt,
  resolveTrgTone,
} from "@/lib/trg-tone";
import { todayISO } from "@/lib/date";
import { useT } from "@/i18n/provider";
import type { DailyTag, User } from "@/lib/types";

type PendingAction = "accept" | "reject" | null;

/** Accept / reject pending member — toolbar buttons for page header. */
export function MemberAcceptActions({
  user,
  withTag = false,
  iconOnly = false,
  after,
}: {
  user: User;
  withTag?: boolean;
  /** Compact icon buttons for list rows. */
  iconOnly?: boolean;
  /** Renders after Accept/Reject (e.g. Edit). */
  after?: ReactNode;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionTag, setActionTag] = useState<DailyTag>("MS");
  const [sardaChecked, setSardaChecked] = useState(false);
  const showSarda =
    pendingAction === "accept" &&
    withTag &&
    isTrgTag(actionTag) &&
    needsTrgSardaPrompt(user.force);

  const pending = user.approval_status === "pending";

  function open(type: "accept" | "reject") {
    if (withTag) {
      const existing = getAssignment(user.id, todayISO());
      setActionTag(existing?.tag ?? "MS");
      setSardaChecked(false);
    }
    setPendingAction(type);
  }

  function confirm() {
    if (!pendingAction) return;
    if (pendingAction === "accept") {
      if (withTag) {
        if (!actionTag) {
          toast(t("daily.tagRequired"), "error");
          return;
        }
        const queue = dutyTagQueue(actionTag);
        if (queue === "immediate") {
          setTag(user.id, todayISO(), actionTag);
          updateUser(user.id, {
            ...userToFormValues(user),
            default_tag: actionTag,
          });
        } else {
          createDutyTagRequest({
            userId: user.id,
            toTag: actionTag,
            fromDate: todayISO(),
            toDate: todayISO(),
            queue,
            trg_tone: isTrgTag(actionTag)
              ? resolveTrgTone(user.force, sardaChecked)
              : undefined,
            trg_sarda: isTrgTag(actionTag) ? sardaChecked : undefined,
          });
          toast(
            queue === "ration"
              ? t("daily.queuedRation", { tag: actionTag })
              : t("daily.queuedConsume", { tag: actionTag }),
            "success",
          );
        }
      }
      approveUser(user.id);
      toast(t("daily.approvedToast"), "success");
    } else {
      rejectUser(user.id);
      toast(t("daily.rejectedToast"), "success");
    }
    setPendingAction(null);
  }

  const copy =
    pendingAction === "accept"
      ? {
          title: t("confirm.approveTitle"),
          body: t("confirm.approveBodyShort"),
          label: t("daily.approve"),
          tone: "success" as const,
        }
      : {
          title: t("confirm.rejectTitle"),
          body: t("confirm.rejectBodyShort"),
          label: t("daily.reject"),
          tone: "danger" as const,
        };

  return (
    <>
      {iconOnly || pending ? (
        <>
          <Button
            type="button"
            variant={iconOnly ? "ghost" : "cta"}
            size={iconOnly ? "icon" : "sm"}
            disabled={iconOnly && !pending}
            className={iconOnly ? rowActionClass("approve") : "rounded-lg"}
            aria-label={t("daily.approve")}
            onClick={() => open("accept")}
          >
            <IconCircleCheckFilled className="h-4 w-4" />
            {iconOnly ? null : t("daily.approve")}
          </Button>
          <Button
            type="button"
            variant={iconOnly ? "ghost" : "outline"}
            size={iconOnly ? "icon" : "sm"}
            disabled={iconOnly && !pending}
            className={iconOnly ? rowActionClass("reject") : "rounded-lg"}
            aria-label={t("daily.reject")}
            onClick={() => open("reject")}
          >
            <IconCircleXFilled className="h-4 w-4" />
            {iconOnly ? null : t("daily.reject")}
          </Button>
        </>
      ) : null}
      {after}

      <ConfirmDialog
        open={!!pendingAction}
        tone={copy.tone}
        title={copy.title}
        body={copy.body}
        confirmLabel={copy.label}
        compact={pendingAction === "accept"}
        panelClassName={
          pendingAction === "accept"
            ? "max-w-5xl max-h-[calc(100dvh-1.5rem)]"
            : undefined
        }
        onCancel={() => setPendingAction(null)}
        onConfirm={confirm}
      >
        <div className="space-y-3">
          {pendingAction === "accept" ? (
            <UserDetail user={user} />
          ) : (
            <UserConfirmCard user={user} />
          )}
          {pendingAction === "accept" && withTag ? (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900/60">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {t("daily.setTag")}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {t("daily.setTagHint")}
                </p>
              </div>
              <TagSelector
                value={actionTag}
                onChange={(next) => {
                  if (next) {
                    setActionTag(next);
                    setSardaChecked(false);
                  }
                }}
                className="h-9 min-w-[12rem] rounded-lg"
              />
            </div>
          ) : null}
          {showSarda ? (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200/90 bg-neutral-50/80 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900/70">
              <input
                type="checkbox"
                checked={sardaChecked}
                onChange={(e) => setSardaChecked(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-primary accent-primary"
              />
              <span className="font-medium text-neutral-800 dark:text-neutral-100">
                {t("daily.sardaLabel")}
              </span>
              <span className="ml-auto text-xs text-neutral-500">
                {sardaChecked ? t("daily.sardaBlack") : t("daily.sardaRed")}
              </span>
            </label>
          ) : null}
        </div>
      </ConfirmDialog>
    </>
  );
}
