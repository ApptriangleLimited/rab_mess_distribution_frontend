"use client";

import {
  parseConsumeMemberType,
  type ConsumeMemberTypeFilter,
} from "@/lib/consume-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  value: ConsumeMemberTypeFilter;
  onChange: (value: ConsumeMemberTypeFilter) => void;
  className?: string;
  triggerClassName?: string;
};

export function ConsumeMemberTypeSelect({
  value,
  onChange,
  className,
  triggerClassName,
}: Props) {
  const t = useT();
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(parseConsumeMemberType(next))}
    >
      <SelectTrigger
        className={cn(triggerClassName, className)}
        aria-label={t("cc.fields.memberType")}
      >
        <SelectValue placeholder={t("common.allMemberType")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t("common.allMemberType")}</SelectItem>
        <SelectItem value="attached">{t("cc.memberTypes.attached")}</SelectItem>
        <SelectItem value="new">{t("cc.memberTypes.new")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
