"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { IconArrowLeft, IconPencil, IconPrinter } from "@tabler/icons-react";
import { PritibhojSheets } from "@/components/mess/pritibhoj-sheets";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { MessTabs } from "@/components/layout/mess-tabs";
import { Button } from "@/components/ui/button";
import { useStore } from "@/hooks/use-store";
import { formatDateLong } from "@/lib/date";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { getPritibhojEvent } from "@/lib/store/pritibhoj";
import { useI18n, useT } from "@/i18n/provider";

export default function MessPritibhojPreviewPage() {
  const t = useT();
  const { locale } = useI18n();
  const params = useParams<{ id: string }>();
  const reduceMotion = useReducedMotion();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  useStore();
  const event = getPritibhojEvent(params.id);
  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";

  async function onPrint() {
    const el = printRef.current;
    if (!el || printing) return;
    setPrinting(true);
    try {
      await printLetterElement(
        el,
        event ? `pritibhoj-${event.date}.pdf` : "pritibhoj.pdf",
        "landscape",
        { preserveColors: true },
      );
    } finally {
      setPrinting(false);
    }
  }

  if (!event) {
    return (
      <PagePane className="gap-5">
        <EmptyState
          title={t("mess.pritibhoj.missing")}
          action={
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href="/mess/pritibhoj">{t("common.back")}</Link>
            </Button>
          }
        />
      </PagePane>
    );
  }

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
              title={t("pages.messPritibhojPreview.title")}
              subtitle={t("pages.messPritibhojPreview.subtitle", {
                date: formatDateLong(event.date, dateLocale),
              })}
              leading={
                <Button asChild variant="outline" size="sm" className="rounded-xl">
                  <Link href="/mess/pritibhoj">
                    <IconArrowLeft className="h-4 w-4" />
                    {t("common.back")}
                  </Link>
                </Button>
              }
              center={<MessTabs />}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="h-10 rounded-xl">
                    <Link href={`/mess/pritibhoj/${event.id}/edit`}>
                      <IconPencil className="h-4 w-4" />
                      {t("common.edit")}
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="cta"
                    size="sm"
                    className="h-10 rounded-xl shadow-sm shadow-primary/20"
                    disabled={printing}
                    onClick={() => void onPrint()}
                  >
                    <IconPrinter className="h-4 w-4" />
                    {printing ? t("common.loading") : t("mess.print")}
                  </Button>
                </div>
              }
            />
          </div>
        </div>

        <div ref={printRef}>
          <PritibhojSheets event={event} dateLocale={dateLocale} />
        </div>
      </motion.div>
    </PagePane>
  );
}
