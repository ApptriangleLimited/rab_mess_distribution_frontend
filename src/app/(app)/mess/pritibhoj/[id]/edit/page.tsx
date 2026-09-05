"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { getPritibhojEvent } from "@/lib/store/pritibhoj";
import { useT } from "@/i18n/provider";
import MessPritibhojEditorClient from "../../pritibhoj-editor-client";

export default function MessPritibhojEditPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  useStore();
  const event = getPritibhojEvent(params.id);

  if (!event) {
    return (
      <PagePane className="gap-5">
        <EmptyState
          title={t("mess.pritibhoj.missing")}
          action={
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href="/mess/pritibhoj">{t("common.back")}</Link>
            </Button>
          }
        />
      </PagePane>
    );
  }

  return <MessPritibhojEditorClient event={event} />;
}
