"use client";

import { MessTabs } from "@/components/layout/mess-tabs";
import { TagRequestBoard } from "@/components/tag-requests/tag-request-board";
import { useT } from "@/i18n/provider";

export default function MessRequestsPage() {
  const t = useT();
  return (
    <TagRequestBoard
      mode="mess"
      title={t("pages.messRequests.title")}
      subtitle={(count) => t("pages.messRequests.subtitle", { count })}
      tabs={<MessTabs />}
    />
  );
}
