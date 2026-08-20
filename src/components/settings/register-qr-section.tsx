"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  IconDownload,
  IconPrinter,
  IconQrcode,
} from "@tabler/icons-react";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import { useT } from "@/i18n/provider";

/** Settings QR → public /register URL for member entry (not staff login). */
export function RegisterQrSection({
  static: staticPanel = false,
}: {
  static?: boolean;
} = {}) {
  const t = useT();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = `${window.location.origin}/register`;
    setUrl(next);
    let cancelled = false;
    QRCode.toDataURL(next, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
      .then((png) => {
        if (!cancelled) setDataUrl(png);
      })
      .catch(() => {
        if (!cancelled) toast(t("settings.registerQrError"), "error");
      });
    return () => {
      cancelled = true;
    };
  }, [t, toast]);

  function onDownload() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "mess-member-register-qr.png";
    a.click();
    toast(t("settings.registerQrDownloaded"), "success");
  }

  function onPrint() {
    if (!dataUrl || !printRef.current) return;
    const win = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
    if (!win) {
      toast(t("settings.registerQrPrintBlocked"), "error");
      return;
    }
    const title = t("settings.registerQrPrintTitle");
    const hint = t("settings.registerQrPrintHint");
    win.document.write(`<!doctype html><html><head><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;padding:32px;text-align:center;color:#111}
  h1{font-size:18px;margin:0 0 8px}
  p{font-size:12px;color:#555;margin:0 0 20px}
  img{width:280px;height:280px}
  .url{margin-top:16px;font-size:11px;word-break:break-all;color:#333}
  @media print{body{padding:16px}}
</style></head><body>
  <h1>${title}</h1>
  <p>${hint}</p>
  <img src="${dataUrl}" alt="QR" />
  <p class="url">${url}</p>
</body></html>`);
    win.document.close();
    win.focus();
    win.onload = () => {
      win.print();
    };
  }

  return (
    <CollapsibleSection
      icon={IconQrcode}
      title={t("settings.registerQr")}
      hint={t("settings.registerQrHint")}
      static={staticPanel}
      defaultOpen={staticPanel}
      headerActions={
        <div className="flex shrink-0 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={!dataUrl}
            onClick={onDownload}
          >
            <IconDownload className="h-3.5 w-3.5" />
            {t("settings.registerQrDownload")}
          </Button>
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="rounded-lg"
            disabled={!dataUrl}
            onClick={onPrint}
          >
            <IconPrinter className="h-3.5 w-3.5" />
            {t("settings.registerQrPrint")}
          </Button>
        </div>
      }
    >
      <div
        ref={printRef}
        className="flex flex-col items-center gap-3 px-3 py-4 sm:flex-row sm:items-start sm:gap-5 sm:px-4"
      >
        <div className="flex h-[168px] w-[168px] shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-700">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt={t("settings.registerQr")}
              className="h-full w-full"
            />
          ) : (
            <span className="text-xs text-neutral-400">
              {t("common.loadingShell")}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 text-center sm:pt-1 sm:text-left">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">
            {t("settings.registerQrScan")}
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-neutral-500">
            {url || "…"}
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
}
