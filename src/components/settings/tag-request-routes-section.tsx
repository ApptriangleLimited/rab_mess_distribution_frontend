"use client";

import { useEffect, useMemo, useState } from "react";
import { IconSend } from "@tabler/icons-react";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/shared/toast-provider";
import { persistAppStateNow } from "@/lib/api/app-sync";
import { ApiClientError } from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/mode";
import { useStore } from "@/hooks/use-store";
import { setState } from "@/lib/store";
import { listAllTags } from "@/lib/store/rates";
import {
  ensureTagRequestRoutes,
  resolveTagRequestRoute,
} from "@/lib/tag-request-routes";
import { tagCellClass } from "@/lib/tag-colors";
import { useT } from "@/i18n/provider";
import type { TagRequestRoute } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROUTES: { id: TagRequestRoute; labelKey: "settings.tagRouteConsume" | "settings.tagRouteRation" | "settings.tagRouteMess" | "settings.tagRouteNone" }[] = [
  { id: "consume", labelKey: "settings.tagRouteConsume" },
  { id: "ration", labelKey: "settings.tagRouteRation" },
  { id: "mess", labelKey: "settings.tagRouteMess" },
  { id: "none", labelKey: "settings.tagRouteNone" },
];

export function TagRequestRoutesSection() {
  const t = useT();
  const { toast } = useToast();
  const state = useStore();
  const apiOn = isApiEnabled();
  const tags = listAllTags();
  const [draft, setDraft] = useState(() =>
    ensureTagRequestRoutes(state.tag_request_routes),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(ensureTagRequestRoutes(state.tag_request_routes));
  }, [state.tag_request_routes]);

  const rows = useMemo(
    () =>
      tags.map((tag) => ({
        tag,
        route: resolveTagRequestRoute(tag, draft),
      })),
    [draft, tags],
  );

  async function onSave() {
    const next = ensureTagRequestRoutes(draft);
    setState((prev) => ({ ...prev, tag_request_routes: next }));
    if (!apiOn) {
      toast(t("settings.tagRoutesSaved"), "success");
      return;
    }
    setBusy(true);
    try {
      await persistAppStateNow();
      toast(t("settings.tagRoutesSaved"), "success");
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.detail : t("settings.tagRoutesSaveFail"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <CollapsibleSection
      icon={IconSend}
      title={t("settings.tagRoutesTitle")}
      hint={t("settings.tagRoutesHint")}
      static
    >
      <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-950">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3">{t("settings.allowanceTag")}</th>
                <th className="px-4 py-3">{t("settings.tagRoutesGoesTo")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ tag, route }) => (
                <tr
                  key={tag}
                  className="border-t border-neutral-100 dark:border-neutral-800"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-flex min-w-[3.5rem] items-center justify-center rounded-md px-2 py-1 text-xs font-bold tracking-wide",
                        tagCellClass(tag),
                      )}
                    >
                      {tag}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={route}
                      onValueChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          [tag]: value as TagRequestRoute,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 w-44 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROUTES.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {t(item.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="mt-3 flex justify-end">
        <Button
          variant="cta"
          size="sm"
          className="h-9 rounded-xl"
          disabled={busy}
          onClick={() => void onSave()}
        >
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </footer>
    </CollapsibleSection>
  );
}
