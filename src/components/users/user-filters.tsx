"use client";

import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RANKS, WINGS } from "@/lib/constants";
import type { ApprovalStatus, UserStatus } from "@/lib/types";
import type { UserFilters } from "@/lib/store/users";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  value: UserFilters;
  onChange: (next: UserFilters) => void;
};

const EMPTY_FILTERS: UserFilters = {
  q: "",
  status: "all",
  approval: "all",
  wing: "all",
  rank: "all",
};

const fieldClass =
  "h-10 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

export function UserFiltersBar({ value, onChange }: Props) {
  const t = useT();

  function patch(partial: Partial<UserFilters>) {
    onChange({ ...value, ...partial });
  }

  const dirty =
    Boolean(value.q?.trim()) ||
    (value.status != null && value.status !== "all") ||
    (value.approval != null && value.approval !== "all") ||
    (value.wing != null && value.wing !== "all") ||
    (value.rank != null && value.rank !== "all");

  return (
    <div className="flex w-full flex-nowrap items-center gap-2.5 overflow-x-auto rounded-2xl border border-neutral-200/90 bg-neutral-50/60 p-2.5 dark:border-neutral-700 dark:bg-neutral-900/50">
      <div className="min-w-[14rem] flex-1">
        <Input
          value={value.q ?? ""}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder={t("cc.searchPlaceholder")}
          className={fieldClass}
        />
      </div>
      <div className="w-[9.5rem] shrink-0">
        <Select
          value={value.status ?? "all"}
          onValueChange={(v) => patch({ status: v as UserStatus | "all" })}
        >
          <SelectTrigger className={fieldClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allStatus")}</SelectItem>
            <SelectItem value="1">{t("cc.statusActive")}</SelectItem>
            <SelectItem value="0">{t("cc.statusInactive")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-[10.5rem] shrink-0">
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
            <SelectItem value="all">{t("common.allApproval")}</SelectItem>
            <SelectItem value="pending">{t("cc.approvalPending")}</SelectItem>
            <SelectItem value="approved">{t("cc.approvalApproved")}</SelectItem>
            <SelectItem value="rejected">{t("cc.approvalRejected")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-[9rem] shrink-0">
        <Select
          value={value.wing ?? "all"}
          onValueChange={(v) => patch({ wing: v })}
        >
          <SelectTrigger className={fieldClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allWing")}</SelectItem>
            {WINGS.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[10rem] shrink-0">
        <Select
          value={value.rank ?? "all"}
          onValueChange={(v) => patch({ rank: v })}
        >
          <SelectTrigger className={cn(fieldClass)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.allRank")}</SelectItem>
            {RANKS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ClearFiltersButton
        disabled={!dirty}
        onClick={() => onChange({ ...EMPTY_FILTERS })}
      />
    </div>
  );
}
