"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { User } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { IconCheck, IconX } from "@tabler/icons-react";

/** Pending member row for Members table — Approve / Reject in Actions. */
export function ApprovalRow({
  user,
  onApprove,
  onReject,
}: {
  user: User;
  onApprove: () => void;
  onReject: () => void;
}) {
  const t = useT();

  return (
    <tr className="border-t border-amber-100/80 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20">
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
      <td className="px-4 py-3">
        <div
          className="flex flex-wrap items-center justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="cta"
            size="sm"
            className="rounded-lg"
            onClick={onApprove}
          >
            <IconCheck className="h-3.5 w-3.5" />
            {t("daily.approve")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={onReject}
          >
            <IconX className="h-3.5 w-3.5" />
            {t("daily.reject")}
          </Button>
        </div>
      </td>
    </tr>
  );
}
