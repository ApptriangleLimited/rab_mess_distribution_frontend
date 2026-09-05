"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IconArrowLeft, IconUser } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { CcTabs } from "@/components/layout/cc-tabs";
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

export default function CcEditUserPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const state = useStore();
  const user = state.users.find((u) => u.id === params.id) ?? null;
  const detailHref = `/cc/users/${params.id}`;

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
            <Link href="/cc/users">{t("common.back")}</Link>
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
          title={t("pages.ccEditUser.title")}
          subtitle={t("pages.ccEditUser.subtitle")}
          center={<CcTabs />}
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
          actions={
            <div className="hidden items-center gap-2.5 lg:flex">
              <div className="relative h-9 w-12 shrink-0" aria-hidden>
                <span className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-primary/30" />
                <span className="absolute left-3 top-0 h-6 w-6 rounded-full bg-primary/50" />
                <span className="absolute left-5 top-2 h-6 w-6 rounded-full bg-emerald-400/35" />
              </div>
              <p className="max-w-[8.75rem] text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
                {t("cc.formTagline")}
              </p>
            </div>
          }
        />
        <UserForm
          mode="edit"
          initial={userToFormValues(user)}
          onSubmit={onSubmit}
          onCancel={() => router.push(detailHref)}
        />
      </motion.div>
    </PagePane>
  );
}
