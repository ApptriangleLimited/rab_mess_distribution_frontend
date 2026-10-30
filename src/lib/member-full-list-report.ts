import type { MessageKey } from "@/i18n";
import { memberTypeMessageKey } from "@/lib/member-list-report";
import { formatMemberWing } from "@/lib/store/org-options";
import type { User } from "@/lib/types";

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

const EMPTY = "—";

function cell(value: string | undefined | null): string {
  const text = (value ?? "").trim();
  return text || EMPTY;
}

function emergencyCell(user: User): string {
  const parts = (user.emergency_contacts ?? [])
    .map((contact) =>
      [contact.name, contact.relation, contact.phone]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" / "),
    )
    .filter(Boolean);
  return parts.join("; ") || EMPTY;
}

function branchNameCell(user: User): string {
  const location = (user.branch_location ?? "").trim();
  const district = (user.branch ?? "").trim();
  if (location && district && location.toLowerCase() !== district.toLowerCase()) {
    return `${location}, ${district}`;
  }
  return location || district || EMPTY;
}

/**
 * Daily member list. Leading columns are fixed; everything else keeps
 * the original serial order.
 * SL, Personal no, SRB ID, Force Rank, SRB Rank, Name, Wing, Phone, then the rest.
 */
export const DAILY_MEMBER_LIST_COLUMN_ORDER = [
  0, 2, 3, 7, 5, 1, 8, 11, 4, 6, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19,
];

export function orderMemberListColumns<T>(
  cells: readonly T[],
  order: readonly number[] = DAILY_MEMBER_LIST_COLUMN_ORDER,
): T[] {
  return order.map((index) => cells[index]!);
}

export function fullMemberListHeaders(t: Translate): string[] {
  return [
    t("cc.fields.sl"),
    t("cc.fields.name"),
    t("cc.fields.personalNo"),
    t("cc.fields.rabId"),
    t("cc.fields.rfid"),
    t("cc.fields.rank"),
    t("cc.fields.force"),
    t("cc.fields.forceRank"),
    t("cc.fields.wing"),
    t("cc.fields.religion"),
    t("cc.fields.memberType"),
    t("cc.fields.phone"),
    t("cc.fields.bloodGroup"),
    t("cc.fields.defaultTag"),
    t("cc.fields.bankName"),
    t("cc.fields.accountNumber"),
    t("cc.fields.branchName"),
    t("cc.fields.accountName"),
    t("cc.fields.routing"),
    t("cc.sectionEmergency"),
  ];
}

export function fullMemberListRows(users: User[], t: Translate): string[][] {
  return users.map((user, i) => [
    String(i + 1),
    cell(user.name),
    cell(user.personal_id),
    cell(user.rab_id),
    cell(user.rfid),
    cell(user.rank),
    cell(user.force),
    cell(user.force_rank),
    cell(formatMemberWing(user.wing)),
    cell(user.religion),
    t(memberTypeMessageKey(user.member_type)),
    cell(user.phone),
    cell(user.blood_group),
    cell(user.default_tag),
    cell(user.bank_name),
    cell(user.account_number),
    branchNameCell(user),
    cell(user.account_name),
    cell(user.routing),
    emergencyCell(user),
  ]);
}
