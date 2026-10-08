"use client";

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
import type { ApprovalStatus, MemberType, UserStatus } from "@/lib/types";
import type { UserFilters } from "@/lib/store/users";
import { MEMBER_TYPES } from "@/lib/constants";
import {
  SettingsRankFilter,
  SettingsWingFilter,
} from "@/components/shared/settings-catalog-filters";
import { useStore } from "@/hooks/use-store";
import {
  isAdminRootName,
  listWingChildrenFrom,
  memberWingCascade,
} from "@/lib/store/org-options";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  value: UserFilters;
  onChange: (next: UserFilters) => void;
};

const fieldClass = cn(
  searchFilterFieldClass,
  "min-w-0 w-full [&>span]:min-w-0 [&>span]:truncate",
);

/** Travel-style range picker for member joining / out dates. */
export function MemberDateFilter({
  from,
  to,
  onFrom,
  onTo,
  className,
  triggerClassName,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  className?: string;
  triggerClassName?: string;
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
      triggerClassName={triggerClassName}
    />
  );
}

export function UserFiltersBar({
  value,
  onChange,
}: Props) {
  const t = useT();
  const state = useStore();
  const selectedWing = value.wing && value.wing !== "all" ? value.wing : "";
  const cascade = memberWingCascade(selectedWing);
  const mainWing = selectedWing ? cascade.main || selectedWing : "all";
  const adminOpen = isAdminRootName(mainWing);
  const subWing = adminOpen ? cascade.sub : "";
  const branchParent =
    subWing &&
    listWingChildrenFrom(state.wings, state.wing_parent, subWing).length > 0
      ? subWing
      : "";
  const branch = branchParent ? cascade.leaf : "";

  function patch(partial: Partial<UserFilters>) {
    onChange({ ...value, ...partial });
  }

  const filtersActive =
    (value.status != null && value.status !== "all") ||
    (value.approval != null && value.approval !== "all") ||
    (value.member_type != null && value.member_type !== "all") ||
    (value.wing != null && value.wing !== "all") ||
    (value.rank != null && value.rank !== "all") ||
    Boolean(value.date_from?.trim()) ||
    Boolean(value.date_to?.trim());

  return (
    <SearchFilterBar
      search={value.q ?? ""}
      onSearchChange={(q) => patch({ q })}
      searchPlaceholder={t("cc.searchPlaceholder")}
      searchClassName="min-w-[9rem] max-w-[13rem] shrink"
      filtersActive={filtersActive}
      singleLine
      className="border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <Select
            value={value.status ?? "all"}
            onValueChange={(v) => patch({ status: v as UserStatus | "all" })}
          >
            <SelectTrigger className={fieldClass} aria-label={t("cc.fields.status")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.allStatus")}</SelectItem>
              <SelectItem value="1">{t("cc.statusActive")}</SelectItem>
              <SelectItem value="0">{t("cc.statusInactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 flex-1">
          <Select
            value={value.approval ?? "all"}
            onValueChange={(v) =>
              patch({ approval: v as ApprovalStatus | "all" })
            }
          >
            <SelectTrigger className={fieldClass} aria-label={t("cc.fields.approval")}>
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
        <div className="min-w-0 flex-1">
          <Select
            value={value.member_type ?? "all"}
            onValueChange={(v) =>
              patch({ member_type: v as MemberType | "all" })
            }
          >
            <SelectTrigger
              className={fieldClass}
              aria-label={t("cc.fields.memberType")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.allMemberType")}</SelectItem>
              {MEMBER_TYPES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {t(item.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SettingsWingFilter
          value={mainWing}
          onChange={(v) => patch({ wing: v })}
          rootsOnly
          namesOnly
          className="min-w-0 flex-1"
          triggerClassName={fieldClass}
        />
        {adminOpen ? (
          <SettingsWingFilter
            value={subWing || "all"}
            onChange={(v) => patch({ wing: v === "all" ? "Admin" : v })}
            parent="Admin"
            namesOnly
            placeholder={t("common.allSubWing")}
            clearLabel={t("common.allSubWing")}
            className="min-w-0 flex-1"
            triggerClassName={fieldClass}
          />
        ) : null}
        {branchParent ? (
          <SettingsWingFilter
            value={branch || "all"}
            onChange={(v) => patch({ wing: v === "all" ? branchParent : v })}
            parent={branchParent}
            namesOnly
            placeholder={t("common.allBranch")}
            clearLabel={t("common.allBranch")}
            className="min-w-0 flex-1"
            triggerClassName={fieldClass}
          />
        ) : null}
        <SettingsRankFilter
          value={value.rank ?? "all"}
          onChange={(v) => patch({ rank: v })}
          className="min-w-0 flex-1"
          triggerClassName={fieldClass}
        />
        <MemberDateFilter
          from={value.date_from ?? ""}
          to={value.date_to ?? ""}
          onFrom={(v) => patch({ date_from: v })}
          onTo={(v) => patch({ date_to: v })}
          className="min-w-0 flex-1"
          triggerClassName={fieldClass}
        />
      </div>
    </SearchFilterBar>
  );
}
