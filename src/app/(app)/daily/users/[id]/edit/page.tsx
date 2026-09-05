"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IconArrowLeft, IconUser } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import {
  UserForm,
  userToFormValues,
  type UserFormValues,
} from "@/components/users/user-form";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import { findUserByRabId, updateUser } from "@/lib/store/users";
import { useT } from "@/i18n/provider";

export default function DailyEditUserPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const state = useStore();
  const user = state.users.find((u) => u.id === params.id) ?? null;
  const detailHref = `/daily/users/${params.id}`;

  function onSubmit(values: UserFormValues) {
    if (!user) return;
    if (!values.name.trim()) {
      toast(t("cc.nameRequired"), "error");
      return;
    }
    if (!values.rab_id.trim()) {
      toast(t("cc.rabIdRequired"), "error");
      return;
    }
    if (findUserByRabId(values.rab_id, user.id)) {
      toast(t("cc.rabIdDuplicate"), "error");
      return;
    }
    updateUser(user.id, values);
    toast(t("cc.updated"), "success");
    router.push(detailHref);
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

  return (
    <PagePane className="!min-h-0 gap-3 p-3 md:p-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2.5"
      >
        <PageHeader
          title={t("pages.dailyEditUser.title")}
          subtitle={t("pages.dailyEditUser.subtitle")}
          leading={
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                aria-label={t("common.back")}
              >
                <Link href={detailHref}>
                  <IconArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <IconUser className="h-4 w-4" stroke={1.75} />
              </span>
            </div>
          }
        />
        <UserForm
          mode="edit"
          variant="daily"
          initial={userToFormValues(user)}
          onSubmit={onSubmit}
          onCancel={() => router.push(detailHref)}
        />
      </motion.div>
    </PagePane>
  );
}
