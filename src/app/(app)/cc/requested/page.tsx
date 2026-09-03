"use client";

import { CcTabs } from "@/components/layout/cc-tabs";
import { TagRequestBoard } from "@/components/tag-requests/tag-request-board";
import { useT } from "@/i18n/provider";

export default function CcRequestedPage() {
  const t = useT();
  return (
    <TagRequestBoard
      mode="cc"
      title={t("pages.ccRequested.title")}
      subtitle={(count) => t("pages.ccRequested.subtitle", { count })}
      tabs={<CcTabs />}
    />
  );
}
