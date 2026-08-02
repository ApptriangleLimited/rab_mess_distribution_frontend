"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { IconPlus, IconUsers } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserConfirmCard } from "@/components/daily/user-confirm-card";
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
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/shared/toast-provider";
import { endEntry, setUserStatus } from "@/lib/store/daily";
import { getAssignment, setTag } from "@/lib/store/assignments";
import { DAILY_TAGS, RANKS, WINGS } from "@/lib/constants";
import { todayISO } from "@/lib/date";
import { TagSelector } from "@/components/daily/tag-selector";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { DailyTag, User, UserStatus } from "@/lib/types";

export default function RosterPage() {
  const t = useT();
  const state = useStore();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [tag, setTagFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [endUser, setEndUser] = useState<User | null>(null);
  const [statusUser, setStatusUser] = useState<User | null>(null);
  const [statusNext, setStatusNext] = useState<UserStatus>("0");
  const [actionTag, setActionTag] = useState<DailyTag>("MS");
  const today = todayISO();

  const approved = useMemo(
    () => state.users.filter((u) => u.approval_status === "approved"),
    [state.users],
  );

  const activeCount = useMemo(
    () => approved.filter((u) => u.status === "1").length,
    [approved],
  );

  const roster = useMemo(() => {
    const query = q.trim().toLowerCase();
    return approved.filter((u) => {
      if (rank !== "all" && u.rank !== rank) return false;
      if (wing !== "all" && u.wing !== wing) return false;
      if (status !== "all" && u.status !== status) return false;
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
    });
  }, [approved, q, rank, wing, tag, status, today, state.assignments]);

  function openEnd(user: User) {
    const existing = getAssignment(user.id, today);
    setActionTag(existing?.tag ?? "MS");
    setEndUser(user);
  }

  function openStatus(user: User, next: UserStatus) {
    setStatusNext(next);
    setStatusUser(user);
  }

  function confirmStatus() {
    if (!statusUser) return;
    setUserStatus(statusUser.id, statusNext);
    toast(
      statusNext === "1"
        ? t("daily.activatedToast")
        : t("daily.deactivatedToast"),
      "success",
    );
    setStatusUser(null);
  }

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
          subtitle={t("pages.roster.subtitle", { count: roster.length })}
          actions={
            <Button asChild variant="cta" size="sm" className="rounded-xl">
              <Link href="/daily/users/new">
                <IconPlus className="h-3.5 w-3.5" />
                {t("cc.newUser")}
              </Link>
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatChip
            label={t("daily.rosterStatShowing")}
            value={String(roster.length)}
            accent
          />
          <StatChip
            label={t("daily.rosterStatActive")}
            value={String(activeCount)}
          />
          <StatChip
            label={t("daily.rosterStatApproved")}
            value={String(approved.length)}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200/90 bg-gradient-to-br from-neutral-50/80 to-white p-3.5 shadow-sm dark:border-neutral-700 dark:from-neutral-900/80 dark:to-neutral-950">
          <div className="flex-1 space-y-1.5 sm:w-120">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("common.search")}
            </p>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("cc.searchPlaceholder")}
              aria-label={t("common.search")}
              className={fieldClass}
            />
          </div>
          <div className="w-[10rem] space-y-1.5">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("cc.filterRank")}
            </p>
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger className={fieldClass}>
                <SelectValue placeholder={t("cc.selectRank")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {RANKS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[10rem] space-y-1.5">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("cc.filterWing")}
            </p>
            <Select value={wing} onValueChange={setWing}>
              <SelectTrigger className={fieldClass}>
                <SelectValue placeholder={t("cc.selectWing")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {WINGS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[10rem] space-y-1.5">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("daily.filterTag")}
            </p>
            <Select value={tag} onValueChange={setTagFilter}>
              <SelectTrigger className={fieldClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="none">{t("daily.noTag")}</SelectItem>
                {DAILY_TAGS.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} — {t(item.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[10rem] space-y-1.5">
            <p className="text-[11px] font-medium text-neutral-400">
              {t("cc.filterStatus")}
            </p>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className={fieldClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="1">{t("cc.statusActive")}</SelectItem>
                <SelectItem value="0">{t("cc.statusInactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {roster.length === 0 ? (
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
                    <th className="px-4 py-3">{t("cc.fields.name")}</th>
                    <th className="px-4 py-3">{t("cc.fields.rank")}</th>
                    <th className="px-4 py-3">{t("cc.fields.wing")}</th>
                    <th className="px-4 py-3">{t("daily.setTag")}</th>
                    <th className="px-4 py-3">{t("cc.fields.status")}</th>
                    <th className="px-4 py-3">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((user) => (
                    <RosterRow
                      key={user.id}
                      user={user}
                      todayTag={getAssignment(user.id, today)?.tag ?? null}
                      onToggle={(next) => openStatus(user, next)}
                      onEnd={() => openEnd(user)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      <ConfirmDialog
        open={!!statusUser}
        tone={statusNext === "0" ? "danger" : "success"}
        title={
          statusNext === "0"
            ? t("confirm.deactivateTitle")
            : t("confirm.activateTitle")
        }
        body={
          statusNext === "0"
            ? t("confirm.deactivateBodyShort")
            : t("confirm.activateBodyShort")
        }
        confirmLabel={
          statusNext === "0" ? t("daily.deactivate") : t("daily.activate")
        }
        onCancel={() => setStatusUser(null)}
        onConfirm={confirmStatus}
      >
        {statusUser ? <UserConfirmCard user={statusUser} /> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!endUser}
        tone="danger"
        title={t("confirm.endTitle")}
        body={t("confirm.endBodyShort")}
        confirmLabel={t("daily.endEntry")}
        onCancel={() => setEndUser(null)}
        onConfirm={() => {
          if (!endUser) return;
          setTag(endUser.id, today, actionTag);
          endEntry(endUser.id);
          toast(t("daily.endedToast"), "success");
          setEndUser(null);
        }}
      >
        {endUser ? (
          <div className="space-y-4">
            <UserConfirmCard user={endUser} />
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-3.5 dark:border-neutral-700 dark:bg-neutral-900/60">
              <div className="mb-2.5">
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {t("daily.setTag")}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {t("daily.setTagHint")}
                </p>
              </div>
              <TagSelector
                value={actionTag}
                onChange={(next) => {
                  if (next) setActionTag(next);
                }}
                className="h-9 rounded-lg"
              />
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
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
        "rounded-2xl border px-4 py-3",
        accent
          ? "border-primary/20 bg-gradient-to-br from-primary/[0.08] to-transparent"
          : "border-neutral-200/90 bg-white dark:border-neutral-700 dark:bg-neutral-900",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tracking-tight",
          accent ? "text-primary" : "text-neutral-900 dark:text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}
