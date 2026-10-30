"use client";

import { useMemo } from "react";
import { useToast } from "@/components/shared/toast-provider";
import { usePritibhojCountCtx } from "@/hooks/use-pritibhoj-counts";
import { useStore } from "@/hooks/use-store";
import { useT } from "@/i18n/provider";
import { ApiClientError } from "@/lib/api/client";
import { isOldPublicApiHost } from "@/lib/api/compat";
import { isCcApiEnabled } from "@/lib/api/mode";
import { updatePritibhojEventApi } from "@/lib/api/pritibhoj";
import type { PritibhojInput } from "@/lib/store/pritibhoj";
import {
  updatePritibhojEvent,
  upsertLocalPritibhojEvent,
} from "@/lib/store/pritibhoj";
import { applyPritibhojLookups } from "@/lib/store/pritibhoj-counts";
import type { PritibhojCountCtx } from "@/lib/store/pritibhoj-counts";
import type { PritibhojEvent, PritibhojRoster } from "@/lib/types";

function toInput(event: PritibhojEvent): PritibhojInput {
  return {
    title: event.title,
    occasion: event.occasion,
    date: event.date,
    org: event.org,
    main_rows: event.main_rows,
    admin_rows: event.admin_rows,
    roster: event.roster ?? {},
  };
}

export function usePritibhojRosterEditor(event: PritibhojEvent | null): {
  ctx: PritibhojCountCtx | null;
  saveRoster: (roster: PritibhojRoster) => Promise<void>;
} {
  const t = useT();
  const { toast } = useToast();
  const state = useStore();
  const date = event?.date ?? "";
  const { ctx: loaded, loading } = usePritibhojCountCtx(date);

  const ctx = useMemo<PritibhojCountCtx | null>(() => {
    if (loaded && loaded.users.length > 0) return loaded;
    if (loading) return null;
    if (state.users.length === 0) return loaded;
    return {
      users: state.users,
      assignments: state.assignments,
      suppressed_carries: state.suppressed_carries ?? [],
    };
  }, [loaded, loading, state.users, state.assignments, state.suppressed_carries]);

  async function saveRoster(roster: PritibhojRoster) {
    if (!event || !ctx) return;
    const next: PritibhojEvent = {
      ...event,
      roster,
      main_rows: applyPritibhojLookups(
        event.main_rows,
        event.date,
        ctx,
        roster,
        "main",
      ),
      admin_rows: applyPritibhojLookups(
        event.admin_rows,
        event.date,
        ctx,
        roster,
        "admin",
      ),
    };
    try {
      if (
        isCcApiEnabled() &&
        !isOldPublicApiHost() &&
        !event.id.startsWith("pb_demo_")
      ) {
        const saved = await updatePritibhojEventApi(event.id, toInput(next));
        upsertLocalPritibhojEvent(saved);
      } else {
        upsertLocalPritibhojEvent(updatePritibhojEvent(event.id, toInput(next)) ?? next);
      }
      toast(t("mess.pritibhoj.membersSaved"), "success");
    } catch (err) {
      toast(
        err instanceof ApiClientError
          ? err.detail
          : t("mess.pritibhoj.membersSaveFail"),
        "error",
      );
      throw err;
    }
  }

  return { ctx, saveRoster };
}
