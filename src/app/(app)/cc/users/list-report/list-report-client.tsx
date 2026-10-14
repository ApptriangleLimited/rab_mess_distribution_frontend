"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  IconArrowLeft,
  IconDownload,
  IconTableExport,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingScreen } from "@/components/shared/loading-screen";
import { MemberFullListLetter } from "@/components/users/member-full-list-letter";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { isCcApiEnabled } from "@/lib/api/mode";
import { listMembers, memberToUser } from "@/lib/api/members";
import { CONSUME_REPORT_META, wingOfficialName } from "@/lib/constants";
import { formatDateDisplay, todayISO } from "@/lib/date";
import {
  downloadMemberFullListExcel,
  downloadMemberFullListPdf,
  reportFileStem,
} from "@/lib/download-member-full-list";
import { memberListFilterChips } from "@/lib/member-list-report";
import {
  fullMemberListHeaders,
  fullMemberListRows,
} from "@/lib/member-full-list-report";
import {
  filterUsers,
  userFiltersFromSearchParams,
  userFiltersToSearchParams,
} from "@/lib/store/users";
import type { User } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";

export default function MemberFullListReportClient({
  listHref = "/cc/users",
}: {
  listHref?: string;
}) {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const apiOn = isCcApiEnabled();
  const state = useStore();
  const searchParams = useSearchParams();
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(apiOn);

  const filters = useMemo(
    () => userFiltersFromSearchParams(searchParams),
    [searchParams],
  );

  useEffect(() => {
    if (!apiOn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const query = {
      q: filters.q || undefined,
      status: filters.status,
      approval: filters.approval,
      member_type: filters.member_type,
      wing: filters.wing,
      wing_family: filters.wing && filters.wing !== "all" ? "1" : undefined,
      rank: filters.rank,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      page_size: 500,
    };
    listMembers({ ...query, page: 1 })
      .then(async (first) => {
        if (cancelled) return;
        const items = [...(first.items ?? [])];
        const total = first.total ?? items.length;
        const pages = Math.min(20, Math.ceil(total / 500) || 1);
        if (pages > 1) {
          const rest = await Promise.all(
            Array.from({ length: pages - 1 }, (_, i) =>
              listMembers({ ...query, page: i + 2 }),
            ),
          );
          if (cancelled) return;
          for (const data of rest) items.push(...(data.items ?? []));
        }
        setApiUsers(items.map(memberToUser));
      })
      .catch((err) => {
        if (cancelled) return;
        setApiUsers([]);
        const detail =
          err instanceof ApiClientError
            ? err.detail
            : "Could not load members from API.";
        toast(detail, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, filters, toast]);

  const users = apiOn ? apiUsers : filterUsers(state.users, filters);
  const backHref = `${listHref}?${userFiltersToSearchParams(filters).toString()}`;
  const canAct = users.length > 0;
  const reportTitle = t("cc.fullMemberListReportTitle");

  function reportPayload() {
    const useBn = locale === "bn";
    const wingLabel = (wing: string) =>
      wing ? wingOfficialName(wing, state.wing_labels) : "—";
    return {
      org: useBn ? CONSUME_REPORT_META.orgNameBn : CONSUME_REPORT_META.orgName,
      title: reportTitle,
      countLabel: `${t("cc.memberListReportCount", { count: users.length })} · ${formatDateDisplay(todayISO())}`,
      chips: memberListFilterChips(filters, t, wingLabel),
      headers: fullMemberListHeaders(t),
      rows: fullMemberListRows(users, t),
    };
  }

  function onDownloadPdf() {
    if (!canAct) return;
    downloadMemberFullListPdf({
      ...reportPayload(),
      filename: `${reportFileStem(reportTitle)}.pdf`,
    });
  }

  function onDownloadExcel() {
    if (!canAct) return;
    downloadMemberFullListExcel({
      ...reportPayload(),
      filename: `${reportFileStem(reportTitle)}.xls`,
    });
  }

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("pages.ccUsersFullReport.title")}
          subtitle={
            loading
              ? t("common.loading")
              : t("pages.ccUsersFullReport.subtitle", { count: users.length })
          }
          leading={
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href={backHref}>
                <IconArrowLeft className="h-4 w-4" />
                {t("common.back")}
              </Link>
            </Button>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={!canAct || loading}
                onClick={onDownloadExcel}
              >
                <IconTableExport className="h-4 w-4" />
                {t("cc.exportExcel")}
              </Button>
              <Button
                type="button"
                variant="cta"
                size="sm"
                className="rounded-xl"
                disabled={!canAct || loading}
                onClick={onDownloadPdf}
              >
                <IconDownload className="h-4 w-4" />
                {t("cc.exportPdf")}
              </Button>
            </div>
          }
        />
      </div>

      {loading ? (
        <LoadingScreen />
      ) : !canAct ? (
        <EmptyState title={t("cc.empty")} />
      ) : (
        <MemberFullListLetter
          users={users}
          filters={filters}
          wingLabels={state.wing_labels}
          title={reportTitle}
        />
      )}
    </PagePane>
  );
}
