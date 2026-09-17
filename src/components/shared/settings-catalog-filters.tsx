"use client";

import { useMemo } from "react";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useStore } from "@/hooks/use-store";
import { useT } from "@/i18n/provider";
import {
  rankLabelBn,
  rankOfficialName,
  wingDisplayLabel,
} from "@/lib/constants";
import { listOfficialWings, listRanks } from "@/lib/store/org-options";
import { cn } from "@/lib/utils";

const ALL = "all";

type CatalogFilterProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
};

function settingsRankLabel(
  rank: string,
  labels?: Record<string, string>,
  labelsBn?: Record<string, string>,
) {
  const official = rankOfficialName(rank, labels);
  const bn = rankLabelBn(rank, labelsBn);
  const showOfficial =
    Boolean(official) && official.toLowerCase() !== rank.toLowerCase();
  const showBn =
    Boolean(bn) &&
    bn.toLowerCase() !== rank.toLowerCase() &&
    bn.toLowerCase() !== official.toLowerCase();
  if (showOfficial && showBn) return `${rank} — ${official} (${bn})`;
  if (showOfficial) return `${rank} — ${official}`;
  if (showBn) return `${rank} (${bn})`;
  return rank;
}

/** Searchable rank filter — options from Settings SRB ranks (serial order). */
export function SettingsRankFilter({
  value,
  onChange,
  className,
  triggerClassName,
}: CatalogFilterProps) {
  const t = useT();
  const state = useStore();
  const ranks = useMemo(
    () => listRanks(),
    [state.ranks, state.rank_serials, state.rank_labels],
  );

  return (
    <div className={cn("min-w-0", className)}>
      <SearchableSelect
        options={ranks}
        value={value === ALL ? "" : value}
        onChange={(next) => onChange(next || ALL)}
        placeholder={t("common.allRank")}
        clearLabel={t("common.allRank")}
        getOptionLabel={(rank) =>
          settingsRankLabel(rank, state.rank_labels, state.rank_labels_bn)
        }
        triggerClassName={triggerClassName}
        contentClassName="w-auto min-w-[16rem]"
        ariaLabel={t("cc.fields.rank")}
      />
    </div>
  );
}

/** Searchable wing filter — options from Settings official wings (serial order). */
export function SettingsWingFilter({
  value,
  onChange,
  className,
  triggerClassName,
}: CatalogFilterProps) {
  const t = useT();
  const state = useStore();
  const wings = useMemo(
    () => listOfficialWings(),
    [state.wings, state.wing_parent, state.wing_serials, state.wing_labels],
  );

  return (
    <div className={cn("min-w-0", className)}>
      <SearchableSelect
        options={wings}
        value={value === ALL ? "" : value}
        onChange={(next) => onChange(next || ALL)}
        placeholder={t("common.allWing")}
        clearLabel={t("common.allWing")}
        getOptionLabel={(wing) => wingDisplayLabel(wing, state.wing_labels)}
        triggerClassName={triggerClassName}
        contentClassName="w-auto min-w-[18rem]"
        ariaLabel={t("cc.fields.wing")}
      />
    </div>
  );
}
