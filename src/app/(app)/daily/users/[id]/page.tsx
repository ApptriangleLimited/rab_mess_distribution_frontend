"use client";

import { useState } from "react";
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
import { setUserStatus } from "@/lib/store/daily";
import { useT } from "@/i18n/provider";
import type { UserStatus } from "@/lib/types";

export default function DailyUserDetailPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const state = useStore();
  const user = state.users.find((u) => u.id === params.id) ?? null;

  const [statusNext, setStatusNext] = useState<UserStatus | null>(null);

  function confirmStatus() {
    if (!user || !statusNext) return;
    setUserStatus(user.id, statusNext);
    toast(
      statusNext === "1"
        ? t("daily.activatedToast")
        : t("daily.deactivatedToast"),
      "success",
    );
    setStatusNext(null);
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

  return (
    <PagePane>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
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
            <div className="flex flex-wrap items-center justify-between gap-3">
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
                onToggle={(next) => setStatusNext(next)}
              />
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
          statusNext === "0" ? t("daily.deactivate") : t("daily.activate")
        }
        onCancel={() => setStatusNext(null)}
        onConfirm={confirmStatus}
      >
        <UserConfirmCard user={user} />
      </ConfirmDialog>
    </PagePane>
  );
}
