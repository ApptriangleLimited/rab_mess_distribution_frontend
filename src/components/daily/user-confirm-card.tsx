"use client";

import {
  IconBuilding,
  IconId,
  IconPhone,
  IconShield,
} from "@tabler/icons-react";
import type { User } from "@/lib/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useT } from "@/i18n/provider";

export function UserConfirmCard({ user }: { user: User }) {
  const t = useT();

  const rows = [
    { icon: IconId, label: t("cc.fields.rabId"), value: user.rab_id },
    { icon: IconShield, label: t("cc.fields.rank"), value: user.rank || "—" },
    { icon: IconBuilding, label: t("cc.fields.wing"), value: user.wing || "—" },
    {
      icon: IconPhone,
      label: t("cc.fields.phone"),
      value: user.phone || "—",
    },
    {
      icon: IconId,
      label: t("cc.fields.bloodGroup"),
      value: user.blood_group || "—",
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-gradient-to-br from-neutral-50 to-white dark:border-neutral-700 dark:from-neutral-900 dark:to-neutral-950">
      <div className="flex items-center gap-3 border-b border-neutral-200/80 bg-white/70 px-4 py-3.5 dark:border-neutral-700 dark:bg-neutral-900/60">
        <UserAvatar name={user.name} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-neutral-900 dark:text-white">
            {user.name}
          </p>
          <p className="mt-0.5 font-mono text-xs text-neutral-500">{user.rab_id}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-neutral-200/70 dark:bg-neutral-700/70">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.label}
              className="flex items-start gap-2 bg-white px-3.5 py-2.5 dark:bg-neutral-950"
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                  {row.label}
                </dt>
                <dd className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
                  {row.value}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
      {user.rfid || user.dropdown_no ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-200/80 px-3.5 py-2.5 text-[11px] text-neutral-500 dark:border-neutral-700">
          {user.rfid ? (
            <span>
              {t("cc.fields.rfid")}:{" "}
              <span className="font-mono text-neutral-700 dark:text-neutral-300">
                {user.rfid}
              </span>
            </span>
          ) : null}
          {user.dropdown_no ? (
            <span>
              {t("cc.fields.dropdownNo")}:{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {user.dropdown_no}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
