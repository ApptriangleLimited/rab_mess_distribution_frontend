"use client";

import { useMemo, useState } from "react";
import {
  IconChevronDown,
  IconClipboardList,
} from "@tabler/icons-react";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { Input } from "@/components/ui/input";
import { useStore } from "@/hooks/use-store";
import {
  authorizedWingDisplayCount,
  listAuthorizedRootWings,
  setAuthorizedHeldWingCount,
  setAuthorizedWingCount,
} from "@/lib/store/org-options";
import { isOfficerCategory } from "@/lib/manpower-report";
import { wingSettingsLabel } from "@/lib/rank-labels";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/** Authorized strength — wing প্রাধিকৃত; Officer also per-wing প্রাপ্ত. */
export function AuthorizedSection({
  static: staticPanel = false,
}: {
  static?: boolean;
} = {}) {
  const t = useT();
  const state = useStore();
  const [sectionOpen, setSectionOpen] = useState(staticPanel);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Empty string while typing. Key = `${kind}::${authId}::${wing}`. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const rows = state.authorized ?? [];
  const rootWings = useMemo(
    () => listAuthorizedRootWings(),
    [state.wings, state.wing_parent],
  );
  const total = useMemo(
    () =>
      rows.reduce((sum, row) => {
        let rowSum = 0;
        for (const w of rootWings) {
          rowSum += authorizedWingDisplayCount(row.wings, w);
        }
        return sum + rowSum;
      }, 0),
    [rows, rootWings],
  );

  function draftKey(kind: "auth" | "held", authId: string, wing: string) {
    return `${kind}::${authId}::${wing}`;
  }

  function inputValue(
    kind: "auth" | "held",
    authId: string,
    wing: string,
  ): string {
    const key = draftKey(kind, authId, wing);
    if (Object.prototype.hasOwnProperty.call(drafts, key)) {
      return drafts[key]!;
    }
    const row = rows.find((r) => r.id === authId);
    const map = kind === "auth" ? row?.wings : row?.held_wings;
    return String(authorizedWingDisplayCount(map, wing));
  }

  function onCount(
    kind: "auth" | "held",
    authId: string,
    wing: string,
    raw: string,
  ) {
    const digits = raw.replace(/[^\d]/g, "");
    const key = draftKey(kind, authId, wing);
    const save =
      kind === "auth" ? setAuthorizedWingCount : setAuthorizedHeldWingCount;
    if (digits === "") {
      setDrafts((prev) => ({ ...prev, [key]: "" }));
      save(authId, wing, 0);
      return;
    }
    const n = Number(digits);
    if (!Number.isFinite(n) || n < 0) return;
    setDrafts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    save(authId, wing, Math.floor(n));
  }

  function onBlur(kind: "auth" | "held", authId: string, wing: string) {
    const key = draftKey(kind, authId, wing);
    setDrafts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  return (
    <CollapsibleSection
      id="authorized"
      className="scroll-mt-6"
      icon={IconClipboardList}
      title={t("settings.authorizedTitle")}
      hint={t("settings.authorizedHint")}
      open={staticPanel ? true : sectionOpen}
      onOpenChange={staticPanel ? undefined : setSectionOpen}
      static={staticPanel}
      badge={
        <span className="rounded-md bg-neutral-900/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-neutral-500 dark:bg-white/10">
          {rows.length} · {total.toLocaleString()}
        </span>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
              <IconClipboardList className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              {t("settings.authorizedEmpty")}
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.map((row) => {
                const open = expandedId === row.id;
                const officer = isOfficerCategory(row);
                const wingSum = rootWings.reduce(
                  (s, w) => s + authorizedWingDisplayCount(row.wings, w),
                  0,
                );
                const heldSum = officer
                  ? rootWings.reduce(
                      (s, w) =>
                        s + authorizedWingDisplayCount(row.held_wings, w),
                      0,
                    )
                  : 0;
                return (
                  <li key={row.id} className="group">
                    <div className="flex items-start gap-2 px-3 py-2.5 transition hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06]">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="inline-flex max-w-full items-center gap-x-3 text-left"
                          onClick={() => setExpandedId(open ? null : row.id)}
                          aria-expanded={open}
                        >
                          <IconChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-neutral-400 transition",
                              open ? "rotate-0" : "-rotate-90",
                            )}
                          />
                          <span className="w-[5.5rem] shrink-0 truncate text-sm font-semibold text-neutral-900 dark:text-white sm:w-28">
                            {row.label}
                          </span>
                          <span className="font-mono text-sm font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">
                            {wingSum.toLocaleString()}
                          </span>
                          {officer ? (
                            <span className="font-mono text-xs tabular-nums text-neutral-500">
                              · {t("settings.authorizedHeld")}{" "}
                              {heldSum.toLocaleString()}
                            </span>
                          ) : null}
                        </button>
                        {open ? (
                          <div className="mt-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                            <p className="mb-2 text-[11px] text-neutral-500">
                              {officer
                                ? t("settings.authorizedOfficerNote")
                                : t("settings.authorizedWingHint")}
                            </p>
                            {rootWings.length === 0 ? (
                              <p className="py-2 text-xs text-neutral-500">
                                {t("settings.authorizedWingEmpty")}
                              </p>
                            ) : (
                              <ul className="space-y-1.5 pl-7">
                                {officer ? (
                                  <li className="grid max-w-lg grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center gap-x-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                                    <span />
                                    <span className="text-center">
                                      {t("settings.authorizedPradhikrito")}
                                    </span>
                                    <span className="text-center">
                                      {t("settings.authorizedHeld")}
                                    </span>
                                  </li>
                                ) : null}
                                {rootWings.map((wing) => (
                                  <li
                                    key={wing}
                                    className={cn(
                                      "grid max-w-lg items-center gap-x-2",
                                      officer
                                        ? "grid-cols-[minmax(0,1fr)_3.5rem_3.5rem]"
                                        : "grid-cols-[minmax(0,1fr)_4rem]",
                                    )}
                                  >
                                    <span
                                      className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-200"
                                      title={wingSettingsLabel(wing)}
                                    >
                                      {wingSettingsLabel(wing)}
                                    </span>
                                    <Input
                                      value={inputValue("auth", row.id, wing)}
                                      onChange={(e) =>
                                        onCount(
                                          "auth",
                                          row.id,
                                          wing,
                                          e.target.value,
                                        )
                                      }
                                      onBlur={() =>
                                        onBlur("auth", row.id, wing)
                                      }
                                      inputMode="numeric"
                                      aria-label={`${t("settings.authorizedPradhikrito")} — ${wing}`}
                                      className="h-8 w-full rounded-md font-mono text-xs tabular-nums"
                                    />
                                    {officer ? (
                                      <Input
                                        value={inputValue(
                                          "held",
                                          row.id,
                                          wing,
                                        )}
                                        onChange={(e) =>
                                          onCount(
                                            "held",
                                            row.id,
                                            wing,
                                            e.target.value,
                                          )
                                        }
                                        onBlur={() =>
                                          onBlur("held", row.id, wing)
                                        }
                                        inputMode="numeric"
                                        aria-label={`${t("settings.authorizedHeld")} — ${wing}`}
                                        className="h-8 w-full rounded-md font-mono text-xs tabular-nums"
                                      />
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div
                              className={cn(
                                "mt-2 grid max-w-lg items-center gap-x-2 border-t border-dashed border-neutral-200 pt-2 pl-7 text-xs dark:border-neutral-700",
                                officer
                                  ? "grid-cols-[minmax(0,1fr)_3.5rem_3.5rem]"
                                  : "grid-cols-[minmax(0,1fr)_4rem]",
                              )}
                            >
                              <span className="font-medium text-neutral-600 dark:text-neutral-300">
                                {t("settings.authorizedWingSum")}
                              </span>
                              <span className="text-center font-mono font-semibold tabular-nums text-neutral-900 dark:text-white">
                                {wingSum.toLocaleString()}
                              </span>
                              {officer ? (
                                <span className="text-center font-mono font-semibold tabular-nums text-neutral-900 dark:text-white">
                                  {heldSum.toLocaleString()}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-neutral-200 bg-neutral-50/80 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900/50">
              <div className="flex items-center gap-x-3 pl-7">
                <span className="w-[5.5rem] shrink-0 text-sm font-semibold text-neutral-900 dark:text-white sm:w-28">
                  {t("settings.authorizedTotal")}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-neutral-900 dark:text-white">
                  {total.toLocaleString()}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
