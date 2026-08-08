"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { IconPlus, IconUsers } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { ApprovalRow } from "@/components/daily/approval-card";
import { DailyTabs } from "@/components/layout/daily-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RosterRow } from "@/components/daily/status-toggle";
import { MemberDateFilter } from "@/components/users/user-filters";
import { useStore } from "@/hooks/use-store";
import { getAssignment } from "@/lib/store/assignments";
import {
  compareUsers,
  matchesMemberDateFilter,
} from "@/lib/store/users";
import { listAllTags } from "@/lib/store/rates";
import { RANKS, WINGS } from "@/lib/constants";
import { todayISO } from "@/lib/date";
import { tagLabel } from "@/i18n";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export default function RosterPage() {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const state = useStore();
  const tags = listAllTags();
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [tag, setTagFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const today = todayISO();

  const approved = useMemo(
    () => state.users.filter((u) => u.approval_status === "approved"),
    [state.users],
  );

  const pendingAll = useMemo(
    () => state.users.filter((u) => u.approval_status === "pending"),
    [state.users],
  );

  const activeCount = useMemo(
    () => approved.filter((u) => u.status === "1").length,
    [approved],
  );

  const inactiveCount = useMemo(
    () => approved.filter((u) => u.status === "0").length,
    [approved],
  );

  const allCount = pendingAll.length + approved.length;

  const pending = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (status !== "all" || tag !== "all") return [];
    return pendingAll
      .filter((u) => {
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (!matchesMemberDateFilter(u, dateFrom, dateTo)) return false;
        if (!query) return true;
        return [u.name, u.rab_id, u.wing, u.rank, u.phone]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsers);
  }, [
    pendingAll,
    q,
    rank,
    wing,
    status,
    tag,
    dateFrom,
    dateTo,
  ]);

  const roster = useMemo(() => {
    const query = q.trim().toLowerCase();
    return approved
      .filter((u) => {
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (status !== "all" && u.status !== status) return false;
        if (!matchesMemberDateFilter(u, dateFrom, dateTo)) return false;
        if (tag !== "all") {
          const todayTag = getAssignment(u.id, today)?.tag ?? null;
          if (tag === "none") {
            if (todayTag) return false;
          } else if (todayTag !== tag) {
            return false;
          }
        }
        if (!query) return true;
        return [u.name, u.rab_id, u.wing, u.rank, u.phone]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsers);
  }, [
    approved,
    q,
    rank,
    wing,
    tag,
    status,
    today,
    state.assignments,
    dateFrom,
    dateTo,
  ]);

  const boardEmpty = pending.length === 0 && roster.length === 0;
  const showing = pending.length + roster.length;

  const fieldClass =
    "h-10 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <PageHeader
          title={t("pages.roster.title")}
          subtitle={t("pages.roster.subtitle", { count: showing })}
          center={<DailyTabs />}
          actions={
            <>
              <StatChip
                label={t("daily.rosterStatAll")}
                value={String(allCount)}
                accent
              />
              <StatChip
                label={t("daily.rosterStatPending")}
                value={String(pendingAll.length)}
              />
              <StatChip
                label={t("daily.rosterStatActive")}
                value={String(activeCount)}
              />
              <StatChip
                label={t("daily.rosterStatInactive")}
                value={String(inactiveCount)}
              />
              <Button asChild variant="cta" size="sm" className="rounded-xl">
                <Link href="/daily/users/new">
                  <IconPlus className="h-3.5 w-3.5" />
                  {t("cc.newUser")}
                </Link>
              </Button>
            </>
          }
        />

        <div className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-neutral-200/90 bg-gradient-to-br from-neutral-50/80 to-white p-3.5 shadow-sm dark:border-neutral-700 dark:from-neutral-900/80 dark:to-neutral-950">
          <div className="min-w-[17rem] max-w-lg w-full shrink-0 sm:w-96">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("cc.searchPlaceholder")}
              aria-label={t("common.search")}
              className={cn(fieldClass, "w-full")}
            />
          </div>
          <div className="min-w-[10rem] flex-1 basis-[10rem]">
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue placeholder={t("cc.selectRank")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allRank")}</SelectItem>
                {RANKS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[10rem] flex-1 basis-[10rem]">
            <Select value={wing} onValueChange={setWing}>
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue placeholder={t("cc.selectWing")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allWing")}</SelectItem>
                {WINGS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[10rem] flex-1 basis-[10rem]">
            <Select value={tag} onValueChange={setTagFilter}>
              <SelectTrigger className={cn(fieldClass, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allTag")}</SelectItem>
                <SelectItem value="none">{t("daily.noTag")}</SelectItem>
                {tags.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code} — {tagLabel(code, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[10rem] flex-1 basis-[10rem]">
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
          />
          <ClearFiltersButton
            disabled={
              !q.trim() &&
              rank === "all" &&
              wing === "all" &&
              tag === "all" &&
              status === "all" &&
              !dateFrom &&
              !dateTo
            }
            onClick={() => {
              setQ("");
              setRank("all");
              setWing("all");
              setTagFilter("all");
              setStatus("all");
              setDateFrom("");
              setDateTo("");
            }}
          />
        </div>

        {boardEmpty ? (
          <EmptyState
            title={t("daily.emptyRoster")}
            description={t("daily.rosterEmptyHint")}
            action={
              <Button asChild variant="cta" size="sm" className="rounded-xl">
                <Link href="/daily/users/new">
                  <IconPlus className="h-3.5 w-3.5" />
                  {t("cc.newUser")}
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
              <IconUsers className="h-3.5 w-3.5 text-neutral-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {t("daily.rosterBoard")}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-3">{t("cc.fields.rabId")}</th>
                    <th className="px-4 py-3">{t("cc.fields.rank")}</th>
                    <th className="px-4 py-3">{t("cc.fields.name")}</th>
                    <th className="px-4 py-3">{t("cc.fields.wing")}</th>
                    <th className="px-4 py-3">{t("cc.fields.joiningDate")}</th>
                    <th className="px-4 py-3">{t("cc.fields.outDate")}</th>
                    <th className="px-4 py-3">{t("cc.fields.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((user) => (
                    <ApprovalRow key={user.id} user={user} />
                  ))}
                  {roster.map((user) => (
                    <RosterRow
                      key={user.id}
                      user={user}
                      showDates
                      onOpen={() => router.push(`/daily/users/${user.id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </PagePane>
  );
}

function StatChip({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
        accent
          ? "border-primary/20 bg-primary/[0.08]"
          : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
        className,
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          accent ? "text-primary" : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}
