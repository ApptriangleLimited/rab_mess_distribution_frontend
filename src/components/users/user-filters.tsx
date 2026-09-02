"use client";

import type { ReactNode } from "react";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import {
  SearchFilterBar,
  searchFilterFieldClass,
} from "@/components/shared/search-filter-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApprovalStatus, UserStatus } from "@/lib/types";
import type { UserFilters } from "@/lib/store/users";
import { wingDisplayLabel } from "@/lib/constants";
import { useStore } from "@/hooks/use-store";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  value: UserFilters;
  onChange: (next: UserFilters) => void;
  /** Optional stat / quick-filter chips under (or beside) filters. */
  tiles?: ReactNode;
  wrapTiles?: boolean;
};

const EMPTY_FILTERS: UserFilters = {
  q: "",
  status: "all",
  approval: "all",
  wing: "all",
  rank: "all",
  date_from: "",
  date_to: "",
};

const fieldClass = searchFilterFieldClass;

/** Travel-style range picker for member joining / out dates. */
export function MemberDateFilter({
  from,
  to,
  onFrom,
  onTo,
  className,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  className?: string;
}) {
  const t = useT();
  return (
    <DateRangePicker
      from={from}
      to={to}
      onChange={({ from: nextFrom, to: nextTo }) => {
        onFrom(nextFrom);
        onTo(nextTo);
      }}
      label={t("cc.fields.memberDate")}
      className={className}
    />
  );
}

export function UserFiltersBar({
  value,
  onChange,
  tiles,
  wrapTiles = false,
}: Props) {
  const t = useT();
  const { ranks, wings, wing_labels } = useStore();

  function patch(partial: Partial<UserFilters>) {
    onChange({ ...value, ...partial });
  }

  const filtersActive =
    (value.status != null && value.status !== "all") ||
    (value.approval != null && value.approval !== "all") ||
    (value.wing != null && value.wing !== "all") ||
    (value.rank != null && value.rank !== "all") ||
    Boolean(value.date_from?.trim()) ||
    Boolean(value.date_to?.trim());

  const dirty = filtersActive || Boolean(value.q?.trim());

  return (
    <SearchFilterBar
      search={value.q ?? ""}
      onSearchChange={(q) => patch({ q })}
      searchPlaceholder={t("cc.searchPlaceholder")}
      filtersActive={filtersActive}
      tiles={tiles}
      wrapTiles={wrapTiles}
      className="border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900"
    >
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
            {wings.map((w) => (
              <SelectItem key={w} value={w}>
                {wingDisplayLabel(w, wing_labels)}
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
            {ranks.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <MemberDateFilter
        from={value.date_from ?? ""}
        to={value.date_to ?? ""}
        onFrom={(v) => patch({ date_from: v })}
        onTo={(v) => patch({ date_to: v })}
      />
      <ClearFiltersButton
        disabled={!dirty}
        onClick={() => onChange({ ...EMPTY_FILTERS })}
      />
    </SearchFilterBar>
  );
}
