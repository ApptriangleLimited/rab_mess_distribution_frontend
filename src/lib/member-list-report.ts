import type { MessageKey } from "@/i18n";
import { formatDateDisplay } from "@/lib/date";
import type { UserFilters } from "@/lib/store/users";
import type { MemberType, User } from "@/lib/types";

export const MEMBER_TYPE_KEYS = {
  permanent: "cc.memberTypes.member",
  new: "cc.memberTypes.new",
  attached: "cc.memberTypes.attached",
  guest: "cc.memberTypes.guest",
  civilian: "cc.memberTypes.civilian",
} as const satisfies Record<MemberType, MessageKey>;

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

export function memberTypeMessageKey(
  type: MemberType | undefined,
): MessageKey {
  return MEMBER_TYPE_KEYS[type || "permanent"];
}

export function memberListFilterChips(
  filters: UserFilters,
  t: Translate,
  wingLabel: (wing: string) => string,
): string[] {
  const chips: string[] = [];
  if (filters.wing && filters.wing !== "all") {
    chips.push(`${t("cc.fields.wing")}: ${wingLabel(filters.wing)}`);
  }
  if (filters.member_type && filters.member_type !== "all") {
    chips.push(
      `${t("cc.fields.memberType")}: ${t(memberTypeMessageKey(filters.member_type))}`,
    );
  }
  if (filters.rank && filters.rank !== "all") {
    chips.push(`${t("cc.fields.rank")}: ${filters.rank}`);
  }
  if (filters.status && filters.status !== "all") {
    chips.push(
      `${t("cc.fields.status")}: ${
        filters.status === "1" ? t("cc.statusActive") : t("cc.statusInactive")
      }`,
    );
  }
  if (filters.approval && filters.approval !== "all") {
    const approvalKey =
      filters.approval === "pending"
        ? "cc.approvalPending"
        : filters.approval === "approved"
          ? "cc.approvalApproved"
          : filters.approval === "rejected"
            ? "cc.approvalRejected"
            : "cc.approvalEnded";
    chips.push(`${t("cc.fields.approval")}: ${t(approvalKey)}`);
  }
  if (filters.q?.trim()) {
    chips.push(`${t("common.search")}: ${filters.q.trim()}`);
  }
  const dateFrom = filters.date_from?.trim() ?? "";
  const dateTo = filters.date_to?.trim() ?? "";
  if (dateFrom || dateTo) {
    chips.push(
      `${t("cc.fields.memberDate")}: ${formatDateDisplay(dateFrom || dateTo)}${
        dateFrom && dateTo && dateFrom !== dateTo
          ? ` – ${formatDateDisplay(dateTo)}`
          : ""
      }`,
    );
  }
  return chips;
}

export function memberListTableHeaders(t: Translate): string[] {
  return [
    t("daily.registerColSl"),
    t("cc.fields.personalNo"),
    t("cc.fields.rabId"),
    t("cc.fields.rank"),
    t("cc.fields.name"),
    t("cc.fields.memberType"),
    t("cc.fields.phone"),
    t("cc.fields.bloodGroup"),
  ];
}

export function memberListTableRows(users: User[], t: Translate): string[][] {
  return users.map((user, i) => [
    String(i + 1),
    user.personal_id || "—",
    user.rab_id || "—",
    user.rank || "—",
    user.name,
    t(memberTypeMessageKey(user.member_type)),
    user.phone || "—",
    user.blood_group || "—",
  ]);
}
