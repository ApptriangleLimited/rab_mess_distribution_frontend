"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { IconArrowLeft, IconPencil } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { SectionCard } from "@/components/shared/section-card";
import { CcTabs } from "@/components/layout/cc-tabs";
import { Button } from "@/components/ui/button";
import { UserDetail } from "@/components/users/user-detail";
import { TagChip } from "@/components/tag-requests/tag-chip";
import { RequestTagButton } from "@/components/tag-requests/request-tag-dialog";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { onCcDataChange } from "@/lib/api/cc-events";
import { getMember, memberToUser } from "@/lib/api/members";
import { isCcApiEnabled } from "@/lib/api/mode";
import { getCockpitTagOnDate } from "@/lib/store/tag-requests";
import { todayISO } from "@/lib/date";
import { useT } from "@/i18n/provider";
import type { User } from "@/lib/types";

export default function CcUserDetailPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const state = useStore();
  const apiOn = isCcApiEnabled();
  const [apiUser, setApiUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(apiOn);
  const [reloadTick, setReloadTick] = useState(0);

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
            <Link href="/cc/users">{t("common.back")}</Link>
          </Button>
        </SectionCard>
      </PagePane>
    );
  }

  return (
    <PagePane>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <PageHeader
          title={user.name}
          subtitle={t("pages.ccUserDetail.subtitle")}
          center={<CcTabs />}
          leading={
            <Button
              asChild
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label={t("common.back")}
            >
              <Link href="/cc/users">
                <IconArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          }
          actions={
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-lg"
            >
              <Link href={`/cc/users/${user.id}/edit`}>
                <IconPencil className="h-3.5 w-3.5" />
                {t("common.edit")}
              </Link>
            </Button>
          }
        />
        <SectionCard className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {t("tagRequest.dutyToday")}
            </p>
            <div className="mt-1.5">
              <TagChip tag={getCockpitTagOnDate(user, todayISO())} />
            </div>
          </div>
          {user.approval_status === "approved" ? (
            <RequestTagButton user={user} />
          ) : null}
        </SectionCard>
        <UserDetail user={user} />
      </motion.div>
    </PagePane>
  );
}
