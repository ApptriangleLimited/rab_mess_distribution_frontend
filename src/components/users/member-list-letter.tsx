"use client";

import { forwardRef } from "react";
import { CONSUME_REPORT_META, wingOfficialName } from "@/lib/constants";
import { formatDateDisplay, todayISO } from "@/lib/date";
import {
  memberListFilterChips,
  memberTypeMessageKey,
} from "@/lib/member-list-report";
import { formatMemberWing } from "@/lib/store/org-options";
import type { UserFilters } from "@/lib/store/users";
import type { User } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  users: User[];
  filters: UserFilters;
  wingLabels?: Record<string, string>;
  title?: string;
};

export const MemberListLetter = forwardRef<HTMLDivElement, Props>(
  function MemberListLetter({ users, filters, wingLabels = {}, title }, ref) {
    const t = useT();
    const { locale } = useI18n();
    const useBn = locale === "bn";
    const printedOn = formatDateDisplay(todayISO());
    const wingLabel = (wing: string) =>
      wing ? wingOfficialName(wing, wingLabels) : "—";

    const chips = memberListFilterChips(filters, t, wingLabel);

    return (
      <div
        ref={ref}
        className="member-list-letter mx-auto w-full max-w-[210mm] bg-white p-5 text-neutral-900 shadow-sm print:max-w-none print:p-0 print:shadow-none"
      >
        <header className="mb-8 border-b border-neutral-800 pb-3 text-center">
          <h1 className="text-base font-bold tracking-wide">
            {title ?? t("cc.memberListReportTitle")}
          </h1>
          <p className="mt-0.5 text-[9px] font-normal text-neutral-400">
            {useBn ? CONSUME_REPORT_META.orgNameBn : CONSUME_REPORT_META.orgName}
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
                {t("cc.fields.sl")}
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
                {t("cc.fields.wing")}
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
                  {formatMemberWing(user.wing) || "—"}
                </td>
                <td className="border border-neutral-800 px-1.5 py-1">
                  {t(memberTypeMessageKey(user.member_type))}
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
