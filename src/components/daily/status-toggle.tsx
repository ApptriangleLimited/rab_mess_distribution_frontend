"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { User, UserStatus } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { IconPlayerPlay, IconPlayerPause } from "@tabler/icons-react";

export function StatusToggle({
  user,
  onToggle,
}: {
  user: User;
  onToggle: (next: UserStatus) => void;
}) {
  const t = useT();
  const active = user.status === "1";

  return (
    <Button
      size="sm"
      variant={active ? "outline" : "cta"}
      className="rounded-lg"
      onClick={() => onToggle(active ? "0" : "1")}
    >
      {active ? (
        <IconPlayerPause className="h-3.5 w-3.5" />
      ) : (
        <IconPlayerPlay className="h-3.5 w-3.5" />
      )}
      {active ? t("daily.deactivate") : t("daily.activate")}
    </Button>
  );
}

export function RosterRow({
  user,
  onOpen,
  actions,
}: {
  user: User;
  onOpen?: () => void;
  actions?: ReactNode;
}) {
  const t = useT();
  const active = user.status === "1";
  const clickable = typeof onOpen === "function";

  return (
    <tr
      role={clickable ? "button" : undefined}
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
        {user.wing || "—"}
      </td>
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
      <td
        className="px-4 py-3 text-right"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {actions ?? (
          <span className="text-xs text-neutral-400">—</span>
        )}
      </td>
    </tr>
  );
}
