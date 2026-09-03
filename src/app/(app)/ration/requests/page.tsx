"use client";

import { RationTabs } from "@/components/layout/ration-tabs";
import { TagRequestBoard } from "@/components/tag-requests/tag-request-board";
import { useT } from "@/i18n/provider";

export default function RationRequestsPage() {
  const t = useT();
  return (
    <TagRequestBoard
      mode="ration"
      title={t("pages.rationRequests.title")}
      subtitle={(count) => t("pages.rationRequests.subtitle", { count })}
      tabs={<RationTabs />}
    />
  );
}
