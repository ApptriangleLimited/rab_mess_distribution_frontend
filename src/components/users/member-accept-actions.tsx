"use client";

import { useState, type ReactNode } from "react";
import { IconCircleCheckFilled, IconCircleXFilled } from "@tabler/icons-react";
import { IconTip } from "@/components/shared/icon-tip";
import { rowActionClass } from "@/components/users/row-action-btn";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserConfirmCard } from "@/components/daily/user-confirm-card";
import { UserDetail } from "@/components/users/user-detail";
import { TagSelector } from "@/components/daily/tag-selector";
import { TrgToneHint } from "@/components/daily/trg-sarda-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { notifyCcDataChange } from "@/lib/api/cc-events";
import { acceptMember, rejectMember } from "@/lib/api/members";
import { isCcApiEnabled } from "@/lib/api/mode";
import { createTagRequestApi, requestToTagRequest } from "@/lib/api/tag-requests";
import { approveUser, rejectUser } from "@/lib/store/daily";
import { setTag } from "@/lib/store/assignments";
import { updateUser } from "@/lib/store/users";
import { userToFormValues } from "@/components/users/user-form";
import {
  createDutyTagRequest,
  dutyTagQueue,
  upsertLocalTagRequest,
} from "@/lib/store/tag-requests";
import {
  isTrgTag,
  needsTrgPrompt,
  needsTrgSardaPrompt,
  resolveTrgTone,
  trgChoiceRequired,
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
  const apiOn = isCcApiEnabled();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [actionTag, setActionTag] = useState<DailyTag | "">("");
  const [tagError, setTagError] = useState(false);
  const [trgChoiceError, setTrgChoiceError] = useState(false);
  const [sardaChecked, setSardaChecked] = useState(false);
  const [trainingChecked, setTrainingChecked] = useState(false);
  const needsTag = withTag && user.member_type !== "civilian";
  const showTrgPrompt =
    pendingAction === "accept" &&
    needsTag &&
    isTrgTag(actionTag) &&
    needsTrgPrompt(user.force);
  const showSarda = showTrgPrompt && needsTrgSardaPrompt(user.force);

  const pending = user.approval_status === "pending";

  function open(type: "accept" | "reject") {
    if (needsTag) {
      setActionTag(user.default_tag || "");
      setSardaChecked(false);
      setTrainingChecked(false);
    }
    setTagError(false);
    setTrgChoiceError(false);
    setPendingAction(type);
  }

  async function confirm() {
    if (!pendingAction || busy) return;
    if (pendingAction === "accept" && needsTag && !actionTag) {
      setTagError(true);
      return;
    }
    if (
      pendingAction === "accept" &&
      needsTag &&
      isTrgTag(actionTag) &&
      trgChoiceRequired(user.force, trainingChecked, sardaChecked)
    ) {
      setTrgChoiceError(true);
      return;
    }

    if (apiOn) {
      setBusy(true);
      try {
        if (pendingAction === "accept") {
          const trgTone = isTrgTag(actionTag)
            ? resolveTrgTone(user.force, trainingChecked, sardaChecked)
            : undefined;
          const queue =
            needsTag && actionTag ? dutyTagQueue(actionTag, trgTone) : "immediate";
          await acceptMember(user.id, needsTag && actionTag ? actionTag : undefined);
          if (needsTag && actionTag && queue !== "immediate") {
            const created = await createTagRequestApi({
              userId: user.id,
              toTag: actionTag,
              from: todayISO(),
              to: todayISO(),
              queue,
              trg_tone: trgTone,
              trg_sarda:
                isTrgTag(actionTag) && needsTrgSardaPrompt(user.force)
                  ? sardaChecked
                  : undefined,
            });
            upsertLocalTagRequest(requestToTagRequest(created));
            toast(
              queue === "ration"
                ? t("daily.queuedRation", { tag: actionTag })
                : t("daily.queuedConsume", { tag: actionTag }),
              "success",
            );
          }
          toast(t("daily.approvedToast"), "success");
        } else {
          await rejectMember(user.id);
          toast(t("daily.rejectedToast"), "success");
        }
        notifyCcDataChange();
        setPendingAction(null);
      } catch (err) {
        toast(
          err instanceof ApiClientError ? err.detail : t("cc.createFail"),
          "error",
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    if (pendingAction === "accept") {
      if (needsTag && actionTag) {
        const trgTone = isTrgTag(actionTag)
          ? resolveTrgTone(user.force, trainingChecked, sardaChecked)
          : undefined;
        const queue = dutyTagQueue(actionTag, trgTone);
        updateUser(user.id, {
          ...userToFormValues(user),
          default_tag: actionTag,
        });
        if (queue === "immediate") {
          setTag(
            user.id,
            todayISO(),
            actionTag,
            "daily",
            trgTone ? { trg_tone: trgTone } : undefined,
          );
        } else {
          createDutyTagRequest({
            userId: user.id,
            toTag: actionTag,
            fromDate: todayISO(),
            toDate: todayISO(),
            queue,
            trg_tone: trgTone,
            trg_sarda:
              isTrgTag(actionTag) && needsTrgSardaPrompt(user.force)
                ? sardaChecked
                : undefined,
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
          {iconOnly ? (
            <IconTip label={t("daily.approve")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!pending}
                className={rowActionClass("approve")}
                title={t("daily.approve")}
                aria-label={t("daily.approve")}
                onClick={() => open("accept")}
              >
                <IconCircleCheckFilled className="h-4 w-4" />
              </Button>
            </IconTip>
          ) : (
            <Button
              type="button"
              variant="cta"
              size="sm"
              className="rounded-lg"
              aria-label={t("daily.approve")}
              onClick={() => open("accept")}
            >
              <IconCircleCheckFilled className="h-4 w-4" />
              {t("daily.approve")}
            </Button>
          )}
          {iconOnly ? (
            <IconTip label={t("daily.reject")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!pending}
                className={rowActionClass("reject")}
                title={t("daily.reject")}
                aria-label={t("daily.reject")}
                onClick={() => open("reject")}
              >
                <IconCircleXFilled className="h-4 w-4" />
              </Button>
            </IconTip>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              aria-label={t("daily.reject")}
              onClick={() => open("reject")}
            >
              <IconCircleXFilled className="h-4 w-4" />
              {t("daily.reject")}
            </Button>
          )}
        </>
      ) : null}
      {after}

      <ConfirmDialog
        open={!!pendingAction}
        tone={copy.tone}
        title={copy.title}
        body={copy.body}
        confirmLabel={
          busy
            ? pendingAction === "accept"
              ? t("cc.accepting")
              : t("cc.rejecting")
            : copy.label
        }
        busy={busy}
        compact={pendingAction === "accept"}
        panelClassName={
          pendingAction === "accept"
            ? "max-w-5xl max-h-[calc(100dvh-1.5rem)]"
            : undefined
        }
        confirmDisabled={
          pendingAction === "accept" &&
          showSarda &&
          !sardaChecked &&
          !trainingChecked
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
          {pendingAction === "accept" && needsTag ? (
            <div
              className={
                tagError
                  ? "space-y-2 rounded-xl border border-red-300 bg-red-50/90 px-3 py-2.5 dark:border-red-800 dark:bg-red-950/40"
                  : "space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900/60"
              }
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {t("daily.defaultTag")}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {t("daily.acceptDefaultTagHint")}
                  </p>
                </div>
                <TagSelector
                  value={actionTag}
                  onChange={(next) => {
                    if (next) {
                      setActionTag(next);
                      setTagError(false);
                      setTrgChoiceError(false);
                      setSardaChecked(false);
                      setTrainingChecked(false);
                    }
                  }}
                  className="h-9 min-w-[12rem] rounded-lg"
                />
              </div>
              {tagError ? (
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  {t("daily.tagRequired")}
                </p>
              ) : null}
            </div>
          ) : null}
          {showSarda ? (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200/90 bg-neutral-50/80 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900/70">
              <input
                type="checkbox"
                checked={sardaChecked}
                onChange={(e) => {
                  const next = e.target.checked;
                  setSardaChecked(next);
                  if (next) setTrainingChecked(false);
                  setTrgChoiceError(false);
                }}
                className="h-4 w-4 rounded border-neutral-300 text-primary accent-primary"
              />
              <span className="font-medium text-neutral-800 dark:text-neutral-100">
                {t("daily.sardaLabel")}
              </span>
              <TrgToneHint black />
            </label>
          ) : null}
          {showTrgPrompt ? (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200/90 bg-neutral-50/80 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900/70">
              <input
                type="checkbox"
                checked={trainingChecked}
                onChange={(e) => {
                  const next = e.target.checked;
                  setTrainingChecked(next);
                  if (next && showSarda) setSardaChecked(false);
                  setTrgChoiceError(false);
                }}
                className="h-4 w-4 rounded border-neutral-300 text-primary accent-primary"
              />
              <span className="font-medium text-neutral-800 dark:text-neutral-100">
                {t("daily.trainingLabel")}
              </span>
              <TrgToneHint black={false} />
            </label>
          ) : null}
          {trgChoiceError ? (
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {t("daily.trgChoiceRequired")}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </>
  );
}
