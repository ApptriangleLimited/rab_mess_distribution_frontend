"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { PritibhojSheets } from "@/components/mess/pritibhoj-sheets";
import { Button } from "@/components/ui/button";
import { formatDateLong } from "@/lib/date";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { PRITIBHOJ_DEMO_META } from "@/lib/pritibhoj-demo";
import { useI18n, useT } from "@/i18n/provider";

export default function MessPritibhojPrintClient() {
  const t = useT();
  const { locale } = useI18n();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";
  const dateLabel = formatDateLong(PRITIBHOJ_DEMO_META.dateISO, dateLocale);

  async function onPrint() {
    const el = printRef.current;
    if (!el || printing) return;
    setPrinting(true);
    try {
      await printLetterElement(
        el,
        `pritibhoj-${PRITIBHOJ_DEMO_META.dateISO}.pdf`,
        "landscape",
      );
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("pages.messPritibhoj.title")}
          subtitle={t("pages.messPritibhoj.subtitle", { date: dateLabel })}
          leading={
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href="/mess/pritibhoj">
                <IconArrowLeft className="h-4 w-4" />
                {t("common.back")}
              </Link>
            </Button>
          }
          actions={
            <Button
              type="button"
              variant="cta"
              size="sm"
              className="rounded-xl"
              disabled={printing}
              onClick={() => void onPrint()}
            >
              <IconPrinter className="h-4 w-4" />
              {printing ? t("common.loading") : t("mess.print")}
            </Button>
          }
        />
      </div>

      <div ref={printRef}>
        <PritibhojSheets dateLocale={dateLocale} />
      </div>
    </PagePane>
  );
}
