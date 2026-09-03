"use client";

import { ConsumePanelTabs } from "@/components/layout/consume-panel-tabs";
import { TagRequestBoard } from "@/components/tag-requests/tag-request-board";
import { useT } from "@/i18n/provider";

export default function ConsumeRequestsPage() {
  const t = useT();
  return (
    <TagRequestBoard
      mode="consume"
      title={t("pages.consumeRequests.title")}
      subtitle={(count) => t("pages.consumeRequests.subtitle", { count })}
      tabs={<ConsumePanelTabs />}
    />
  );
}
