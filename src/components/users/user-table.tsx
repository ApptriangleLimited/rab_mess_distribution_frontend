"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { UserAvatar } from "@/components/shared/user-avatar";
import { usePagination } from "@/hooks/use-pagination";
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
  pending: "bg-amber-50 text-amber-800",
  approved: "bg-emerald-50 text-emerald-800",
  rejected: "bg-red-50 text-red-700",
  ended: "bg-neutral-100 text-neutral-600",
};

export function UserTable({
  users,
  detailHref = (id: string) => `/cc/users/${id}`,
  onEmptyCreateHref = "/cc/users/new",
}: {
  users: User[];
  detailHref?: (id: string) => string;
  onEmptyCreateHref?: string;
}) {
  const t = useT();
  const router = useRouter();
  const resetKey = useMemo(
    () => users.map((u) => u.id).join("|"),
    [users],
  );
  const {
    page,
    setPage,
    totalPages,
    pageItems,
    total,
    from,
    to,
  } = usePagination(users, resetKey);

  if (users.length === 0) {
    return (
      <EmptyState
        title={t("cc.empty")}
        action={
          <Button asChild variant="cta">
            <Link href={onEmptyCreateHref}>{t("cc.emptyAction")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-800">
            <tr>
              <th className="px-4 py-3 font-medium">{t("cc.fields.rabId")}</th>
              <th className="px-4 py-3 font-medium">{t("cc.fields.rank")}</th>
              <th className="px-4 py-3 font-medium">{t("cc.fields.name")}</th>
              <th className="px-4 py-3 font-medium">{t("cc.fields.wing")}</th>
              <th className="px-4 py-3 font-medium">{t("cc.fields.phone")}</th>
              <th className="px-4 py-3 font-medium">
                {t("cc.fields.joiningDate")}
              </th>
              <th className="px-4 py-3 font-medium">{t("cc.fields.outDate")}</th>
              <th className="px-4 py-3 font-medium">{t("cc.fields.status")}</th>
              <th className="px-4 py-3 font-medium">{t("cc.fields.approval")}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((user) => {
              const href = detailHref(user.id);
              return (
                <tr
                  key={user.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(href)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(href);
                    }
                  }}
                  className="cursor-pointer border-t border-neutral-100 transition hover:bg-primary/[0.04] dark:border-neutral-800 dark:hover:bg-primary/[0.08]"
                >
                  <td className="px-4 py-3 font-mono text-xs">{user.rab_id}</td>
                  <td className="px-4 py-3">{user.rank || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.name} />
                      <p className="font-medium text-neutral-900 dark:text-neutral-50">
                        {user.name}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{user.wing || "—"}</td>
                  <td className="px-4 py-3">{user.phone || "—"}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    {formatDateDisplay(user.joining_date) || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    {formatDateDisplay(user.out_date) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={cn(
                        user.status === "1"
                          ? "bg-primary/10 text-primary"
                          : "bg-neutral-100 text-neutral-600",
                      )}
                    >
                      {statusLabel(user.status, t)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={approvalClass[user.approval_status]}>
                      {approvalLabel(user.approval_status, t)}
                    </Badge>
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
      />
    </div>
  );
}
