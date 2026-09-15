"use client";

import type { ReactNode } from "react";
import {
  IconBuilding,
  IconBuildingBank,
  IconCalendar,
  IconEye,
  IconFile,
  IconId,
  IconPhone,
  IconPhoneCall,
  IconShield,
  IconTags,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/shared/section-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TagChip } from "@/components/tag-requests/tag-chip";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { openStoredDocument } from "@/lib/api/files";
import { MEMBER_TYPES } from "@/lib/constants";
import type { ApprovalStatus, DocumentMeta, User, UserStatus } from "@/lib/types";
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

function formatDocSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function memberTypeLabel(type: User["member_type"], t: ReturnType<typeof useT>) {
  const row = MEMBER_TYPES.find((m) => m.value === type);
  return row ? t(row.labelKey) : type;
}

function DetailField({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: Icon;
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  const text = typeof value === "string" ? value : "";
  const empty = typeof value === "string" ? !value.trim() : value == null;
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-neutral-200/80 bg-neutral-50/60 px-2 py-1.5 dark:border-neutral-700/80 dark:bg-neutral-900/40">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-3 w-3" stroke={2} />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[9px] font-semibold uppercase leading-none tracking-[0.12em] text-neutral-400">
          {label}
        </dt>
        <dd
          className={cn(
            "truncate text-[13px] font-medium leading-tight",
            empty
              ? "text-neutral-300 dark:text-neutral-600"
              : "text-neutral-900 dark:text-white",
            mono && !empty && "font-mono text-[12px] tabular-nums tracking-tight",
          )}
        >
          {empty ? "—" : typeof value === "string" ? text : value}
        </dd>
      </div>
    </div>
  );
}

function DetailBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: Icon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3 w-3" stroke={2} />
        </span>
        <h2 className="text-xs font-semibold tracking-tight text-neutral-900 dark:text-white">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/** Read-only member profile — fits one screen (no stacked cards). */
export function UserDetail({
  user,
  className,
}: {
  user: User;
  className?: string;
}) {
  const t = useT();
  const { toast } = useToast();
  const meta = [user.rank, user.wing, user.phone].filter(Boolean).join(" · ");

  async function openDocument(doc: DocumentMeta) {
    try {
      await openStoredDocument(doc);
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.detail : t("cc.documentOpenFail"),
        "error",
      );
    }
  }

  return (
    <SectionCard className={cn("overflow-hidden p-0", className)}>
      <div className="relative overflow-hidden border-b border-neutral-200/80 dark:border-neutral-700">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary"
          aria-hidden
        />
        <div className="flex flex-wrap items-center gap-3 bg-gradient-to-br from-primary/[0.06] via-neutral-50 to-white px-4 py-3 pl-5 dark:from-primary/10 dark:via-neutral-900 dark:to-neutral-950">
          <UserAvatar
            name={user.name}
            size="md"
            muted={user.status !== "1"}
            className="h-10 w-10 text-sm ring-2 ring-white shadow-sm dark:ring-neutral-800"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
              {user.name}
            </p>
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-neutral-500">
              {user.personal_id
                ? `${t("cc.fields.personalId")}: ${user.personal_id}`
                : user.rab_id}
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
                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                user.status === "1"
                  ? "bg-primary/12 text-primary ring-1 ring-inset ring-primary/20"
                  : "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700",
              )}
            >
              {statusLabel(user.status, t)}
            </Badge>
            <Badge
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                approvalClass[user.approval_status],
              )}
            >
              {approvalLabel(user.approval_status, t)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <dl className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-5">
          <DetailField
            icon={IconUsers}
            label={t("cc.fields.memberType")}
            value={memberTypeLabel(user.member_type, t)}
          />
          <DetailField
            icon={IconUsers}
            label={t("cc.fields.name")}
            value={user.name}
          />
          <DetailField
            icon={IconId}
            label={t("cc.fields.personalNo")}
            value={user.personal_id}
            mono
          />
          <DetailField
            icon={IconId}
            label={t("cc.fields.rabId")}
            value={user.rab_id}
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
            icon={IconPhone}
            label={t("cc.fields.phone")}
            value={user.phone}
          />
          <DetailField
            icon={IconId}
            label={t("cc.fields.bloodGroup")}
            value={user.blood_group}
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
            icon={IconCalendar}
            label={t("cc.fields.joiningDate")}
            value={formatDateDisplay(user.joining_date)}
          />
          <DetailField
            icon={IconCalendar}
            label={t("cc.fields.outDate")}
            value={formatDateDisplay(user.out_date)}
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
            icon={IconTags}
            label={t("daily.defaultTag")}
            value={<TagChip tag={user.default_tag} />}
          />
        </dl>

        <div className="grid gap-3 border-t border-neutral-200/80 pt-3 lg:grid-cols-2 dark:border-neutral-700">
          <DetailBlock icon={IconPhoneCall} title={t("cc.sectionEmergency")}>
            {user.emergency_contacts.length === 0 ? (
              <p className="text-xs text-neutral-500">—</p>
            ) : (
              <div className="flex flex-col gap-2">
                {user.emergency_contacts.map((contact, index) => (
                  <div key={`${contact.phone}-${index}`}>
                    {user.emergency_contacts.length > 1 ? (
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                        {t("cc.emergencyContactN", { n: String(index + 1) })}
                      </p>
                    ) : null}
                    <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
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
          </DetailBlock>

          <DetailBlock icon={IconBuildingBank} title={t("cc.sectionBank")}>
            <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
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
          </DetailBlock>
        </div>

        <DetailBlock icon={IconFile} title={t("cc.sectionDocs")}>
          {user.member_type === "civilian" && user.documents_verified ? (
            <p className="mb-1.5 text-xs font-medium text-primary">
              {t("cc.verifyDocuments")}
            </p>
          ) : null}
          {user.documents.length === 0 ? (
            <p className="text-xs text-neutral-500">{t("cc.docsEmpty")}</p>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {user.documents.map((doc, i) => (
                <li
                  key={`${doc.id ?? doc.name}-${i}`}
                  className="flex items-center gap-2 rounded-md border border-neutral-200/80 bg-neutral-50/60 px-2 py-1.5 dark:border-neutral-700/80 dark:bg-neutral-900/40"
                >
                  <IconFile className="h-4 w-4 shrink-0 text-neutral-400" stroke={1.75} />
                  <p className="min-w-0 flex-1 truncate text-sm text-neutral-800 dark:text-neutral-100">
                    {doc.name}
                    <span className="ml-1.5 text-[11px] text-neutral-400">
                      {formatDocSize(doc.size)}
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 rounded-md px-2 text-xs"
                    onClick={() => void openDocument(doc)}
                  >
                    <IconEye className="h-3.5 w-3.5" />
                    {t("cc.viewDocument")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DetailBlock>
      </div>
    </SectionCard>
  );
}
