"use client";

import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { useT } from "@/i18n/provider";
import type { MessageKey } from "@/i18n";

export function PhaseStub({
  titleKey,
  subtitleKey,
  phaseKey,
}: {
  titleKey: MessageKey;
  subtitleKey: MessageKey;
  phaseKey: MessageKey;
}) {
  const state = useStore();
  const t = useT();

  return (
    <PagePane>
      <PageHeader
        title={t(titleKey)}
        subtitle={t(subtitleKey)}
        actions={
          <Badge className="bg-primary/10 text-primary">{t(phaseKey)}</Badge>
        }
      />
      <SectionCard>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {t("stub.shellReady")}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("stub.users")} value={state.users.length} />
          <Stat label={t("stub.assignments")} value={state.assignments.length} />
          <Stat label={t("stub.senders")} value={state.senders.length} />
          <Stat label={t("stub.rates")} value={state.rates.length} />
        </dl>
      </SectionCard>
    </PagePane>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-white">
        {value}
      </dd>
    </div>
  );
}
