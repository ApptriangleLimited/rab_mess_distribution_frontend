"use client";

import { AdminTabs } from "@/components/layout/ration-tabs";
import { TagRequestBoard } from "@/components/tag-requests/tag-request-board";
import { useT } from "@/i18n/provider";

export default function AdminRequestsPage() {
  const t = useT();
  return (
    <TagRequestBoard
      mode="admin"
      title={t("pages.adminRequests.title")}
      subtitle={(count) => t("pages.adminRequests.subtitle", { count })}
      tabs={<AdminTabs />}
    />
  );
}
