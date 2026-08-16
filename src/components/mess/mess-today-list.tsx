"use client";

import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { MessEater } from "@/lib/store/mess";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function MessTodayList({ eaters }: { eaters: MessEater[] }) {
  const t = useT();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 print:bg-white">
          <tr>
            <th className="px-4 py-3">{t("mess.colName")}</th>
            <th className="px-4 py-3">{t("mess.colRank")}</th>
            <th className="px-4 py-3">{t("mess.colWing")}</th>
            <th className="px-4 py-3">{t("mess.colPhone")}</th>
          </tr>
        </thead>
        <tbody>
          {eaters.map((user) => (
            <tr
              key={user.id}
              className="border-t border-neutral-100 transition hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
            >
              <td className="px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={user.name} />
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                        {user.name}
                      </p>
                      {user.mess_reason === "FR" ? (
                        <Badge className="rounded-md bg-lime-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-lime-950 dark:bg-lime-900/50 dark:text-lime-100">
                          FR
                        </Badge>
                      ) : user.mess_reason === "BK" ? (
                        <Badge className="rounded-md bg-orange-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-orange-950 dark:bg-orange-900/50 dark:text-orange-100">
                          BK
                        </Badge>
                      ) : null}
                    </div>
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
              <td
                className={cn(
                  "px-4 py-3 tabular-nums",
                  user.phone
                    ? "text-neutral-600 dark:text-neutral-400"
                    : "text-neutral-400",
                )}
              >
                {user.phone || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
