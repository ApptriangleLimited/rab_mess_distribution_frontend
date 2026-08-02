"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ApprovalCard } from "@/components/daily/approval-card";
import { UserConfirmCard } from "@/components/daily/user-confirm-card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/shared/toast-provider";
import { approveUser, endEntry, rejectUser } from "@/lib/store/daily";
import { getAssignment, setTag } from "@/lib/store/assignments";
import { todayISO } from "@/lib/date";
import { TagSelector } from "@/components/daily/tag-selector";
import { useT } from "@/i18n/provider";
import type { DailyTag, User } from "@/lib/types";

type PendingAction =
  | { type: "approve"; user: User }
  | { type: "reject"; user: User }
  | { type: "end"; user: User }
  | null;

export default function ApprovalsPage() {
  const t = useT();
  const state = useStore();
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionTag, setActionTag] = useState<DailyTag>("MS");

  const list = useMemo(
    () => state.users.filter((u) => u.approval_status === "pending"),
    [state.users],
  );

  const user = pending?.user;
  const type = pending?.type;

  function openAction(type: NonNullable<PendingAction>["type"], user: User) {
    const existing = getAssignment(user.id, todayISO());
    setActionTag(existing?.tag ?? "MS");
    setPending({ type, user });
  }

  function close() {
    setPending(null);
  }

  function confirm() {
    if (!pending) return;
    if (!actionTag) {
      toast(t("daily.tagRequired"), "error");
      return;
    }
    setTag(pending.user.id, todayISO(), actionTag);
    if (pending.type === "approve") {
      approveUser(pending.user.id);
      toast(t("daily.approvedToast"), "success");
    } else if (pending.type === "reject") {
      rejectUser(pending.user.id);
      toast(t("daily.rejectedToast"), "success");
    } else {
      endEntry(pending.user.id);
      toast(t("daily.endedToast"), "success");
    }
    close();
  }

  const copy =
    type === "approve"
      ? {
          title: t("confirm.approveTitle"),
          body: t("confirm.approveBodyShort"),
          label: t("daily.approve"),
          tone: "success" as const,
        }
      : type === "reject"
        ? {
            title: t("confirm.rejectTitle"),
            body: t("confirm.rejectBodyShort"),
            label: t("daily.reject"),
            tone: "danger" as const,
          }
        : {
            title: t("confirm.endTitle"),
            body: t("confirm.endBodyShort"),
            label: t("daily.endEntry"),
            tone: "danger" as const,
          };

  return (
    <PagePane>
      <PageHeader
        title={t("pages.approvals.title")}
        subtitle={t("pages.approvals.subtitle", { count: list.length })}
        actions={
          <Button asChild variant="cta" size="sm">
            <Link href="/daily/users/new">
              <IconPlus className="h-3.5 w-3.5" />
              {t("cc.newUser")}
            </Link>
          </Button>
        }
      />
      {list.length === 0 ? (
        <EmptyState title={t("daily.emptyPending")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((u) => (
            <ApprovalCard
              key={u.id}
              user={u}
              onApprove={() => openAction("approve", u)}
              onReject={() => openAction("reject", u)}
              onEnd={() => openAction("end", u)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        tone={copy.tone}
        title={copy.title}
        body={copy.body}
        confirmLabel={copy.label}
        onCancel={close}
        onConfirm={confirm}
      >
        {user ? (
          <div className="space-y-4">
            <UserConfirmCard user={user} />
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
                onChange={(tag) => {
                  if (tag) setActionTag(tag);
                }}
                className="h-9 rounded-lg"
              />
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </PagePane>
  );
}
