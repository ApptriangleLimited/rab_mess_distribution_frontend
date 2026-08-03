"use client";

import { IconCheck, IconCircle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { MessEater } from "@/lib/store/mess";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function MessTodayList({
  eaters,
  servedIds,
  onToggleServed,
}: {
  eaters: MessEater[];
  servedIds: Set<string>;
  onToggleServed: (userId: string) => void;
}) {
  const t = useT();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 print:bg-white">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">{t("mess.colName")}</th>
            <th className="px-4 py-3">{t("mess.colRabId")}</th>
            <th className="px-4 py-3">{t("mess.colRank")}</th>
            <th className="px-4 py-3">{t("mess.colWing")}</th>
            <th className="px-4 py-3">{t("mess.colPhone")}</th>
            <th className="px-4 py-3 no-print">{t("mess.colServed")}</th>
          </tr>
        </thead>
        <tbody>
          {eaters.map((user, i) => {
            const served = servedIds.has(user.id);
            return (
              <tr
                key={user.id}
                className={cn(
                  "border-t border-neutral-100 transition-colors dark:border-neutral-800",
                  served
                    ? "bg-primary/[0.04] hover:bg-primary/[0.07]"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-900/60",
                )}
              >
                <td className="px-4 py-3 tabular-nums text-neutral-400">
                  {i + 1}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900 dark:text-white">
                    {user.name}
                  </p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-300">
                  {user.rab_id}
                </td>
                <td className="px-4 py-3 text-neutral-700 dark:text-neutral-200">
                  {user.rank}
                </td>
                <td className="px-4 py-3 text-neutral-700 dark:text-neutral-200">
                  {user.wing}
                </td>
                <td className="px-4 py-3 tabular-nums text-neutral-600 dark:text-neutral-300">
                  {user.phone || "—"}
                </td>
                <td className="px-4 py-3 no-print">
                  <Button
                    size="sm"
                    variant={served ? "outline" : "cta"}
                    className={cn(
                      "h-9 rounded-xl",
                      served &&
                        "border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:text-primary",
                    )}
                    onClick={() => onToggleServed(user.id)}
                    aria-pressed={served}
                  >
                    {served ? (
                      <IconCheck className="h-3.5 w-3.5" />
                    ) : (
                      <IconCircle className="h-3.5 w-3.5" />
                    )}
                    {served ? t("mess.unmarkServed") : t("mess.markServed")}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
