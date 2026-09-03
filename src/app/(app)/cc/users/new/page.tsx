"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IconArrowLeft } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { CcTabs } from "@/components/layout/cc-tabs";
import { Button } from "@/components/ui/button";
import { UserForm, type UserFormValues } from "@/components/users/user-form";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { createMember } from "@/lib/api/members";
import { isApiEnabled } from "@/lib/api/mode";
import { createUser, findUserByRabId } from "@/lib/store/users";
import { useT } from "@/i18n/provider";

export default function CcNewUserPage() {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const apiOn = isApiEnabled();
  const [busy, setBusy] = useState(false);

  async function onSubmit(values: UserFormValues) {
    if (busy) return;
    if (!values.name.trim()) {
      toast(t("cc.nameRequired"), "error");
      return;
    }
    if (!values.rab_id.trim()) {
      toast(t("cc.rabIdRequired"), "error");
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
    <PagePane>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <PageHeader
          title={t("pages.ccNewUser.title")}
          subtitle={t("pages.ccNewUser.subtitle")}
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
        />
        <UserForm
          mode="create"
          onSubmit={onSubmit}
          onCancel={() => router.push("/cc/users")}
        />
      </motion.div>
    </PagePane>
  );
}
