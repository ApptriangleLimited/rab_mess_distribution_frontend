"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { IconArrowLeft, IconPencil } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { UserDetail } from "@/components/users/user-detail";
import { MemberAcceptActions } from "@/components/users/member-accept-actions";
import { useStore } from "@/hooks/use-store";
import { useT } from "@/i18n/provider";

export default function CcUserDetailPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const state = useStore();
  const user = state.users.find((u) => u.id === params.id) ?? null;

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
            <MemberAcceptActions
              user={user}
              after={
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
          }
        />
        <UserDetail user={user} />
      </motion.div>
    </PagePane>
  );
}
