"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/hooks/use-store";
import { listAllTags } from "@/lib/store/rates";
import type { DailyTag } from "@/lib/types";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";

export function TagSelector({
  value,
  onChange,
  allowEmpty = false,
  className,
}: {
  value: DailyTag | "" | null;
  onChange: (tag: DailyTag | "") => void;
  allowEmpty?: boolean;
  className?: string;
}) {
  const t = useT();
  const { locale } = useI18n();
  const state = useStore();
  const tags = listAllTags();
  const current = value ?? "";
  void state.rates;

  return (
    <Select
      value={current || (allowEmpty ? "__none__" : undefined)}
      onValueChange={(v) => onChange(v === "__none__" ? "" : (v as DailyTag))}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={t("daily.noTag")} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? (
          <SelectItem value="__none__">{t("daily.noTag")}</SelectItem>
        ) : null}
        {tags.map((code) => (
          <SelectItem key={code} value={code}>
            {code} — {tagLabel(code, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
