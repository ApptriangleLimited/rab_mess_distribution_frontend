"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META, wingDisplayLabel } from "@/lib/constants";
import { formatDateDisplay, todayISO } from "@/lib/date";
import type { UserFilters } from "@/lib/store/users";
import type { MemberType, User } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const memberTypeKeys = {
  permanent: "cc.memberTypes.member",
  new: "cc.memberTypes.new",
  attached: "cc.memberTypes.attached",
  guest: "cc.memberTypes.guest",
  civilian: "cc.memberTypes.civilian",
} as const;

function memberTypeLabel(
  type: MemberType | undefined,
  t: ReturnType<typeof useT>,
) {
  return t(memberTypeKeys[type || "permanent"]);
}

type Props = {
  users: User[];
  filters: UserFilters;
  wingLabels?: Record<string, string>;
};

export const MemberListLetter = forwardRef<HTMLDivElement, Props>(
  function MemberListLetter({ users, filters, wingLabels = {} }, ref) {
    const t = useT();
    const { locale } = useI18n();
    const useBn = locale === "bn";
    const printedOn = formatDateDisplay(todayISO());
    const wingLabel = (wing: string) =>
      wing ? wingDisplayLabel(wing, wingLabels) : "—";

    const chips: string[] = [];
    if (filters.wing && filters.wing !== "all") {
      chips.push(`${t("cc.fields.wing")}: ${wingLabel(filters.wing)}`);
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

    return (
      <div
        ref={ref}
        className="member-list-letter mx-auto w-full max-w-[210mm] bg-white p-5 text-neutral-900 shadow-sm print:max-w-none print:p-0 print:shadow-none"
      >
        <header className="border-b border-neutral-800 pb-2 text-center">
          <p className="text-[11px] font-semibold">
            {useBn ? CONSUME_REPORT_META.orgNameBn : CONSUME_REPORT_META.orgName}
          </p>
          <h1 className="mt-0.5 text-base font-bold tracking-wide">
            {t("cc.memberListReportTitle")}
          </h1>
          <p className="text-[10px] text-neutral-600">
            {useBn ? CONSUME_REPORT_META.stationBn : CONSUME_REPORT_META.station}
          </p>
          <p className="mt-1 text-xs font-medium">
            {t("cc.memberListReportCount", { count: users.length })} ·{" "}
            {printedOn}
          </p>
          {chips.length > 0 ? (
            <p className="mt-1 text-[10px] text-neutral-600">
              {chips.join(" · ")}
            </p>
          ) : null}
        </header>

        <table className="mt-3 w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-neutral-100">
              <th className="w-8 border border-neutral-800 px-1 py-1">
                {t("daily.registerColSl")}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1 text-left">
                {t("cc.fields.personalNo")}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1 text-left">
                {t("cc.fields.rabId")}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1 text-left">
                {t("cc.fields.rank")}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1 text-left">
                {t("cc.fields.name")}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1 text-left">
                {t("cc.fields.memberType")}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1 text-left">
                {t("cc.fields.phone")}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1 text-left">
                {t("cc.fields.bloodGroup")}
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr key={user.id} className={cn(i % 2 === 1 && "bg-neutral-50")}>
                <td className="border border-neutral-800 px-1 py-1 text-center tabular-nums">
                  {i + 1}
                </td>
                <td className="border border-neutral-800 px-1.5 py-1 font-mono">
                  {user.personal_id || "—"}
                </td>
                <td className="border border-neutral-800 px-1.5 py-1 font-mono">
                  {user.rab_id || "—"}
                </td>
                <td className="border border-neutral-800 px-1.5 py-1">
                  {user.rank || "—"}
                </td>
                <td className="border border-neutral-800 px-1.5 py-1 font-medium">
                  {user.name}
                </td>
                <td className="border border-neutral-800 px-1.5 py-1">
                  {memberTypeLabel(user.member_type, t)}
                </td>
                <td className="border border-neutral-800 px-1.5 py-1 font-mono">
                  {user.phone || "—"}
                </td>
                <td className="border border-neutral-800 px-1.5 py-1 text-center">
                  {user.blood_group || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
);
