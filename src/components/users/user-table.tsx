"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconEdit, IconEyeFilled, IconPhone } from "@tabler/icons-react";
import { rowActionClass } from "@/components/users/row-action-btn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { UserAvatar } from "@/components/shared/user-avatar";
import { usePagination } from "@/hooks/use-pagination";
import type { ApprovalStatus, MemberType, User, UserStatus } from "@/lib/types";
import { formatDateDisplay } from "@/lib/date";
import { TagChip } from "@/components/tag-requests/tag-chip";
import { RequestTagButton } from "@/components/tag-requests/request-tag-dialog";
import { IconTip } from "@/components/shared/icon-tip";
import { MemberAcceptActions } from "@/components/users/member-accept-actions";
import { useStore } from "@/hooks/use-store";
import { getCockpitTagOnDate } from "@/lib/store/tag-requests";
import { todayISO } from "@/lib/date";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

function statusLabel(status: UserStatus, t: ReturnType<typeof useT>) {
  return status === "1" ? t("cc.statusActive") : t("cc.statusInactive");
}

const memberTypeClass: Record<MemberType, string> = {
  permanent:
    "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
  new: "border-sky-200/90 bg-sky-50 text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200",
  attached:
    "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200",
  guest:
    "border-violet-200/90 bg-violet-50 text-violet-900 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-200",
  civilian:
    "border-slate-200/90 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
};

const memberTypeKeys = {
  permanent: "cc.memberTypes.member",
  new: "cc.memberTypes.new",
  attached: "cc.memberTypes.attached",
  guest: "cc.memberTypes.guest",
  civilian: "cc.memberTypes.civilian",
} as const;

function memberTypeLabel(type: MemberType | undefined, t: ReturnType<typeof useT>) {
  const kind = type || "permanent";
  return t(memberTypeKeys[kind]);
}

function MemberTypeChip({ type }: { type?: MemberType }) {
  const t = useT();
  const kind = type || "permanent";
  return (
    <Badge
      className={cn(
        "rounded-full border text-[10px] font-semibold",
        memberTypeClass[kind],
      )}
    >
      {memberTypeLabel(kind, t)}
    </Badge>
  );
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
    "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200",
  approved:
    "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
  rejected:
    "border-rose-200/90 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200",
  ended:
    "border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export type UserTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

function MemberListActions({
  user,
  detailHref,
  editHref,
  showRequestAction,
  showAcceptActions,
}: {
  user: User;
  detailHref: string;
  editHref: string;
  showRequestAction: boolean;
  showAcceptActions: boolean;
}) {
  const t = useT();
  const canRequest = showRequestAction && user.approval_status === "approved";
  return (
    <div
      className="flex flex-nowrap items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <IconTip label={t("common.view")}>
        <Button asChild variant="ghost" size="icon" className={rowActionClass("view")}>
          <Link href={detailHref} title={t("common.view")} aria-label={t("common.view")}>
            <IconEyeFilled className="h-4 w-4" />
          </Link>
        </Button>
      </IconTip>
      <IconTip label={t("common.edit")}>
        <Button asChild variant="ghost" size="icon" className={rowActionClass("edit")}>
          <Link href={editHref} title={t("common.edit")} aria-label={t("common.edit")}>
            <IconEdit className="h-4 w-4" />
          </Link>
        </Button>
      </IconTip>
      {showAcceptActions ? (
        <MemberAcceptActions user={user} iconOnly withTag />
      ) : null}
      {canRequest ? <RequestTagButton user={user} iconOnly /> : null}
    </div>
  );
}

export function UserTable({
  users,
  pagination,
  detailHref = (id: string) => `/cc/users/${id}`,
  editHref = (id: string) => `/cc/users/${id}/edit`,
  onEmptyCreateHref,
  showRequestAction = true,
  showAcceptActions = false,
}: {
  users: User[];
  /** When set, `users` is already one page — no client slice. */
  pagination?: UserTablePagination;
  detailHref?: (id: string) => string;
  editHref?: (id: string) => string;
  onEmptyCreateHref?: string;
  /** CC list shows request-tag after Daily accepts. Daily members list hides it. */
  showRequestAction?: boolean;
  /** Daily accepts/rejects new members. CC only views status. */
  showAcceptActions?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const state = useStore();
  void state.assignments;
  void state.tag_requests;
  const today = todayISO();
  const resetKey = useMemo(
    () => users.map((u) => u.id).join("|"),
    [users],
  );
  const client = usePagination(users, resetKey);

  const page = pagination?.page ?? client.page;
  const pageSize = pagination?.pageSize ?? client.pageSize;
  const total = pagination?.total ?? client.total;
  const totalPages =
    pagination != null
      ? Math.max(1, Math.ceil(total / pageSize) || 1)
      : client.totalPages;
  const pageItems = pagination ? users : client.pageItems;
  const from =
    pagination != null
      ? total === 0
        ? 0
        : (page - 1) * pageSize + 1
      : client.from;
  const to =
    pagination != null ? Math.min(page * pageSize, total) : client.to;
  const setPage = pagination?.onPageChange ?? client.setPage;
  const setPageSize = pagination?.onPageSizeChange ?? client.setPageSize;

  if (total === 0) {
    return (
      <EmptyState
        title={t("cc.empty")}
        action={
          onEmptyCreateHref ? (
            <Button asChild variant="cta">
              <Link href={onEmptyCreateHref}>{t("cc.emptyAction")}</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  function openRow(id: string) {
    router.push(detailHref(id));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(6,121,87,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] dark:border-neutral-700 dark:bg-neutral-950 dark:shadow-none">
      {/* Mobile cards */}
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 md:hidden">
        {pageItems.map((user) => {
          const href = detailHref(user.id);
          return (
            <li key={user.id} className="px-4 py-3.5">
              <button
                type="button"
                onClick={() => openRow(user.id)}
                className="flex w-full items-start gap-3 text-left transition hover:opacity-90 focus-visible:outline-none"
              >
                <UserAvatar
                  name={user.name}
                  muted={user.status !== "1"}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-900 dark:text-neutral-50">
                        {user.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        <span className="font-mono text-neutral-600 dark:text-neutral-400">
                          {user.rab_id}
                        </span>
                        {user.rank ? ` · ${user.rank}` : ""}
                        {user.wing ? ` · ${user.wing}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <MemberTypeChip type={user.member_type} />
                    <Badge
                      className={cn(
                        "border text-[10px] font-semibold",
                        user.status === "1"
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800",
                      )}
                    >
                      {statusLabel(user.status, t)}
                    </Badge>
                    <Badge
                      className={cn(
                        "border text-[10px] font-semibold",
                        approvalClass[user.approval_status],
                      )}
                    >
                      {approvalLabel(user.approval_status, t)}
                    </Badge>
                    <TagChip tag={getCockpitTagOnDate(user, today)} />
                    {user.phone ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                        <IconPhone className="h-3 w-3" />
                        {user.phone}
                      </span>
                    ) : null}
                  </div>
                  <a href={href} className="sr-only">
                    {user.name}
                  </a>
                </div>
              </button>
              <div className="mt-2 pl-[52px]">
                <MemberListActions
                  user={user}
                  detailHref={href}
                  editHref={editHref(user.id)}
                  showRequestAction={showRequestAction}
                  showAcceptActions={showAcceptActions}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-[1] bg-gradient-to-r from-primary/[0.09] via-sky-50/80 to-teal-50/70 text-[11px] uppercase tracking-[0.12em] text-neutral-600 dark:from-primary/15 dark:via-neutral-900 dark:to-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.fields.rabId")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.fields.rank")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.fields.name")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.fields.memberType")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.fields.personalId")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.fields.wing")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.fields.phone")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.fields.joiningDate")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.fields.outDate")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.fields.status")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.currentTag")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("cc.fields.approval")}
              </th>
              <th className="px-4 py-3.5 font-semibold">
                {t("common.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((user, index) => {
              const href = detailHref(user.id);
              return (
                <tr
                  key={user.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openRow(user.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openRow(user.id);
                    }
                  }}
                  className={cn(
                    "group cursor-pointer border-t border-neutral-100/90 transition dark:border-neutral-800",
                    index % 2 === 1 && "bg-neutral-50/40 dark:bg-neutral-900/40",
                    "hover:bg-primary/[0.05] focus-visible:bg-primary/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 dark:hover:bg-primary/[0.1]",
                  )}
                >
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-neutral-100/90 px-1.5 py-0.5 font-mono text-[11px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                      {user.rab_id}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {user.rank || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={user.name}
                        muted={user.status !== "1"}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-900 dark:text-neutral-50">
                          {user.name}
                        </p>
                        <a href={href} className="sr-only">
                          {user.name}
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <MemberTypeChip type={user.member_type} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                    {user.personal_id || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {user.wing ? (
                      <span className="inline-flex rounded-full border border-sky-200/80 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200">
                        {user.wing}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {user.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
                    {formatDateDisplay(user.joining_date) || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
                    {formatDateDisplay(user.out_date) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={cn(
                        "border font-semibold",
                        user.status === "1"
                          ? "border-primary/25 bg-primary/10 text-primary"
                          : "border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800",
                      )}
                    >
                      {statusLabel(user.status, t)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <TagChip tag={getCockpitTagOnDate(user, today)} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={cn(
                        "border font-semibold",
                        approvalClass[user.approval_status],
                      )}
                    >
                      {approvalLabel(user.approval_status, t)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <MemberListActions
                      user={user}
                      detailHref={href}
                      editHref={editHref(user.id)}
                      showRequestAction={showRequestAction}
                      showAcceptActions={showAcceptActions}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ListPagination
        page={page}
        totalPages={totalPages}
        total={total}
        from={from}
        to={to}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        className="bg-gradient-to-r from-neutral-50/80 to-teal-50/30 dark:from-neutral-900 dark:to-neutral-900"
      />
    </div>
  );
}
