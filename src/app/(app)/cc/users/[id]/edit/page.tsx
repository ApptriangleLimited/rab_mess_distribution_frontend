"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IconArrowLeft } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { CcTabs } from "@/components/layout/cc-tabs";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <PagePane>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6"
      >
        <PageHeader
          title={t("pages.ccEditUser.title")}
          subtitle={t("pages.ccEditUser.subtitle")}
          center={<CcTabs />}
          leading={
            <Button
              asChild
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label={t("common.back")}
            >
              <Link href={detailHref}>
                <IconArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          }
          actions={
            <Badge className="bg-amber-50 text-amber-800 capitalize">
              {user.approval_status === "pending"
                ? t("cc.approvalPending")
                : user.approval_status === "approved"
                  ? t("cc.approvalApproved")
                  : user.approval_status === "rejected"
                    ? t("cc.approvalRejected")
                    : t("cc.approvalEnded")}
            </Badge>
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
