"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconBuildingBank, IconEye, IconUsers } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserConfirmCard } from "@/components/daily/user-confirm-card";
import { RosterRow } from "@/components/daily/status-toggle";
import { RationTabs } from "@/components/layout/ration-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/hooks/use-store";
import { useToast } from "@/components/shared/toast-provider";
import { updateUserBank, compareUsers } from "@/lib/store/users";
import { RANKS, WINGS } from "@/lib/constants";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

type BankForm = {
  bank_name: string;
  account_name: string;
  account_number: string;
  routing: string;
  branch: string;
};

function bankFromUser(user: User): BankForm {
  return {
    bank_name: user.bank_name ?? "",
    account_name: user.account_name ?? "",
    account_number: user.account_number ?? "",
    routing: user.routing ?? "",
    branch: user.branch ?? "",
  };
}

function hasBank(user: User) {
  return Boolean(
    (user.account_number ?? "").trim() || (user.bank_name ?? "").trim(),
  );
}

export default function RationMembersPage() {
  const t = useT();
  const state = useStore();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("all");
  const [wing, setWing] = useState("all");
  const [status, setStatus] = useState("all");
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [bankUser, setBankUser] = useState<User | null>(null);
  const [bankForm, setBankForm] = useState<BankForm | null>(null);

  useEffect(() => {
    if (!bankUser) {
      setBankForm(null);
      return;
    }
    const latest = state.users.find((u) => u.id === bankUser.id) ?? bankUser;
    setBankForm(bankFromUser(latest));
  }, [bankUser, state.users]);

  const approved = useMemo(
    () => state.users.filter((u) => u.approval_status === "approved"),
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

  const roster = useMemo(() => {
    const query = q.trim().toLowerCase();
    return approved
      .filter((u) => {
        if (status !== "all" && u.status !== status) return false;
        if (rank !== "all" && u.rank !== rank) return false;
        if (wing !== "all" && u.wing !== wing) return false;
        if (!query) return true;
        return [u.name, u.rab_id, u.rank, u.wing, u.account_number, u.bank_name]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(compareUsers);
  }, [approved, q, rank, wing, status]);

  const liveViewUser = viewUser
    ? (state.users.find((u) => u.id === viewUser.id) ?? viewUser)
    : null;

  function saveBank() {
    if (!bankUser || !bankForm) return;
    const updated = updateUserBank(bankUser.id, bankForm);
    if (updated) {
      toast(t("ration.savedMemberBank"), "success");
      setBankUser(null);
    }
  }

  const fieldClass =
    "h-11 rounded-xl border-neutral-200 bg-white text-sm shadow-none dark:border-neutral-600 dark:bg-neutral-950";

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <PageHeader
          title={t("pages.rationMembers.title")}
          subtitle={t("pages.rationMembers.subtitle", {
            count: roster.length,
          })}
          center={<RationTabs />}
          actions={
            <>
              <StatChip
                label={t("daily.rosterStatAll")}
                value={String(approved.length)}
                accent
              />
              <StatChip
                label={t("daily.rosterStatActive")}
                value={String(activeCount)}
              />
              <StatChip
                label={t("daily.rosterStatInactive")}
                value={String(inactiveCount)}
              />
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
          <ClearFiltersButton
            disabled={
              !q.trim() && rank === "all" && wing === "all" && status === "all"
            }
            onClick={() => {
              setQ("");
              setRank("all");
              setWing("all");
              setStatus("all");
            }}
          />
        </div>

        {approved.length === 0 ? (
          <EmptyState title={t("daily.emptyRoster")} />
        ) : roster.length === 0 ? (
          <EmptyState title={t("common.noResults")} />
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
                    <th className="px-4 py-3">{t("cc.fields.status")}</th>
                    <th className="px-4 py-3 text-right">
                      {t("common.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((user) => {
                    const bankReady = hasBank(user);
                    return (
                      <RosterRow
                        key={user.id}
                        user={user}
                        actions={
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg px-2.5"
                              onClick={() => setViewUser(user)}
                            >
                              <IconEye className="h-3.5 w-3.5" />
                              {t("common.view")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={bankReady ? "outline" : "cta"}
                              className="h-8 rounded-lg px-2.5"
                              onClick={() => setBankUser(user)}
                            >
                              <IconBuildingBank className="h-3.5 w-3.5" />
                              {bankReady
                                ? t("ration.editMemberBankBtn")
                                : t("ration.addMemberBank")}
                            </Button>
                          </div>
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      <ConfirmDialog
        open={!!liveViewUser}
        tone="default"
        title={t("ration.viewMember")}
        body={t("ration.viewMemberHint")}
        confirmLabel={t("common.done")}
        panelClassName="max-w-[33.6rem]"
        onCancel={() => setViewUser(null)}
        onConfirm={() => setViewUser(null)}
      >
        {liveViewUser ? (
          <div className="space-y-4">
            <UserConfirmCard user={liveViewUser} />
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-3.5 dark:border-neutral-700 dark:bg-neutral-900/60">
              <p className="mb-2.5 text-sm font-semibold text-neutral-900 dark:text-white">
                {t("ration.editMemberBank")}
              </p>
              {hasBank(liveViewUser) ? (
                <dl className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["bank_name", t("cc.fields.bankName")],
                      ["account_name", t("cc.fields.accountName")],
                      ["account_number", t("cc.fields.accountNumber")],
                      ["routing", t("cc.fields.routing")],
                      ["branch", t("cc.fields.branch")],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="min-w-0">
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                        {label}
                      </dt>
                      <dd className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
                        {liveViewUser[key] || "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-neutral-500">{t("ration.noBankYet")}</p>
              )}
              <Button
                type="button"
                size="sm"
                variant="cta"
                className="mt-3 rounded-lg"
                onClick={() => {
                  setViewUser(null);
                  setBankUser(liveViewUser);
                }}
              >
                <IconBuildingBank className="h-3.5 w-3.5" />
                {hasBank(liveViewUser)
                  ? t("ration.editMemberBankBtn")
                  : t("ration.addMemberBank")}
              </Button>
            </div>
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!bankUser}
        tone="default"
        title={
          bankUser && hasBank(bankUser)
            ? t("ration.editMemberBankBtn")
            : t("ration.addMemberBank")
        }
        body={t("ration.editMemberBankHint")}
        confirmLabel={t("ration.saveMemberBank")}
        panelClassName="max-w-[33.6rem]"
        onCancel={() => setBankUser(null)}
        onConfirm={saveBank}
      >
        {bankUser && bankForm ? (
          <div className="space-y-4">
            <UserConfirmCard user={bankUser} />
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["bank_name", t("cc.fields.bankName")],
                  ["account_name", t("cc.fields.accountName")],
                  ["account_number", t("cc.fields.accountNumber")],
                  ["routing", t("cc.fields.routing")],
                  ["branch", t("cc.fields.branch")],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    value={bankForm[key]}
                    onChange={(e) =>
                      setBankForm((prev) =>
                        prev ? { ...prev, [key]: e.target.value } : prev,
                      )
                    }
                    className="h-10 rounded-lg"
                  />
                </div>
              ))}
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
