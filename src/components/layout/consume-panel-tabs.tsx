"use client";

import { ConsumeTabs } from "@/components/layout/consume-tabs";
import { RationTabs } from "@/components/layout/ration-tabs";
import { useSession } from "@/hooks/use-session";
import { isRationFamily } from "@/lib/constants";

/** Consume sub-nav — ration/admin keep full family tab strip. */
export function ConsumePanelTabs({ className }: { className?: string }) {
  const { session } = useSession();
  if (isRationFamily(session?.role)) {
    return <RationTabs className={className} />;
  }
  return <ConsumeTabs className={className} />;
}
