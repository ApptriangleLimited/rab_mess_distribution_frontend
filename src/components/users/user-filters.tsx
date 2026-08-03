"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/components/shared/section-card";
import { RANKS, WINGS } from "@/lib/constants";
import type { ApprovalStatus, UserStatus } from "@/lib/types";
import type { UserFilters } from "@/lib/store/users";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  value: UserFilters;
  onChange: (next: UserFilters) => void;
};

const fieldClass =
  "h-10 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

export function UserFiltersBar({ value, onChange }: Props) {
  const t = useT();

  function patch(partial: Partial<UserFilters>) {
    onChange({ ...value, ...partial });
  }

  return (
    <SectionCard className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
          {t("cc.filters")}
        </h2>
      </div>
      <div className="flex flex-nowrap items-end gap-3 overflow-x-auto pb-0.5">
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <p className="text-[11px] font-medium text-neutral-400">
            {t("common.search")}
          </p>
          <Input
            value={value.q ?? ""}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder={t("cc.searchPlaceholder")}
            className={fieldClass}
          />
        </div>
        <div className="w-[9.5rem] shrink-0 space-y-1.5">
          <p className="text-[11px] font-medium text-neutral-400">
            {t("cc.filterStatus")}
          </p>
          <Select
            value={value.status ?? "all"}
            onValueChange={(v) =>
              patch({ status: v as UserStatus | "all" })
            }
          >
            <SelectTrigger className={fieldClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="1">{t("cc.statusActive")}</SelectItem>
              <SelectItem value="0">{t("cc.statusInactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[10.5rem] shrink-0 space-y-1.5">
          <p className="text-[11px] font-medium text-neutral-400">
            {t("cc.filterApproval")}
          </p>
          <Select
            value={value.approval ?? "all"}
            onValueChange={(v) =>
              patch({ approval: v as ApprovalStatus | "all" })
            }
          >
            <SelectTrigger className={fieldClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="pending">{t("cc.approvalPending")}</SelectItem>
              <SelectItem value="approved">{t("cc.approvalApproved")}</SelectItem>
              <SelectItem value="rejected">{t("cc.approvalRejected")}</SelectItem>
              <SelectItem value="ended">{t("cc.approvalEnded")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[9rem] shrink-0 space-y-1.5">
          <p className="text-[11px] font-medium text-neutral-400">
            {t("cc.filterWing")}
          </p>
          <Select
            value={value.wing ?? "all"}
            onValueChange={(v) => patch({ wing: v })}
          >
            <SelectTrigger className={fieldClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {WINGS.map((w) => (
                <SelectItem key={w} value={w}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[10rem] shrink-0 space-y-1.5">
          <p className="text-[11px] font-medium text-neutral-400">
            {t("cc.filterRank")}
          </p>
          <Select
            value={value.rank ?? "all"}
            onValueChange={(v) => patch({ rank: v })}
          >
            <SelectTrigger className={cn(fieldClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {RANKS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SectionCard>
  );
}
