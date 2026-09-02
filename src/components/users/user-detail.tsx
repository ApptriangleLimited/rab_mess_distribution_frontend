"use client";

import type { ReactNode } from "react";
import {
  IconBuilding,
  IconBuildingBank,
  IconCalendar,
  IconId,
  IconPhone,
  IconPhoneCall,
  IconShield,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/shared/section-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { ApprovalStatus, User, UserStatus } from "@/lib/types";
import { formatDateDisplay } from "@/lib/date";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

function statusLabel(status: UserStatus, t: ReturnType<typeof useT>) {
  return status === "1" ? t("cc.statusActive") : t("cc.statusInactive");
}

function approvalLabel(status: ApprovalStatus, t: ReturnType<typeof useT>) {
  const map = {
    pending: "cc.approvalPending",
    approved: "cc.approvalApproved",
    rejected: "cc.approvalRejected",
    ended: "cc.approvalEnded",
  } as const;
  return t(map[status]);
}

const approvalClass: Record<ApprovalStatus, string> = {
  pending:
    "bg-amber-500/12 text-amber-900 ring-1 ring-inset ring-amber-500/25 dark:text-amber-200",
  approved:
    "bg-emerald-500/12 text-emerald-900 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-200",
  rejected:
    "bg-red-500/12 text-red-800 ring-1 ring-inset ring-red-500/20 dark:text-red-300",
  ended:
    "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700",
};

function DetailField({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: Icon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  const empty = !value?.trim();
  return (
    <div className="flex min-w-0 gap-3 rounded-lg border border-neutral-200/80 bg-neutral-50/60 px-3 py-2.5 dark:border-neutral-700/80 dark:bg-neutral-900/40">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" stroke={2} />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          {label}
        </dt>
        <dd
          className={cn(
            "mt-0.5 truncate text-sm font-medium",
            empty
              ? "text-neutral-300 dark:text-neutral-600"
              : "text-neutral-900 dark:text-white",
            mono && !empty && "font-mono text-xs tabular-nums tracking-tight",
          )}
        >
          {empty ? "—" : value}
        </dd>
      </div>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: Icon;
  title: string;
  children: ReactNode;
}) {
  return (
    <SectionCard className="overflow-hidden p-0">
      <div className="flex items-center gap-2.5 border-b border-neutral-200/80 bg-gradient-to-br from-neutral-50/90 to-white px-5 py-3 dark:border-neutral-700 dark:from-neutral-900/80 dark:to-neutral-950">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" stroke={2} />
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </SectionCard>
  );
}

/** Read-only member profile for detail pages. */
export function UserDetail({ user }: { user: User }) {
  const t = useT();
  const meta = [user.rank, user.wing, user.phone].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <SectionCard className="overflow-hidden p-0">
        <div className="relative overflow-hidden border-b border-neutral-200/80 dark:border-neutral-700">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary"
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-4 bg-gradient-to-br from-primary/[0.06] via-neutral-50 to-white px-5 py-5 pl-6 dark:from-primary/10 dark:via-neutral-900 dark:to-neutral-950">
            <UserAvatar
              name={user.name}
              size="lg"
              muted={user.status !== "1"}
              className="h-14 w-14 text-base ring-2 ring-white shadow-sm dark:ring-neutral-800"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
                {user.name}
              </p>
              {user.personal_id ? (
                <p className="mt-0.5 font-mono text-xs tabular-nums text-neutral-500">
                  {t("cc.fields.personalId")}: {user.personal_id}
                </p>
              ) : null}
              <p className="mt-1 font-mono text-xs tabular-nums text-neutral-500">
                {user.rab_id}
                {meta ? (
                  <span className="ml-2 font-sans text-neutral-400">
                    · {meta}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  user.status === "1"
                    ? "bg-primary/12 text-primary ring-1 ring-inset ring-primary/20"
                    : "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700",
                )}
              >
                {statusLabel(user.status, t)}
              </Badge>
              <Badge
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  approvalClass[user.approval_status],
                )}
              >
                {approvalLabel(user.approval_status, t)}
              </Badge>
            </div>
          </div>
        </div>

        <dl className="grid gap-2.5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField
            icon={IconId}
            label={t("cc.fields.personalNo")}
            value={user.personal_id}
            mono
          />
          <DetailField
            icon={IconShield}
            label={t("cc.fields.rank")}
            value={user.rank}
          />
          <DetailField
            icon={IconBuilding}
            label={t("cc.fields.wing")}
            value={user.wing}
          />
          <DetailField
            icon={IconShield}
            label={t("cc.fields.force")}
            value={user.force}
          />
          <DetailField
            icon={IconId}
            label={t("cc.fields.religion")}
            value={user.religion}
          />
          <DetailField
            icon={IconPhone}
            label={t("cc.fields.phone")}
            value={user.phone}
          />
          <DetailField
            icon={IconId}
            label={t("cc.fields.rfid")}
            value={user.rfid}
            mono
          />
          <DetailField
            icon={IconId}
            label={t("cc.fields.dropdownNo")}
            value={user.dropdown_no}
          />
          <DetailField
            icon={IconCalendar}
            label={t("cc.fields.joiningDate")}
            value={formatDateDisplay(user.joining_date)}
          />
          <DetailField
            icon={IconCalendar}
            label={t("cc.fields.outDate")}
            value={formatDateDisplay(user.out_date)}
          />
        </dl>
      </SectionCard>

      <DetailSection icon={IconPhoneCall} title={t("cc.sectionEmergency")}>
        {user.emergency_contacts.length === 0 ? (
          <p className="text-sm text-neutral-500">—</p>
        ) : (
          <div className="flex flex-col gap-3">
            {user.emergency_contacts.map((contact, index) => (
              <div
                key={`${contact.phone}-${index}`}
                className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3 dark:border-neutral-700 dark:bg-neutral-900/40"
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  {t("cc.emergencyContactN", { n: String(index + 1) })}
                </p>
                <dl className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailField
                    icon={IconUsers}
                    label={t("cc.fields.emergencyName")}
                    value={contact.name}
                  />
                  <DetailField
                    icon={IconId}
                    label={t("cc.fields.emergencyRelation")}
                    value={contact.relation}
                  />
                  <DetailField
                    icon={IconPhone}
                    label={t("cc.fields.emergencyPhone")}
                    value={contact.phone}
                  />
                </dl>
              </div>
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection icon={IconBuildingBank} title={t("cc.sectionBank")}>
        <dl className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField
            icon={IconBuildingBank}
            label={t("cc.fields.bankName")}
            value={user.bank_name}
          />
          <DetailField
            icon={IconId}
            label={t("cc.fields.accountName")}
            value={user.account_name}
          />
          <DetailField
            icon={IconId}
            label={t("cc.fields.accountNumber")}
            value={user.account_number}
            mono
          />
          <DetailField
            icon={IconId}
            label={t("cc.fields.routing")}
            value={user.routing}
            mono
          />
          <DetailField
            icon={IconBuilding}
            label={t("cc.fields.branch")}
            value={user.branch}
          />
          <DetailField
            icon={IconBuilding}
            label={t("cc.fields.branchLocation")}
            value={user.branch_location}
          />
        </dl>
      </DetailSection>
    </div>
  );
}
