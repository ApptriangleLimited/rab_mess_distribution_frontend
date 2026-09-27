"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { User, UserStatus } from "@/lib/types";
import { formatDateDisplay } from "@/lib/date";
import { formatMemberWing } from "@/lib/store/org-options";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function StatusToggle({
  user,
  onToggle,
  disabled = false,
}: {
  user: User;
  onToggle: (next: UserStatus) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const active = user.status === "1";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={() => onToggle(active ? "0" : "1")}
      className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-neutral-200 bg-white px-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-900"
    >
      <span
        className={cn(
          "text-[11px] font-semibold",
          active ? "text-neutral-400" : "text-neutral-700 dark:text-neutral-200",
        )}
      >
        {t("cc.statusInactive")}
      </span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          active ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]",
            active ? "left-4" : "left-0.5",
          )}
        />
      </span>
      <span
        className={cn(
          "text-[11px] font-semibold",
          active ? "text-primary" : "text-neutral-400",
        )}
      >
        {t("cc.statusActive")}
      </span>
    </button>
  );
}

export function RosterRow({
  user,
  onOpen,
  actions,
  showDates = false,
  sl,
}: {
  user: User;
  onOpen?: () => void;
  actions?: ReactNode;
  /** Joining / out date columns (Daily members table). */
  showDates?: boolean;
  sl?: number;
}) {
  const t = useT();
  const active = user.status === "1";
  const clickable = typeof onOpen === "function";

  return (
    <tr
      role={clickable ? "link" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      className={cn(
        "border-t border-neutral-100 transition dark:border-neutral-800",
        clickable &&
          "cursor-pointer hover:bg-primary/[0.04] dark:hover:bg-primary/[0.08]",
        !active && "opacity-70",
      )}
    >
      {sl != null ? (
        <td className="px-3 py-3 text-center text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-400">
          {sl}
        </td>
      ) : null}
      <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">
        {user.personal_id || "—"}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">
        {user.rab_id}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
        {user.rank || "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={user.name} muted={!active} />
          <div className="min-w-0 truncate text-sm font-semibold text-neutral-900 dark:text-white">
            {user.name}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
        {formatMemberWing(user.wing) || "—"}
      </td>
      {showDates ? (
        <>
          <td className="px-4 py-3 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
            {formatDateDisplay(user.joining_date) || "—"}
          </td>
          <td className="px-4 py-3 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
            {formatDateDisplay(user.out_date) || "—"}
          </td>
        </>
      ) : null}
      <td className="px-4 py-3">
        <Badge
          className={cn(
            "rounded-md px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide",
            active
              ? "bg-primary/10 text-primary"
              : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
          )}
        >
          {active ? t("cc.statusActive") : t("cc.statusInactive")}
        </Badge>
      </td>
      {actions !== undefined ? (
        <td
          className="px-4 py-3 text-right"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {actions}
        </td>
      ) : null}
    </tr>
  );
}
