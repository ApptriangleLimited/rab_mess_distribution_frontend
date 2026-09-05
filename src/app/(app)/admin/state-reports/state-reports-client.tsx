"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCheck,
  IconCircleCheck,
  IconClockHour4,
  IconDownload,
  IconFileReport,
  IconFlame,
  IconInbox,
  IconPrinter,
  IconSoup,
  IconTags,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ListPagination } from "@/components/shared/list-pagination";
import { useToast } from "@/components/shared/toast-provider";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  SearchFilterBar,
} from "@/components/shared/search-filter-bar";
import { AdminTabs } from "@/components/layout/ration-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { formatDateLong, todayISO } from "@/lib/date";
import { downloadStateReportPdf } from "@/lib/download-state-report-pdf";
import { tagCellClass } from "@/lib/tag-colors";
import {
  approveStateReport,
  getStateReport,
  listPendingStateReports,
  listStateReports,
  rejectStateReport,
} from "@/lib/store/state-reports";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { PAGE_SIZE } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { DailyStateReport, StateReportStatus } from "@/lib/types";

const STATUS_CLASS: Record<StateReportStatus, string> = {
  pending:
    "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200",
  approved:
    "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
  rejected:
    "border-rose-200/90 bg-rose-50 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200",
};

type Filter = "pending" | "all" | "approved" | "rejected";

function statusLabel(
  status: StateReportStatus,
  t: ReturnType<typeof useT>,
) {
  if (status === "pending") return t("stateReport.statusPending");
  if (status === "approved") return t("stateReport.statusApproved");
  return t("stateReport.statusRejected");
}

export default function AdminStateReportsClient() {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const state = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const idParam = searchParams.get("id");
  const filterParam = searchParams.get("filter");
  const filter: Filter =
    filterParam === "all" ||
    filterParam === "approved" ||
    filterParam === "rejected" ||
    filterParam === "pending"
      ? filterParam
      : "pending";

  const [q, setQ] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);

  const pending = useMemo(
    () => listPendingStateReports(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.state_reports],
  );

  const all = useMemo(
    () => listStateReports(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.state_reports],
  );

  const searched = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return all;
    return all.filter((r) =>
      [r.date, r.submitted_by, r.reviewed_by ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [all, q]);

  const pendingCount = searched.filter((r) => r.status === "pending").length;
  const approvedCount = searched.filter((r) => r.status === "approved").length;
  const rejectedCount = searched.filter((r) => r.status === "rejected").length;

  const list = useMemo(() => {
    if (filter === "all") return searched;
    return searched.filter((r) => r.status === filter);
  }, [searched, filter]);

  const selectedId =
    idParam && all.some((r) => r.id === idParam)
      ? idParam
      : (list[0]?.id ?? null);

  const selected = selectedId ? getStateReport(selectedId) : null;

  function setQuery(next: { id?: string | null; filter?: Filter }) {
    const params = new URLSearchParams(searchParams.toString());
    const f = next.filter ?? filter;
    if (f === "pending") params.delete("filter");
    else params.set("filter", f);
    const id = next.id === undefined ? selectedId : next.id;
    if (id) params.set("id", id);
    else params.delete("id");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function onApprove() {
    if (!selected) return;
    const updated = approveStateReport(selected.id);
    setApproveOpen(false);
    if (!updated) {
      toast(t("stateReport.adminActionFail"), "error");
      return;
    }
    toast(t("stateReport.approvedToast", { date: updated.date }), "success");
    const still = listPendingStateReports();
    setQuery({ id: still[0]?.id ?? updated.id, filter: "pending" });
  }

  function onReject() {
    if (!selected) return;
    const updated = rejectStateReport(
      selected.id,
      rejectNote.trim() || undefined,
    );
    setRejectOpen(false);
    setRejectNote("");
    if (!updated) {
      toast(t("stateReport.adminActionFail"), "error");
      return;
    }
    toast(t("stateReport.rejectedToast", { date: updated.date }), "success");
    const still = listPendingStateReports();
    setQuery({ id: still[0]?.id ?? updated.id, filter: "pending" });
  }

  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";
  const today = todayISO();

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-emerald-50/50 to-sky-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={t("pages.adminStateReports.title")}
              subtitle={t("pages.adminStateReports.subtitle", {
                count: String(pending.length),
              })}
              center={<AdminTabs />}
            />
          </div>
        </div>

        <SearchFilterBar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("stateReport.searchPlaceholder")}
          trailing={
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 gap-1.5 rounded-xl"
                disabled={!selected}
                onClick={() => {
                  if (!selected) return;
                  downloadStateReportPdf(
                    selected,
                    `state-report-${selected.date}-${selected.status}.pdf`,
                  );
                }}
              >
                <IconDownload className="h-4 w-4" />
                {t("daily.exportPdf")}
              </Button>
              {selected ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-10 gap-1.5 rounded-xl"
                >
                  <Link
                    href={`/admin/state-reports/print?id=${encodeURIComponent(selected.id)}`}
                  >
                    <IconPrinter className="h-4 w-4" />
                    {t("mess.print")}
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 gap-1.5 rounded-xl"
                  disabled
                >
                  <IconPrinter className="h-4 w-4" />
                  {t("mess.print")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 gap-1.5 rounded-xl"
                disabled={selected?.status !== "pending"}
                onClick={() => {
                  setRejectNote("");
                  setRejectOpen(true);
                }}
              >
                <IconX className="h-4 w-4" />
                {t("stateReport.reject")}
              </Button>
              <Button
                type="button"
                variant="cta"
                size="sm"
                className="h-10 gap-1.5 rounded-xl shadow-sm shadow-primary/20"
                disabled={selected?.status !== "pending"}
                onClick={() => setApproveOpen(true)}
              >
                <IconCheck className="h-4 w-4" />
                {t("stateReport.approve")}
              </Button>
            </div>
          }
          tiles={
            <>
              <StatChip
                icon={<IconClockHour4 className="h-3.5 w-3.5" stroke={2.25} />}
                label={t("stateReport.filterPending")}
                value={String(pendingCount)}
                selected={filter === "pending"}
                onClick={() => setQuery({ filter: "pending", id: null })}
              />
              <StatChip
                icon={<IconFileReport className="h-3.5 w-3.5" stroke={2.25} />}
                label={t("stateReport.filterAll")}
                value={String(searched.length)}
                accent
                selected={filter === "all"}
                onClick={() => setQuery({ filter: "all", id: null })}
              />
              <StatChip
                icon={<IconCircleCheck className="h-3.5 w-3.5" stroke={2.25} />}
                label={t("stateReport.filterApproved")}
                value={String(approvedCount)}
                selected={filter === "approved"}
                onClick={() => setQuery({ filter: "approved", id: null })}
              />
              <StatChip
                icon={<IconX className="h-3.5 w-3.5" stroke={2.25} />}
                label={t("stateReport.filterRejected")}
                value={String(rejectedCount)}
                selected={filter === "rejected"}
                onClick={() => setQuery({ filter: "rejected", id: null })}
              />
            </>
          }
        >
        </SearchFilterBar>

        {list.length === 0 ? (
          <EmptyState
            title={
              filter === "pending"
                ? t("stateReport.queueEmpty")
                : t("stateReport.listEmpty")
            }
            description={
              filter === "pending"
                ? t("stateReport.queueEmptyHint")
                : t("stateReport.listEmptyHint")
            }
            action={
              filter === "pending" && all.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 rounded-xl"
                  onClick={() => setQuery({ filter: "all", id: null })}
                >
                  <IconInbox className="h-4 w-4" />
                  {t("stateReport.showAll")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
                <IconInbox className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {t("stateReport.inbox")}
                </h2>
                <span className="ml-auto text-xs tabular-nums text-neutral-500">
                  {list.length}
                </span>
              </div>
              <ul className="max-h-[min(70vh,40rem)] divide-y divide-neutral-100 overflow-y-auto dark:divide-neutral-800">
                {list.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setQuery({ id: r.id })}
                      className={cn(
                        "flex w-full flex-col gap-1 px-3 py-3 text-left transition",
                        selectedId === r.id
                          ? "bg-neutral-100 dark:bg-neutral-900"
                          : "bg-white hover:bg-neutral-50 dark:bg-neutral-950 dark:hover:bg-neutral-900",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                            {formatDateLong(r.date, dateLocale)}
                          </span>
                          {r.date === today ? (
                            <Badge className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100">
                              {t("stateReport.today")}
                            </Badge>
                          ) : null}
                        </span>
                        <Badge
                          className={cn(
                            "shrink-0 border font-semibold",
                            STATUS_CLASS[r.status],
                          )}
                        >
                          {statusLabel(r.status, t)}
                        </Badge>
                      </span>
                      <span className="text-xs text-neutral-500">
                        {t("stateReport.historyMeta", {
                          active: String(r.totals.active),
                          by: r.submitted_by,
                        })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {selected ? (
              <ReportDetail report={selected} dateLocale={dateLocale} />
            ) : (
              <EmptyState title={t("stateReport.pickReport")} />
            )}
          </div>
        )}
      </motion.div>

      <ConfirmDialog
        open={approveOpen}
        title={t("stateReport.approveTitle")}
        body={
          selected
            ? t("stateReport.approveBody", {
                date: formatDateLong(selected.date, dateLocale),
              })
            : ""
        }
        confirmLabel={t("stateReport.approve")}
        tone="success"
        onConfirm={onApprove}
        onCancel={() => setApproveOpen(false)}
      />

      <ConfirmDialog
        open={rejectOpen}
        title={t("stateReport.rejectTitle")}
        body={
          selected
            ? t("stateReport.rejectBody", {
                date: formatDateLong(selected.date, dateLocale),
              })
            : ""
        }
        confirmLabel={t("stateReport.reject")}
        danger
        onConfirm={onReject}
        onCancel={() => {
          setRejectOpen(false);
          setRejectNote("");
        }}
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-200">
            {t("stateReport.rejectNote")}
          </span>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
            placeholder={t("stateReport.rejectNoteHint")}
          />
        </label>
      </ConfirmDialog>
    </PagePane>
  );
}

function ReportDetail({
  report,
  dateLocale,
}: {
  report: DailyStateReport;
  dateLocale: string;
}) {
  const t = useT();
  const { locale } = useI18n();
  const tagEntries = Object.entries(report.totals.by_tag).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const taggedTotal = tagEntries.reduce<number>((n, [, c]) => n + (c ?? 0), 0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [report.id]);

  const totalPages = Math.max(1, Math.ceil(report.members.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageMembers = report.members.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {formatDateLong(report.date, dateLocale)}
            </h2>
            <Badge
              className={cn("border font-semibold", STATUS_CLASS[report.status])}
            >
              {statusLabel(report.status, t)}
            </Badge>
            {report.boro_khana ? (
              <Badge className="gap-1 border border-orange-200/90 bg-orange-50 text-orange-900 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-200">
                <IconFlame className="h-3.5 w-3.5" />
                {t("daily.boroKhanaOn")}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {t("stateReport.submittedBy", {
              by: report.submitted_by,
              at: new Date(report.submitted_at).toLocaleString(
                locale === "bn" ? "bn-BD" : "en-GB",
              ),
            })}
          </p>
          {report.reviewed_at ? (
            <p className="mt-0.5 text-xs text-neutral-500">
              {t("stateReport.reviewedBy", {
                by: report.reviewed_by ?? "—",
                at: new Date(report.reviewed_at).toLocaleString(
                  locale === "bn" ? "bn-BD" : "en-GB",
                ),
              })}
            </p>
          ) : null}
          {report.note ? (
            <p className="mt-2 rounded-xl border border-rose-200/80 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {t("stateReport.rejectNoteLabel")}: {report.note}
            </p>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-2.5 text-[11px] font-bold text-primary dark:border-primary/35 dark:bg-primary/20 dark:text-emerald-100">
            <IconUsers className="h-3.5 w-3.5" />
            {report.totals.active}
            <span className="font-semibold opacity-70">
              {t("stateReport.statActive")}
            </span>
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-emerald-50 px-2.5 text-[11px] font-bold text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            <IconSoup className="h-3.5 w-3.5" />
            {report.totals.mess_eaters}
            <span className="font-semibold opacity-70">
              {t("stateReport.statMess")}
            </span>
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-sky-200/90 bg-sky-50 px-2.5 text-[11px] font-bold text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200">
            <IconTags className="h-3.5 w-3.5" />
            {taggedTotal}
            <span className="font-semibold opacity-70">
              {t("stateReport.statTags")}
            </span>
          </span>
        </div>
      </div>

      {tagEntries.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-4 py-3">
          {tagEntries.map(([tag, count]) => (
            <span
              key={tag}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium",
                tagCellClass(tag),
              )}
              title={tagLabel(tag, locale)}
            >
              {tag}
              <span className="tabular-nums opacity-80">{count}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="border-t border-neutral-100 dark:border-neutral-800">
        {report.members.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyState
              title={t("stateReport.emptyPreview")}
              description={t("stateReport.emptyPreviewHint")}
            />
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-left text-sm">
              <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">
                    {t("daily.registerColName")}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {t("daily.registerColId")}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {t("daily.registerColRank")}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {t("stateReport.colWing")}
                  </th>
                  <th className="px-3 py-2.5 font-medium">
                    {t("stateReport.colTag")}
                  </th>
                  {report.boro_khana ? (
                    <th className="px-3 py-2.5 font-medium">
                      {t("stateReport.messReason")}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {pageMembers.map((m, i) => (
                  <tr
                    key={m.user_id}
                    className="border-t border-neutral-100 transition hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                  >
                    <td className="px-3 py-2 tabular-nums text-neutral-400">
                      {(safePage - 1) * pageSize + i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <UserAvatar name={m.name} size="sm" />
                        <span className="font-medium text-neutral-900 dark:text-white">
                          {m.name}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-600 dark:text-neutral-300">
                      {m.rab_id}
                    </td>
                    <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">
                      {m.rank}
                    </td>
                    <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">
                      {m.wing}
                    </td>
                    <td className="px-3 py-2">
                      {m.tag ? (
                        <span
                          className={cn(
                            "inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium",
                            tagCellClass(m.tag),
                          )}
                        >
                          {m.tag}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    {report.boro_khana ? (
                      <td className="px-3 py-2 text-xs">
                        {m.mess_reason ?? "—"}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination
            className="no-print"
            page={safePage}
            totalPages={totalPages}
            total={report.members.length}
            from={(safePage - 1) * pageSize + 1}
            to={Math.min(safePage * pageSize, report.members.length)}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
          </>
        )}
      </div>
    </section>
  );
}

function StatChip({
  icon,
  label,
  value,
  accent,
  selected,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5",
        selected
          ? "border-primary/40 bg-primary/[0.12] ring-1 ring-primary/20"
          : accent
            ? "border-primary/20 bg-primary/[0.08]"
            : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
      )}
    >
      <span
        className={cn(
          "opacity-80",
          selected || accent ? "text-primary" : "text-neutral-500",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
        {label}
      </span>
      <span
        className={cn(
          "text-base font-bold tabular-nums",
          selected || accent
            ? "text-primary"
            : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </span>
    </button>
  );
}
