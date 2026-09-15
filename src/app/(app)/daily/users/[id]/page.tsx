"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { IconArrowLeft, IconPencil } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { SectionCard } from "@/components/shared/section-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserConfirmCard } from "@/components/daily/user-confirm-card";
import { StatusToggle } from "@/components/daily/status-toggle";
import { UserDetail } from "@/components/users/user-detail";
import { MemberAcceptActions } from "@/components/users/member-accept-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import { ApiClientError } from "@/lib/api/client";
import { notifyCcDataChange, onCcDataChange } from "@/lib/api/cc-events";
import { TagSelector } from "@/components/daily/tag-selector";
import { getMember, memberToUser, updateMemberStatus, updateMemberTag } from "@/lib/api/members";
import { isDailyApiEnabled } from "@/lib/api/mode";
import { setUserStatus } from "@/lib/store/daily";
import { updateUser } from "@/lib/store/users";
import { userToFormValues } from "@/components/users/user-form";
import { useT } from "@/i18n/provider";
import type { DailyTag, User, UserStatus } from "@/lib/types";

export default function DailyUserDetailPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const state = useStore();
  const apiOn = isDailyApiEnabled();
  const [apiUser, setApiUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(apiOn);
  const [reloadTick, setReloadTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [statusNext, setStatusNext] = useState<UserStatus | null>(null);

  useEffect(() => onCcDataChange(() => setReloadTick((n) => n + 1)), []);

  useEffect(() => {
    if (!apiOn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getMember(params.id)
      .then((row) => {
        if (!cancelled) setApiUser(memberToUser(row));
      })
      .catch((err) => {
        if (cancelled) return;
        setApiUser(null);
        toast(
          err instanceof ApiClientError ? err.detail : t("cc.notFound"),
          "error",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, params.id, reloadTick, t, toast]);

  const user = apiOn
    ? apiUser
    : (state.users.find((u) => u.id === params.id) ?? null);

  async function confirmStatus() {
    if (!user || !statusNext || busy) return;
    if (apiOn) {
      setBusy(true);
      try {
        await updateMemberStatus(user.id, statusNext);
        notifyCcDataChange();
        toast(
          statusNext === "1"
            ? t("daily.activatedToast")
            : t("daily.deactivatedToast"),
          "success",
        );
        setStatusNext(null);
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
    setUserStatus(user.id, statusNext);
    toast(
      statusNext === "1"
        ? t("daily.activatedToast")
        : t("daily.deactivatedToast"),
      "success",
    );
    setStatusNext(null);
  }

  if (loading) {
    return (
      <PagePane>
        <p className="py-10 text-center text-sm text-neutral-500">
          {t("common.loading")}
        </p>
      </PagePane>
    );
  }

  if (!user) {
    return (
      <PagePane>
        <SectionCard>
          <p className="text-sm text-neutral-600">{t("cc.notFound")}</p>
          <Button asChild className="mt-4" variant="cta">
            <Link href="/daily/roster">{t("common.back")}</Link>
          </Button>
        </SectionCard>
      </PagePane>
    );
  }

  const isApproved = user.approval_status === "approved";

  async function onDefaultTag(tag: DailyTag) {
    if (!user || busy) return;
    if (apiOn) {
      setBusy(true);
      try {
        const row = await updateMemberTag(user.id, tag);
        setApiUser(memberToUser(row));
        notifyCcDataChange();
        toast(t("daily.tagUpdatedToast"), "success");
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
    updateUser(user.id, {
      ...userToFormValues(user),
      default_tag: tag,
    });
    toast(t("daily.tagUpdatedToast"), "success");
  }

  return (
    <PagePane>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3"
      >
        <PageHeader
          title={user.name}
          subtitle={t("pages.dailyUserDetail.subtitle")}
          leading={
            <Button
              asChild
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label={t("common.back")}
            >
              <Link href="/daily/roster">
                <IconArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          }
          actions={
            <MemberAcceptActions
              user={user}
              withTag
              after={
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                >
                  <Link href={`/daily/users/${user.id}/edit`}>
                    <IconPencil className="h-3.5 w-3.5" />
                    {t("common.edit")}
                  </Link>
                </Button>
              }
            />
          }
        />

        <UserDetail user={user} />

        {isApproved ? (
          <SectionCard>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {t("daily.defaultTag")}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {t("daily.changeDefaultTagHint")}
                  </p>
                </div>
                <TagSelector
                  value={user.default_tag || ""}
                  disabled={busy}
                  allowedTags={
                    user.default_tag === "MFR" ? ["FR", "MFR"] : undefined
                  }
                  onChange={(tag) => {
                    if (!tag || tag === user.default_tag) return;
                    void onDefaultTag(tag);
                  }}
                  className="h-9 min-w-[12rem] rounded-lg"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 pt-3 dark:border-neutral-700">
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {t("cc.fields.status")}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {user.status === "1"
                      ? t("cc.statusActive")
                      : t("cc.statusInactive")}
                  </p>
                </div>
                <StatusToggle
                  user={user}
                  disabled={busy}
                  onToggle={(next) => setStatusNext(next)}
                />
              </div>
            </div>
          </SectionCard>
        ) : null}
      </motion.div>

      <ConfirmDialog
        open={!!statusNext}
        tone={statusNext === "0" ? "danger" : "success"}
        title={
          statusNext === "0"
            ? t("confirm.deactivateTitle")
            : t("confirm.activateTitle")
        }
        body={
          statusNext === "0"
            ? t("confirm.deactivateBodyShort")
            : t("confirm.activateBodyShort")
        }
        confirmLabel={
          busy
            ? t("common.saving")
            : statusNext === "0"
              ? t("daily.deactivate")
              : t("daily.activate")
        }
        busy={busy}
        onCancel={() => setStatusNext(null)}
        onConfirm={confirmStatus}
      >
        <UserConfirmCard user={user} />
      </ConfirmDialog>
    </PagePane>
  );
}
