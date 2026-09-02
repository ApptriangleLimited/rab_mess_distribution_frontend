"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { IconPrinter } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { MessTabs } from "@/components/layout/mess-tabs";
import { PritibhojSheets } from "@/components/mess/pritibhoj-sheets";
import { Button } from "@/components/ui/button";
import { formatDateLong } from "@/lib/date";
import { PRITIBHOJ_DEMO_META } from "@/lib/pritibhoj-demo";
import { useI18n, useT } from "@/i18n/provider";

export default function MessPritibhojClient() {
  const t = useT();
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";
  const dateLabel = formatDateLong(PRITIBHOJ_DEMO_META.dateISO, dateLocale);

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
              subtitle={t("pages.messPritibhoj.subtitle", { date: dateLabel })}
              center={<MessTabs />}
              actions={
                <Button
                  asChild
                  variant="cta"
                  size="sm"
                  className="h-10 gap-1.5 rounded-xl shadow-sm shadow-primary/20"
                >
                  <Link href="/mess/pritibhoj/print">
                    <IconPrinter className="h-4 w-4" />
                    {t("mess.print")}
                  </Link>
                </Button>
              }
            />
          </div>
        </div>

        <PritibhojSheets dateLocale={dateLocale} />
      </motion.div>
    </PagePane>
  );
}
