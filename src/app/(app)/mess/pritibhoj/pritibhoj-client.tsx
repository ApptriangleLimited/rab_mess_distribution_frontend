"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  IconCake,
  IconEye,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconTrash,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ClearFiltersButton } from "@/components/shared/clear-filters-button";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { MessTabs } from "@/components/layout/mess-tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import { formatDateDisplay } from "@/lib/date";
import {
  deletePritibhojEvent,
  eventManpower,
  listPritibhojEvents,
} from "@/lib/store/pritibhoj";
import type { PritibhojEvent } from "@/lib/types";
import { useT } from "@/i18n/provider";

export default function MessPritibhojClient() {
  const t = useT();
  const state = useStore();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState("");
  const [deleting, setDeleting] = useState<PritibhojEvent | null>(null);

  const events = useMemo(
    () => listPritibhojEvents(),
    [state.pritibhoj_events],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) =>
      [event.title, event.occasion, event.date, event.org]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [events, q]);

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-amber-50/50 to-orange-50/40 p-4 shadow-[0_10px_40px_-24px_rgba(180,83,9,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl dark:bg-amber-500/10"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={t("pages.messPritibhoj.title")}
              subtitle={t("pages.messPritibhoj.subtitle", {
                count: events.length,
              })}
              center={<MessTabs />}
              actions={
                <Button
                  asChild
                  variant="cta"
                  size="sm"
                  className="h-10 gap-1.5 rounded-xl shadow-sm shadow-primary/20"
                >
                  <Link href="/mess/pritibhoj/new">
                    <IconPlus className="h-4 w-4" />
                    {t("mess.pritibhoj.new")}
                  </Link>
                </Button>
              }
            />
          </div>
        </div>

        <SearchFilterBar
          search={q}
          onSearchChange={setQ}
          searchPlaceholder={t("mess.pritibhoj.searchPlaceholder")}
          searchClassName="w-64 shrink-0 sm:w-72"
        >
          <ClearFiltersButton disabled={!q.trim()} onClick={() => setQ("")} />
        </SearchFilterBar>

        {filtered.length === 0 ? (
          <EmptyState
            title={t("mess.pritibhoj.listEmpty")}
            description={t("mess.pritibhoj.listEmptyHint")}
            action={
              <Button
                asChild
                variant="cta"
                size="sm"
                className="h-9 rounded-xl px-3"
              >
                <Link href="/mess/pritibhoj/new">
                  <IconPlus className="h-3.5 w-3.5" />
                  {t("mess.pritibhoj.new")}
                </Link>
              </Button>
            }
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <IconCake className="h-4 w-4 text-amber-700" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {t("pages.messPritibhoj.title")}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-3">{t("mess.pritibhoj.date")}</th>
                    <th className="px-4 py-3">{t("mess.pritibhoj.title")}</th>
                    <th className="px-4 py-3">{t("mess.pritibhoj.occasion")}</th>
                    <th className="px-4 py-3">{t("mess.pritibhoj.colManpower")}</th>
                    <th className="px-4 py-3 text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((event) => (
                    <tr
                      key={event.id}
                      className="border-t border-neutral-100 transition hover:bg-neutral-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                    >
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                        {formatDateDisplay(event.date)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/mess/pritibhoj/${event.id}`}
                          className="font-semibold text-neutral-900 hover:underline dark:text-white"
                        >
                          {event.title}
                        </Link>
                      </td>
                      <td className="max-w-[18rem] px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {event.occasion || "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                        {eventManpower(event)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                          >
                            <Link
                              href={`/mess/pritibhoj/${event.id}`}
                              aria-label={t("mess.pritibhoj.preview")}
                            >
                              <IconEye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                          >
                            <Link
                              href={`/mess/pritibhoj/${event.id}/edit`}
                              aria-label={t("common.edit")}
                            >
                              <IconPencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                          >
                            <Link
                              href={`/mess/pritibhoj/${event.id}/print`}
                              aria-label={t("mess.print")}
                            >
                              <IconPrinter className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-red-600 hover:text-red-700"
                            aria-label={t("common.delete")}
                            onClick={() => setDeleting(event)}
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </motion.div>

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title={t("mess.pritibhoj.deleteTitle")}
        body={t("mess.pritibhoj.deleteBody", { title: deleting?.title ?? "" })}
        confirmLabel={t("common.delete")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deletePritibhojEvent(deleting.id);
          toast(t("mess.pritibhoj.deleted"), "success");
          setDeleting(null);
        }}
      />
    </PagePane>
  );
}
