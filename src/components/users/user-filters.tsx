"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Props = {
  value: UserFilters;
  onChange: (next: UserFilters) => void;
};

export function UserFiltersBar({ value, onChange }: Props) {
  const t = useT();

  function patch(partial: Partial<UserFilters>) {
    onChange({ ...value, ...partial });
  }

  return (
    <SectionCard>
      <h2 className="mb-4 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
        {t("cc.filters")}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          <Label>{t("common.search")}</Label>
          <Input
            value={value.q ?? ""}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder={t("cc.searchPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("cc.filterStatus")}</Label>
          <Select
            value={value.status ?? "all"}
            onValueChange={(v) =>
              patch({ status: v as UserStatus | "all" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="1">{t("cc.statusActive")}</SelectItem>
              <SelectItem value="0">{t("cc.statusInactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("cc.filterApproval")}</Label>
          <Select
            value={value.approval ?? "all"}
            onValueChange={(v) =>
              patch({ approval: v as ApprovalStatus | "all" })
            }
          >
            <SelectTrigger>
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
        <div className="space-y-2">
          <Label>{t("cc.filterWing")}</Label>
          <Select
            value={value.wing ?? "all"}
            onValueChange={(v) => patch({ wing: v })}
          >
            <SelectTrigger>
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
        <div className="space-y-2">
          <Label>{t("cc.filterRank")}</Label>
          <Select
            value={value.rank ?? "all"}
            onValueChange={(v) => patch({ rank: v })}
          >
            <SelectTrigger>
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
