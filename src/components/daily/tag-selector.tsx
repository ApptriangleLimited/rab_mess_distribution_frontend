"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAILY_TAGS } from "@/lib/constants";
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
  const current = value ?? "";

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
        {DAILY_TAGS.map((tag) => (
          <SelectItem key={tag.code} value={tag.code}>
            {tag.code} — {tagLabel(tag.code, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
