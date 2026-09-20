"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { AdminTabs } from "@/components/layout/ration-tabs";
import { StaffAccountsSection } from "@/components/settings/staff-accounts-section";
import { useSession } from "@/hooks/use-session";
import { homeForRole } from "@/lib/session";
import { useT } from "@/i18n/provider";

export default function AdminUsersClient() {
  const t = useT();
  const router = useRouter();
  const { session, ready } = useSession();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!ready || !session) return;
    if (session.role !== "admin") {
      router.replace(homeForRole(session.role));
    }
  }, [ready, router, session]);

  if (ready && session && session.role !== "admin") return null;

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <PageHeader
          title={t("pages.adminUsers.title")}
          subtitle={t("pages.adminUsers.subtitle")}
          center={<AdminTabs />}
        />
        <StaffAccountsSection layout="page" />
      </motion.div>
    </PagePane>
  );
}
