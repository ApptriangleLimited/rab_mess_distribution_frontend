"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";
import { PritibhojSheets } from "@/components/mess/pritibhoj-sheets";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import { usePritibhojEvent } from "@/hooks/use-pritibhoj-event";
import { useStore } from "@/hooks/use-store";
import { formatDateLong } from "@/lib/date";
import { printLetterElement } from "@/lib/print-letter-pdf";
import { useI18n, useT } from "@/i18n/provider";

export default function MessPritibhojPrintPage() {
  const t = useT();
  const { locale } = useI18n();
  const params = useParams<{ id: string }>();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const { event, loading } = usePritibhojEvent(params.id);
  useStore();
  const dateLocale = locale === "bn" ? "bn-BD" : "en-GB";
  const pdfName = event ? `pritibhoj-${event.date}.pdf` : "pritibhoj.pdf";

  if (loading && !event) {
    return <PagePane className="gap-4" />;
  }

  if (!event) {
    return (
      <PagePane className="gap-4">
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

  async function onPrint() {
    const el = printRef.current;
    if (!el || printing) return;
    setPrinting(true);
    try {
      await printLetterElement(el, pdfName, "landscape", {
        preserveColors: true,
      });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <PagePane className="gap-4">
      <div className="no-print">
        <PageHeader
          title={t("pages.messPritibhojPreview.title")}
          subtitle={t("pages.messPritibhojPreview.subtitle", {
            date: formatDateLong(event.date, dateLocale),
          })}
          leading={
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href={`/mess/pritibhoj/${event.id}`}>
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
              {printing ? t("common.loading") : t("paperReports.print")}
            </Button>
          }
        />
      </div>

      <div ref={printRef}>
        <PritibhojSheets event={event} dateLocale={dateLocale} />
      </div>
    </PagePane>
  );
}
