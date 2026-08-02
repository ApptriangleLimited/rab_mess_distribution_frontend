"use client";

import { TagSelector } from "@/components/daily/tag-selector";
import { Badge } from "@/components/ui/badge";
import type { DailyAssignment, DailyTag, User } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import { tagLabel } from "@/i18n";
import { cn, initials } from "@/lib/utils";

export function TagBoard({
  users,
  assignments,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onTagChange,
}: {
  users: User[];
  assignments: DailyAssignment[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onTagChange: (userId: string, tag: DailyTag | "") => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const byUser = new Map(assignments.map((a) => [a.user_id, a]));
  const allSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id));
  const someSelected = users.some((u) => selectedIds.has(u.id)) && !allSelected;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  aria-label={t("daily.selectAll")}
                />
              </th>
              <th className="px-4 py-3">{t("cc.fields.name")}</th>
              <th className="px-4 py-3">{t("cc.fields.rank")}</th>
              <th className="px-4 py-3">{t("cc.fields.wing")}</th>
              <th className="px-4 py-3">{t("daily.tagged")}</th>
              <th className="min-w-[180px] px-4 py-3">{t("daily.tagFor")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const assignment = byUser.get(user.id);
              const selected = selectedIds.has(user.id);
              const tag = assignment?.tag;
              return (
                <tr
                  key={user.id}
                  className={cn(
                    "border-t border-neutral-100 transition dark:border-neutral-800",
                    selected
                      ? "bg-primary/[0.04] dark:bg-primary/[0.08]"
                      : "hover:bg-neutral-50/80 dark:hover:bg-neutral-900/60",
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      checked={selected}
                      onChange={() => onToggleSelect(user.id)}
                      aria-label={user.name}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark text-xs font-bold text-white">
                        {initials(user.name) || "M"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                          {user.name}
                        </p>
                        <p className="font-mono text-xs text-neutral-500">
                          {user.rab_id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {user.rank || "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {user.wing || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {tag ? (
                      <Badge className="rounded-md bg-nav-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-nav-accent">
                        {tag}
                        <span className="ml-1 font-sans font-normal opacity-80">
                          {tagLabel(tag, locale)}
                        </span>
                      </Badge>
                    ) : (
                      <span className="text-xs text-neutral-400">
                        {t("daily.untagged")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TagSelector
                      value={tag ?? ""}
                      allowEmpty
                      onChange={(next) => onTagChange(user.id, next)}
                      className="h-9 rounded-lg"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
