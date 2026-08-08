"use client";

import { useState, type ReactNode } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserConfirmCard } from "@/components/daily/user-confirm-card";
import { TagSelector } from "@/components/daily/tag-selector";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import { approveUser, rejectUser } from "@/lib/store/daily";
import { getAssignment, setTag } from "@/lib/store/assignments";
import { todayISO } from "@/lib/date";
import { useT } from "@/i18n/provider";
import type { DailyTag, User } from "@/lib/types";

type PendingAction = "accept" | "reject" | null;

/** Accept / reject pending member — toolbar buttons for page header. */
export function MemberAcceptActions({
  user,
  withTag = false,
  after,
}: {
  user: User;
  withTag?: boolean;
  /** Renders after Accept/Reject (e.g. Edit). */
  after?: ReactNode;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionTag, setActionTag] = useState<DailyTag>("MS");

  const pending = user.approval_status === "pending";

  function open(type: "accept" | "reject") {
    if (withTag) {
      const existing = getAssignment(user.id, todayISO());
      setActionTag(existing?.tag ?? "MS");
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
        setTag(user.id, todayISO(), actionTag);
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
      {pending ? (
        <>
          <Button
            variant="cta"
            size="sm"
            className="rounded-lg"
            onClick={() => open("accept")}
          >
            <IconCheck className="h-3.5 w-3.5" />
            {t("daily.approve")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => open("reject")}
          >
            <IconX className="h-3.5 w-3.5" />
            {t("daily.reject")}
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
        onCancel={() => setPendingAction(null)}
        onConfirm={confirm}
      >
        <div className="space-y-4">
          <UserConfirmCard user={user} />
          {pendingAction === "accept" && withTag ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-3.5 dark:border-neutral-700 dark:bg-neutral-900/60">
              <div className="mb-2.5">
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
                  if (next) setActionTag(next);
                }}
                className="h-9 rounded-lg"
              />
            </div>
          ) : null}
        </div>
      </ConfirmDialog>
    </>
  );
}
