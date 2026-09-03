"use client";

import { DailyTabs } from "@/components/layout/daily-tabs";
import { TagRequestBoard } from "@/components/tag-requests/tag-request-board";
import { useT } from "@/i18n/provider";

export default function DailyRequestsPage() {
  const t = useT();
  return (
    <TagRequestBoard
      mode="daily"
      title={t("pages.dailyRequests.title")}
      subtitle={(count) => t("pages.dailyRequests.subtitle", { count })}
      tabs={<DailyTabs />}
    />
  );
}
