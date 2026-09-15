"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IconArrowLeft, IconUser } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { CcTabs } from "@/components/layout/cc-tabs";
import { Button } from "@/components/ui/button";
import { UserForm, type UserFormValues } from "@/components/users/user-form";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { createMember } from "@/lib/api/members";
import { notifyCcDataChange } from "@/lib/api/cc-events";
import { isCcApiEnabled } from "@/lib/api/mode";
import { createUser, findUserByRabId } from "@/lib/store/users";
import { useT } from "@/i18n/provider";

export default function CcNewUserPage() {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const apiOn = isCcApiEnabled();
  const [busy, setBusy] = useState(false);

  async function onSubmit(values: UserFormValues) {
    if (busy) return;
    if (!values.name.trim()) {
      toast(t("cc.nameRequired"), "error");
      return;
    }

    if (!apiOn) {
      if (findUserByRabId(values.rab_id)) {
        toast(t("cc.rabIdDuplicate"), "error");
        return;
      }
      createUser(values);
      toast(t("cc.created"), "success");
      router.push("/cc/users");
      return;
    }

    setBusy(true);
    try {
      await createMember(values, {
        status: values.status || "1",
        approval_status: "pending",
      });
      notifyCcDataChange();
      toast(t("cc.created"), "success");
      router.push("/cc/users");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "CONFLICT_RAB_ID") {
        toast(t("cc.rabIdDuplicate"), "error");
      } else if (err instanceof ApiClientError && err.errors[0]?.message) {
        toast(err.errors[0].message, "error");
      } else if (err instanceof ApiClientError) {
        toast(err.detail, "error");
      } else {
        toast(t("cc.createFail"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PagePane className="!min-h-0 gap-3 p-3 md:p-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2.5"
      >
        <PageHeader
          title={t("pages.ccNewUser.title")}
          subtitle={t("pages.ccNewUser.subtitle")}
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
                <Link href="/cc/users">
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
          mode="create"
          busy={busy}
          onSubmit={onSubmit}
          onCancel={() => router.push("/cc/users")}
        />
      </motion.div>
    </PagePane>
  );
}
