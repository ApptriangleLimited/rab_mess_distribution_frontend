"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DailyTag, User, UserStatus } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { tagLabel } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { cn, initials } from "@/lib/utils";
import { IconPlayerPlay, IconPlayerPause, IconUserOff } from "@tabler/icons-react";

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
  todayTag,
  onToggle,
  onEnd,
}: {
  user: User;
  todayTag?: DailyTag | null;
  onToggle: (next: UserStatus) => void;
  onEnd: () => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const active = user.status === "1";

  return (
    <tr
      className={cn(
        "border-t border-neutral-100 transition hover:bg-primary/[0.03] dark:border-neutral-800 dark:hover:bg-primary/[0.06]",
        !active && "opacity-70",
      )}
    >
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white",
              active
                ? "bg-gradient-to-br from-primary to-primary-dark"
                : "bg-neutral-400 dark:bg-neutral-600",
            )}
          >
            {initials(user.name) || "M"}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
              {user.name}
            </div>
            <div className="font-mono text-xs text-neutral-500">{user.rab_id}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
        {user.rank || "—"}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
        {user.wing || "—"}
      </td>
      <td className="px-4 py-3">
        {todayTag ? (
          <Badge className="rounded-md bg-nav-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-nav-accent">
            {todayTag}
            <span className="ml-1 font-sans font-normal opacity-80">
              {tagLabel(todayTag, locale)}
            </span>
          </Badge>
        ) : (
          <span className="text-xs text-neutral-400">{t("daily.untagged")}</span>
        )}
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
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <StatusToggle user={user} onToggle={onToggle} />
          <Button size="sm" variant="danger" className="rounded-lg" onClick={onEnd}>
            <IconUserOff className="h-3.5 w-3.5" />
            {t("daily.endEntry")}
          </Button>
        </div>
      </td>
    </tr>
  );
}
