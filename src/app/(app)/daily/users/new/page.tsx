"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IconArrowLeft } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import {
  UserForm,
  type UserFormSubmitPayload,
} from "@/components/users/user-form";
import { useToast } from "@/components/shared/toast-provider";
import { createUser, findUserByRabId } from "@/lib/store/users";
import { setTag } from "@/lib/store/assignments";
import { todayISO } from "@/lib/date";
import { useT } from "@/i18n/provider";

export default function DailyNewUserPage() {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();

  function onSubmit(values: UserFormSubmitPayload) {
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
    if (!values.today_tag) {
      toast(t("daily.tagRequired"), "error");
      return;
    }

    const { today_tag, ...input } = values;
    const user = createUser(
      { ...input, status: input.status || "1" },
      { approval_status: "approved" },
    );
    setTag(user.id, todayISO(), today_tag);
    toast(t("cc.createdApproved"), "success");
    router.push("/daily/roster");
  }

  return (
    <PagePane>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <PageHeader
          title={t("pages.dailyNewUser.title")}
          subtitle={t("pages.dailyNewUser.subtitle")}
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
        />
        <UserForm
          mode="create"
          variant="daily"
          onSubmit={onSubmit}
          onCancel={() => router.push("/daily/roster")}
        />
      </motion.div>
    </PagePane>
  );
}
