"use client";

import { Badge } from "@/components/ui/badge";
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
    <div className="overflow-x-auto rounded-xl border border-neutral-200 print:border-neutral-400 dark:border-neutral-700">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 print:bg-white">
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
                  "border-t border-neutral-100 dark:border-neutral-800",
                  served && "bg-primary/5",
                )}
              >
                <td className="px-4 py-3 text-neutral-500">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">
                  {user.name}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{user.rab_id}</td>
                <td className="px-4 py-3">{user.rank}</td>
                <td className="px-4 py-3">{user.wing}</td>
                <td className="px-4 py-3">{user.phone || "—"}</td>
                <td className="px-4 py-3 no-print">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        served
                          ? "bg-primary/10 text-primary"
                          : "bg-neutral-100 text-neutral-600"
                      }
                    >
                      {served ? t("mess.served") : "—"}
                    </Badge>
                    <Button
                      size="sm"
                      variant={served ? "outline" : "cta"}
                      onClick={() => onToggleServed(user.id)}
                    >
                      {served ? t("mess.unmarkServed") : t("mess.markServed")}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
