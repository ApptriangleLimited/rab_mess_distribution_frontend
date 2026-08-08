"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { User } from "@/lib/types";
import { formatDateDisplay } from "@/lib/date";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/** Pending member row — click opens detail. */
export function ApprovalRow({ user }: { user: User }) {
  const t = useT();
  const router = useRouter();
  const href = `/daily/users/${user.id}`;

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className="cursor-pointer border-t border-amber-100/80 bg-amber-50/30 transition hover:bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
    >
      <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">
        {user.rab_id}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
        {user.rank || "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={user.name} />
          <div className="min-w-0 truncate text-sm font-semibold text-neutral-900 dark:text-white">
            {user.name}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
        {user.wing || "—"}
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
        {formatDateDisplay(user.joining_date) || "—"}
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
        {formatDateDisplay(user.out_date) || "—"}
      </td>
      <td className="px-4 py-3">
        <Badge
          className={cn(
            "rounded-md px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide",
            "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
          )}
        >
          {t("cc.approvalPending")}
        </Badge>
      </td>
    </tr>
  );
}
