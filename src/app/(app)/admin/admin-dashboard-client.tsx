"use client";

import { motion, useReducedMotion } from "motion/react";
import MessDashboardClient from "@/app/(app)/mess/dashboard-client";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { RationTabs } from "@/components/layout/ration-tabs";
import { monthKey } from "@/lib/date";
import { useT } from "@/i18n/provider";

export default function AdminDashboardClient() {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const month = monthKey();

  return (
    <PagePane className="gap-4">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <PageHeader
          title={t("pages.adminDashboard.title")}
          subtitle={t("pages.adminDashboard.subtitle", { month })}
          center={<RationTabs />}
        />
        <MessDashboardClient pulse />
      </motion.div>
    </PagePane>
  );
}
