"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  IconArrowLeft,
  IconDownload,
  IconPrinter,
  IconTableExport,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { MemberListLetter } from "@/components/users/member-list-letter";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { isCcApiEnabled } from "@/lib/api/mode";
import { listMembers, memberToUser } from "@/lib/api/members";
import { CONSUME_REPORT_META, wingDisplayLabel } from "@/lib/constants";
import { formatDateDisplay, todayISO } from "@/lib/date";
import {
  downloadMemberListExcel,
  downloadMemberListPdf,
} from "@/lib/download-member-list";
import {
  memberListFilterChips,
  memberListTableHeaders,
  memberListTableRows,
} from "@/lib/member-list-report";
import { printLetterElement } from "@/lib/print-letter-pdf";
import {
  filterUsers,
  userFiltersFromSearchParams,
  userFiltersToSearchParams,
} from "@/lib/store/users";
import type { User } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";

export default function CcUsersPrintClient({
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
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
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
    listMembers({
      q: filters.q || undefined,
      status: filters.status,
      approval: filters.approval,
      wing: filters.wing,
      rank: filters.rank,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      page: 1,
      page_size: 500,
    })
      .then((data) => {
        if (cancelled) return;
        setApiUsers(data.items.map(memberToUser));
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

  function reportPayload() {
    const useBn = locale === "bn";
    const wingLabel = (wing: string) =>
      wing ? wingDisplayLabel(wing, state.wing_labels) : "—";
    return {
      org: useBn ? CONSUME_REPORT_META.orgNameBn : CONSUME_REPORT_META.orgName,
      station: useBn
        ? CONSUME_REPORT_META.stationBn
        : CONSUME_REPORT_META.station,
      title: t("cc.memberListReportTitle"),
      countLabel: `${t("cc.memberListReportCount", { count: users.length })} · ${formatDateDisplay(todayISO())}`,
      chips: memberListFilterChips(filters, t, wingLabel),
      headers: memberListTableHeaders(t),
      rows: memberListTableRows(users, t),
    };
  }

  function onDownloadPdf() {
    if (!canAct) return;
    downloadMemberListPdf({
      ...reportPayload(),
      filename: "member-list.pdf",
    });
  }

  function onDownloadExcel() {
    if (!canAct) return;
    downloadMemberListExcel({
      ...reportPayload(),
      filename: "member-list.xls",
    });
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || !canAct) return;
    setPrinting(true);
    try {
      await printLetterElement(el, "member-list.pdf", "portrait", {
        skipInlineStyles: true,
      });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("pages.ccUsersPrint.title")}
          subtitle={
            loading
              ? t("common.loading")
              : t("pages.ccUsersPrint.subtitle", { count: users.length })
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
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={!canAct || loading}
                onClick={onDownloadPdf}
              >
                <IconDownload className="h-4 w-4" />
                {t("cc.exportPdf")}
              </Button>
              <Button
                type="button"
                variant="cta"
                size="sm"
                className="rounded-xl"
                disabled={!canAct || printing || loading}
                onClick={() => void onPrint()}
              >
                <IconPrinter className="h-4 w-4" />
                {printing ? t("common.loading") : t("mess.print")}
              </Button>
            </div>
          }
        />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-neutral-500">
          {t("common.loading")}
        </p>
      ) : !canAct ? (
        <EmptyState title={t("cc.empty")} />
      ) : (
        <MemberListLetter
          ref={printRef}
          users={users}
          filters={filters}
          wingLabels={state.wing_labels}
        />
      )}
    </PagePane>
  );
}
