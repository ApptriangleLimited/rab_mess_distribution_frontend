"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCircleCheck,
  IconClockHour4,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import {
  SearchFilterBar,
  searchFilterCompactFieldClass,
} from "@/components/shared/search-filter-bar";
import { MemberDateFilter } from "@/components/users/user-filters";
import { TagChip } from "@/components/tag-requests/tag-chip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePagination } from "@/hooks/use-pagination";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { notifyCcDataChange, onCcDataChange } from "@/lib/api/cc-events";
import { isCcApiEnabled } from "@/lib/api/mode";
import { syncStoreFromApi } from "@/lib/api/app-sync";
import {
  acceptTagRequest,
  listTagRequests,
  rejectTagRequestApi,
  requestMember,
  requestToTagRequest,
} from "@/lib/api/tag-requests";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  applyTagRequest,
  getCockpitTagOnDate,
  getCockpitToneOnDate,
  rejectTagRequest,
  upsertLocalTagRequest,
} from "@/lib/store/tag-requests";
import { listAllTags } from "@/lib/store/rates";
import { formatDateDisplay, todayISO } from "@/lib/date";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type {
  TagRequest,
  TagRequestQueue,
  TagRequestStatus,
  User,
} from "@/lib/types";

type Mode = "daily" | "cc" | "ration" | "consume";
type StatusView = "all" | TagRequestStatus;

function queueForMode(mode: Mode): TagRequestQueue {
  if (mode === "ration") return "ration";
  if (mode === "consume") return "consume";
  return "daily";
}

function requestDay(iso: string) {
  return iso.slice(0, 10);
}

export function TagRequestBoard({
  mode,
  title,
  subtitle,
  tabs,
}: {
  mode: Mode;
  title: string;
  subtitle: (count: number) => string;
  tabs: ReactNode;
}) {
  const t = useT();
  const { locale } = useI18n();
  const { toast } = useToast();
  const state = useStore();
  const apiOn = isCcApiEnabled();
  const { ranks, wings } = state;
  const tags = listAllTags();
  const reduceMotion = useReducedMotion();
  const today = todayISO();
  const [apiRows, setApiRows] = useState<TagRequest[]>([]);
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiTotal, setApiTotal] = useState(0);
  const [apiCounts, setApiCounts] = useState({
    requested: 0,
    updated: 0,
    rejected: 0,
    all: 0,
  });
  const [loading, setLoading] = useState(apiOn);
  const [busy, setBusy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [apiPage, setApiPage] = useState(1);
  const [apiPageSize, setApiPageSize] = useState(PAGE_SIZE);

  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [tag, setTagFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const queue = queueForMode(mode);
  const canAct = mode !== "cc";
  const showStatusChips = mode !== "daily";
  const [view, setView] = useState<StatusView>(
    mode === "daily" ? "requested" : "all",
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pendingUpdate, setPendingUpdate] = useState<TagRequest | null>(null);
  const [pendingReject, setPendingReject] = useState<TagRequest | null>(null);

  useEffect(() => onCcDataChange(() => setReloadTick((n) => n + 1)), []);

  useEffect(() => {
    setApiPage(1);
  }, [q, rank, wing, tag, status, view, dateFrom, dateTo]);

  useEffect(() => {
    if (!apiOn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listTagRequests({
      queue,
      status: mode === "daily" ? "requested" : view,
      q: q || undefined,
      rank,
      wing,
      tag,
      member_status: status,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page: apiPage,
      page_size: apiPageSize,
    })
      .then((data) => {
        if (cancelled) return;
        const users: User[] = [];
        const seen = new Set<string>();
        const rows = data.items.map((row) => {
          const member = requestMember(row);
          if (member && !seen.has(member.id)) {
            seen.add(member.id);
            users.push(member);
          }
          return requestToTagRequest(row);
        });
        setApiRows(rows);
        setApiUsers(users);
        setApiTotal(data.total);
        setApiCounts({
          requested: data.status_counts.requested,
          updated: data.status_counts.updated,
          rejected: data.status_counts.rejected,
          all: data.status_counts.all,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setApiRows([]);
        setApiUsers([]);
        setApiTotal(0);
        toast(
          err instanceof ApiClientError ? err.detail : t("tagRequest.cannotRequest"),
          "error",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    apiOn,
    apiPage,
    apiPageSize,
    dateFrom,
    dateTo,
    mode,
    q,
    queue,
    rank,
    reloadTick,
    status,
    t,
    tag,
    toast,
    view,
    wing,
  ]);

  const usersById = useMemo(
    () => new Map((apiOn ? apiUsers : state.users).map((u) => [u.id, u])),
    [apiOn, apiUsers, state.users],
  );

  const demoRows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.tag_requests
      .filter((req) => {
        if ((req.queue ?? "daily") !== queue) return false;
        if (mode === "daily" && req.status !== "requested") return false;
        if (view !== "all" && req.status !== view) return false;
        const user = usersById.get(req.user_id);
        if (!user) return false;
        if (rank !== "all" && user.rank !== rank) return false;
        if (wing !== "all" && user.wing !== wing) return false;
        if (status !== "all" && user.status !== status) return false;
        if (tag !== "all" && req.to_tag !== tag) return false;
        const day = requestDay(req.requested_at);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        if (!query) return true;
        return [user.name, user.rab_id, user.rank, user.wing, req.to_tag]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        const isDemoA = a.id.startsWith("tr_demo_");
        const isDemoB = b.id.startsWith("tr_demo_");
        if (isDemoA !== isDemoB) {
          return isDemoA ? 1 : -1;
        }
        const timeA = a.updated_at || a.requested_at || "";
        const timeB = b.updated_at || b.requested_at || "";
        const c = timeB.localeCompare(timeA);
        if (c !== 0) return c;
        return (
          (b.requested_at || "").localeCompare(a.requested_at || "") ||
          b.id.localeCompare(a.id)
        );
      });
  }, [
    state.tag_requests,
    usersById,
    mode,
    view,
    rank,
    wing,
    status,
    tag,
    dateFrom,
    dateTo,
    q,
    queue,
  ]);

  const rows = apiOn ? apiRows : demoRows;

  const queued = state.tag_requests.filter(
    (r) => (r.queue ?? "daily") === queue,
  );
  const requestedCount = apiOn
    ? apiCounts.requested
    : queued.filter((r) => r.status === "requested").length;
  const updatedCount = apiOn
    ? apiCounts.updated
    : queued.filter((r) => r.status === "updated").length;
  const rejectedCount = apiOn
    ? apiCounts.rejected
    : queued.filter((r) => r.status === "rejected").length;
  const allCount = apiOn ? apiCounts.all : queued.length;

  const resetKey = rows.map((r) => r.id).join("|");
  const clientPage = usePagination(rows, resetKey);
  const page = apiOn
    ? {
        page: apiPage,
        pageSize: apiPageSize,
        total: apiTotal,
        totalPages: Math.max(1, Math.ceil(apiTotal / apiPageSize) || 1),
        pageItems: rows,
        from: apiTotal === 0 ? 0 : (apiPage - 1) * apiPageSize + 1,
        to: Math.min(apiPage * apiPageSize, apiTotal),
        setPage: setApiPage,
        setPageSize: (size: number) => {
          setApiPageSize(size);
          setApiPage(1);
        },
      }
    : clientPage;
  const fieldClass = searchFilterCompactFieldClass;

  async function confirmUpdate() {
    if (!pendingUpdate || busy) return;
    if (apiOn) {
      setBusy(true);
      try {
        const updated = await acceptTagRequest(pendingUpdate.id);
        upsertLocalTagRequest(requestToTagRequest(updated));
        await syncStoreFromApi().catch(() => undefined);
        notifyCcDataChange();
        toast(
          canAct && mode !== "daily"
            ? t("tagRequest.approveToast")
            : t("tagRequest.updateToast"),
          "success",
        );
        setPendingUpdate(null);
      } catch (err) {
        toast(
          err instanceof ApiClientError ? err.detail : t("tagRequest.cannotRequest"),
          "error",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    const ok = applyTagRequest(pendingUpdate.id);
    if (!ok) {
      toast(t("tagRequest.cannotRequest"), "error");
      setPendingUpdate(null);
      return;
    }
    toast(
      canAct && mode !== "daily"
        ? t("tagRequest.approveToast")
        : t("tagRequest.updateToast"),
      "success",
    );
    setPendingUpdate(null);
  }

  async function confirmReject() {
    if (!pendingReject || busy) return;
    if (apiOn) {
      setBusy(true);
      try {
        const updated = await rejectTagRequestApi(pendingReject.id);
        upsertLocalTagRequest(requestToTagRequest(updated));
        notifyCcDataChange();
        toast(t("tagRequest.rejectToast"), "success");
        setPendingReject(null);
      } catch (err) {
        toast(
          err instanceof ApiClientError ? err.detail : t("tagRequest.cannotRequest"),
          "error",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    const ok = rejectTagRequest(pendingReject.id);
    if (!ok) {
      toast(t("tagRequest.cannotRequest"), "error");
      setPendingReject(null);
      return;
    }
    toast(t("tagRequest.rejectToast"), "success");
    setPendingReject(null);
  }

  const updateUser = pendingUpdate
    ? usersById.get(pendingUpdate.user_id)
    : undefined;
  const rejectUser = pendingReject
    ? usersById.get(pendingReject.user_id)
    : undefined;

  return (
    <PagePane>
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
              title={title}
              subtitle={subtitle(apiOn ? apiTotal : rows.length)}
              center={tabs}
            />
          </div>
        </div>

        <SearchFilterBar
          flat
          singleLine
          compact
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("cc.searchPlaceholder")}
          wrapTiles={false}
          className="border-primary/10 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-sm dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900"
          tiles={
            showStatusChips ? (
              <>
                <StatChip
                  icon={<IconSend className="h-3 w-3" />}
                  label={t("tagRequest.statAll")}
                  value={String(allCount)}
                  tone="teal"
                  selected={view === "all"}
                  onClick={() => setView("all")}
                />
                <StatChip
                  icon={<IconClockHour4 className="h-3 w-3" />}
                  label={t("tagRequest.requested")}
                  value={String(requestedCount)}
                  tone="amber"
                  selected={view === "requested"}
                  onClick={() => setView("requested")}
                />
                <StatChip
                  icon={<IconCircleCheck className="h-3 w-3" />}
                  label={t("tagRequest.updated")}
                  value={String(updatedCount)}
                  tone="emerald"
                  selected={view === "updated"}
                  onClick={() => setView("updated")}
                />
                <StatChip
                  icon={<IconX className="h-3 w-3" />}
                  label={t("tagRequest.rejected")}
                  value={String(rejectedCount)}
                  tone="rose"
                  selected={view === "rejected"}
                  onClick={() => setView("rejected")}
                />
              </>
            ) : (
              <StatChip
                icon={<IconClockHour4 className="h-3 w-3" />}
                label={t("tagRequest.requested")}
                value={String(requestedCount)}
                tone="amber"
                selected
              />
            )
          }
        >
          <div className="w-[6.75rem] shrink">
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue placeholder={t("cc.selectRank")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allRank")}</SelectItem>
                {ranks.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[6.5rem] shrink">
            <Select value={wing} onValueChange={setWing}>
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue placeholder={t("cc.selectWing")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allWing")}</SelectItem>
                {wings.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[6.75rem] shrink">
            <Select value={tag} onValueChange={setTagFilter}>
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allTag")}</SelectItem>
                {tags.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code} — {tagLabel(code, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[6.75rem] shrink">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatus")}</SelectItem>
                <SelectItem value="1">{t("cc.statusActive")}</SelectItem>
                <SelectItem value="0">{t("cc.statusInactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <MemberDateFilter
            from={dateFrom}
            to={dateTo}
            onFrom={setDateFrom}
            onTo={setDateTo}
            className="w-[14.25rem] shrink-0"
            triggerClassName="h-8 rounded-lg px-2 text-xs"
          />
        </SearchFilterBar>

        {loading ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            {t("common.loading")}
          </p>
        ) : page.total === 0 ? (
          <EmptyState
            title={
              mode === "ration"
                ? t("tagRequest.emptyRation")
                : mode === "consume"
                  ? t("tagRequest.emptyConsume")
                  : mode === "daily"
                    ? t("tagRequest.emptyDaily")
                    : t("tagRequest.emptyCc")
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(6,121,87,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] dark:border-neutral-700 dark:bg-neutral-950 dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gradient-to-r from-primary/[0.07] via-sky-50/70 to-teal-50/50 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600 dark:from-primary/15 dark:via-neutral-900 dark:to-neutral-900 dark:text-neutral-400">
                  <tr>
                    <th className="px-4 py-3.5">{t("cc.fields.rabId")}</th>
                    <th className="px-4 py-3.5">{t("cc.fields.rank")}</th>
                    <th className="px-4 py-3.5">{t("cc.fields.name")}</th>
                    <th className="px-4 py-3.5">{t("cc.fields.wing")}</th>
                    <th className="px-4 py-3.5">{t("tagRequest.currentTag")}</th>
                    <th className="px-4 py-3.5">{t("tagRequest.requestedTag")}</th>
                    <th className="px-4 py-3.5">{t("tagRequest.status")}</th>
                    <th className="px-4 py-3.5">{t("common.dateRange")}</th>
                    <th className="px-4 py-3.5">{t("tagRequest.requestedAt")}</th>
                    {canAct ? <th className="px-4 py-3.5" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {page.pageItems.map((req) => {
                    const user = usersById.get(req.user_id);
                    if (!user) return null;
                    return (
                      <RequestRow
                        key={req.id}
                        req={req}
                        user={user}
                        today={today}
                        mode={mode}
                        canAct={canAct}
                        onUpdate={() => setPendingUpdate(req)}
                        onReject={
                          mode === "ration" || mode === "consume"
                            ? () => setPendingReject(req)
                            : undefined
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={page.page}
              totalPages={page.totalPages}
              total={page.total}
              from={page.from}
              to={page.to}
              onPageChange={page.setPage}
              pageSize={page.pageSize}
              onPageSizeChange={page.setPageSize}
              className="bg-gradient-to-r from-neutral-50/80 to-teal-50/30 dark:from-neutral-900 dark:to-neutral-900"
            />
          </div>
        )}
      </motion.div>

      <ConfirmDialog
        open={!!pendingUpdate}
        tone="success"
        title={
          mode === "daily"
            ? t("tagRequest.updateTitle")
            : t("tagRequest.approveTitle")
        }
        body={t(
          mode === "daily" ? "tagRequest.updateBody" : "tagRequest.approveBody",
          {
            name: updateUser?.name ?? "",
            tag: pendingUpdate?.to_tag ?? "",
          },
        )}
        confirmLabel={
          busy
            ? t("cc.accepting")
            : mode === "daily"
              ? t("tagRequest.update")
              : t("tagRequest.approve")
        }
        busy={busy}
        onCancel={() => setPendingUpdate(null)}
        onConfirm={confirmUpdate}
      >
        {pendingUpdate && updateUser ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900/60">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                {updateUser.name}
              </p>
              <p className="font-mono text-xs text-neutral-500">
                {updateUser.rab_id}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <TagChip
                  tag={getCockpitTagOnDate(updateUser, today)}
                  tone={getCockpitToneOnDate(updateUser, today)}
                />
                <span className="text-neutral-400">→</span>
                <TagChip tag={pendingUpdate.to_tag} tone={pendingUpdate.trg_tone} />
              </div>
              <p className="text-[11px] tabular-nums text-neutral-500">
                {pendingUpdate.from_date &&
                pendingUpdate.to_date &&
                pendingUpdate.from_date !== pendingUpdate.to_date
                  ? `${formatDateDisplay(pendingUpdate.from_date)} – ${formatDateDisplay(pendingUpdate.to_date)}`
                  : formatDateDisplay(pendingUpdate.from_date || pendingUpdate.date)}
              </p>
            </div>
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!pendingReject}
        tone="danger"
        title={t("tagRequest.rejectTitle")}
        body={t("tagRequest.rejectBody", {
          name: rejectUser?.name ?? "",
          tag: pendingReject?.to_tag ?? "",
        })}
        confirmLabel={busy ? t("cc.rejecting") : t("tagRequest.reject")}
        busy={busy}
        onCancel={() => setPendingReject(null)}
        onConfirm={confirmReject}
      >
        {pendingReject && rejectUser ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900/60">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                {rejectUser.name}
              </p>
              <p className="font-mono text-xs text-neutral-500">
                {rejectUser.rab_id}
              </p>
            </div>
            <TagChip tag={pendingReject.to_tag} tone={pendingReject.trg_tone} />
          </div>
        ) : null}
      </ConfirmDialog>
    </PagePane>
  );
}

function RequestRow({
  req,
  user,
  today,
  mode,
  canAct,
  onUpdate,
  onReject,
}: {
  req: TagRequest;
  user: User;
  today: string;
  mode: Mode;
  canAct: boolean;
  onUpdate: () => void;
  onReject?: () => void;
}) {
  const t = useT();
  const current = getCockpitTagOnDate(user, today);

  return (
    <tr className="border-t border-neutral-100 dark:border-neutral-800">
      <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">
        {user.rab_id}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
        {user.rank || "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={user.name} muted={user.status !== "1"} />
          <span className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
            {user.name}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
        {user.wing || "—"}
      </td>
      <td className="px-4 py-3">
        <TagChip tag={current} tone={getCockpitToneOnDate(user, today)} />
      </td>
      <td className="px-4 py-3">
        <TagChip tag={req.to_tag} tone={req.trg_tone} />
      </td>
      <td className="px-4 py-3">
        <Badge
          className={cn(
            "rounded-md border text-[10px] font-semibold uppercase tracking-wide",
            req.status === "requested"
              ? "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200"
              : req.status === "rejected"
                ? "border-rose-200/90 bg-rose-50 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200"
                : "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
          )}
        >
          {req.status === "requested"
            ? t("tagRequest.requested")
            : req.status === "rejected"
              ? t("tagRequest.rejected")
              : t("tagRequest.updated")}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
        {req.from_date && req.to_date && req.from_date !== req.to_date
          ? `${formatDateDisplay(req.from_date)} – ${formatDateDisplay(req.to_date)}`
          : formatDateDisplay(req.from_date || req.date) || req.from_date || req.date}
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
        {requestDay(req.requested_at)}
      </td>
      {canAct && req.status === "requested" ? (
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="cta"
              size="sm"
              className="rounded-lg"
              onClick={onUpdate}
            >
              {mode === "daily" ? t("tagRequest.update") : t("tagRequest.approve")}
            </Button>
            {onReject ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={onReject}
              >
                {t("tagRequest.reject")}
              </Button>
            ) : null}
          </div>
        </td>
      ) : canAct ? (
        <td className="px-4 py-3" />
      ) : null}
    </tr>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone,
  selected,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "teal" | "amber" | "emerald" | "rose";
  selected?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    teal: "border-primary/25 bg-primary/12 text-primary dark:border-primary/40 dark:bg-primary/25 dark:text-emerald-100",
    amber:
      "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200",
    emerald:
      "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
    rose: "border-rose-200/90 bg-rose-50 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 min-w-0 shrink items-center gap-1 rounded-lg border px-1.5 shadow-sm transition",
        tones,
        selected
          ? "border-black ring-1 ring-black brightness-95 dark:border-white dark:ring-white dark:brightness-110"
          : "hover:brightness-[0.97] dark:hover:brightness-110",
      )}
    >
      <span className="shrink-0 opacity-90" aria-hidden>
        {icon}
      </span>
      <span className="hidden whitespace-nowrap text-[9px] font-bold uppercase tracking-wide lg:inline">
        {label}
      </span>
      <span className="shrink-0 rounded-md bg-black/5 px-1 py-px text-[11px] font-extrabold tabular-nums dark:bg-white/10">
        {value}
      </span>
    </button>
  );
}
