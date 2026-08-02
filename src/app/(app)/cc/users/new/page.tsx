"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IconArrowLeft } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import { UserForm, type UserFormValues } from "@/components/users/user-form";
import { useToast } from "@/components/shared/toast-provider";
import { createUser, findUserByRabId } from "@/lib/store/users";
import { useT } from "@/i18n/provider";

export default function CcNewUserPage() {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();

  function onSubmit(values: UserFormValues) {
    if (!values.name.trim()) {
      toast(t("cc.nameRequired"), "error");
      return;
    }
    if (!values.rab_id.trim()) {
      toast(t("cc.rabIdRequired"), "error");
      return;
    }
    if (findUserByRabId(values.rab_id)) {
      toast(t("cc.rabIdDuplicate"), "error");
      return;
    }
    createUser(values);
    toast(t("cc.created"), "success");
    router.push("/cc/users");
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
