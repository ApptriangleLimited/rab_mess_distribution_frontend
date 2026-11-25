"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, useReducedMotion } from "motion/react";
import { IconDownload, IconPrinter } from "@tabler/icons-react";
import { MessTabs } from "@/components/layout/mess-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { useT } from "@/i18n/provider";
import { fetchGuestList, type GuestListItem } from "@/lib/api/mess-checker";
import { apiJson, ApiClientError } from "@/lib/api/client";
import { mealShiftLabel } from "@/lib/store/meal-shifts";

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function GuestListPage() {
  const t = useT();
  const { session } = useSession();
  const locked = session?.role === "mess_checker";
  const reduceMotion = useReducedMotion();
  const [dateFrom, setDateFrom] = useState(todayIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("all");
  const [shift, setShift] = useState("all");
  const [catalog, setCatalog] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<GuestListItem[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchGuestList(
        dateFrom,
        locked || branch === "all" ? "" : branch,
        dateTo,
      );
      setItems(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : t("mess.checker.empty"));
    }
  }, [branch, dateFrom, dateTo, locked, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    apiJson<{ id: string; name: string }[]>("/api/v1/meal-shifts")
      .then((rows) => setCatalog(Array.isArray(rows) ? rows : []))
      .catch(() => setCatalog([]));
  }, []);

  const shifts = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of items) {
      if (row.shift_id) map.set(row.shift_id, row.shift_name || row.shift_id);
    }
    return [...map.entries()];
  }, [items]);

  const shiftOptions = useMemo(() => {
    const source = catalog.length
      ? catalog.map((row) => [row.id, row.name] as const)
      : shifts;
    return source.map(([id, name]) => [id, mealShiftLabel(id, name, t)] as const);
  }, [catalog, shifts, t]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((row) => {
      if (shift !== "all" && row.shift_id !== shift) return false;
      if (!needle) return true;
      return [
        row.date,
        row.check_in_time,
        row.shift_name,
        row.guest_name,
        row.guest_info,
        row.ref_info,
        row.branch_label,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [items, query, shift]);

  const rangeLabel = dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`;
  const filtersDirty =
    dateFrom !== todayIso() ||
    dateTo !== todayIso() ||
    query.trim() !== "" ||
    shift !== "all" ||
    (!locked && branch !== "all");

  const headers = [
    "#",
    t("mess.checker.colDate"),
    t("mess.checker.colTime"),
    t("mess.checker.colShift"),
    t("mess.checker.colName"),
    t("mess.checker.colInfo"),
    t("mess.checker.colRef"),
    t("mess.checker.branch"),
  ];

  function printList() {
    const body = visible
      .map(
        (row, index) =>
          `<tr><td>${index + 1}</td><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.check_in_time)}</td><td>${escapeHtml(row.shift_name)}</td><td>${escapeHtml(row.guest_name)}</td><td>${escapeHtml(row.guest_info)}</td><td>${escapeHtml(row.ref_info)}</td><td>${escapeHtml(row.branch_label)}</td></tr>`,
      )
      .join("");
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const view = frame.contentWindow;
    if (!doc || !view) {
      frame.remove();
      return;
    }
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>${escapeHtml(t("nav.guestList"))}</title>
      <style>
        body { font-family: sans-serif; color: #111; }
        h1 { font-size: 18px; text-align: center; }
        p { text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; font-size: 12px; }
        th { background: #111; color: #fff; }
      </style></head><body>
      <h1>${escapeHtml(t("nav.guestList"))}</h1>
      <p>${escapeHtml(rangeLabel)}</p>
      <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${body || `<tr><td colspan="8">${escapeHtml(t("mess.checker.empty"))}</td></tr>`}</tbody></table>
      </body></html>`);
    doc.close();
    view.addEventListener("afterprint", () => frame.remove(), { once: true });
    window.setTimeout(() => {
      view.focus();
      view.print();
    }, 250);
  }

  function downloadPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(t("nav.guestList"), 14, 16);
    doc.setFontSize(11);
    doc.text(rangeLabel, 14, 24);
    autoTable(doc, {
      startY: 30,
      head: [headers],
      body: visible.length
        ? visible.map((row, index) => [
            String(index + 1),
            row.date,
            row.check_in_time,
            row.shift_name,
            row.guest_name,
            row.guest_info,
            row.ref_info,
            row.branch_label,
          ])
        : [["", "", "", "", t("mess.checker.empty"), "", "", ""]],
    });
    doc.save(`guest-list-${dateFrom}${dateTo === dateFrom ? "" : `-to-${dateTo}`}.pdf`);
  }

  const actionBtn =
    "h-10 shrink-0 rounded-xl px-3";

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-emerald-50/50 to-sky-50/60 p-4 shadow-[0_10px_40px_-24px_rgba(6,121,87,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
        <div className="relative">
          <PageHeader
            title={t("nav.guestList")}
            subtitle={rangeLabel}
            center={<MessTabs />}
            actions={
              <div className="flex gap-2">
                <Button type="button" variant="outline" className={actionBtn} onClick={printList}>
                  <IconPrinter className="h-4 w-4" />
                  {t("mess.checker.print")}
                </Button>
                <Button type="button" variant="cta" className={actionBtn} onClick={downloadPdf}>
                  <IconDownload className="h-4 w-4" />
                  {t("mess.checker.pdf")}
                </Button>
              </div>
            }
          />
        </div>
      </div>
      <div className={`grid gap-3 rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white via-sky-50/70 to-amber-50/60 p-3 sm:grid-cols-2 dark:border-sky-900/50 dark:from-neutral-950 dark:via-sky-950/20 dark:to-amber-950/20 ${locked ? "lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]" : "lg:grid-cols-[1fr_1fr_1fr_1fr_1.4fr_auto]"}`}>
        {locked ? null : (
          <FilterField label={t("mess.dashboard.branch")}>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="h-10 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("mess.dashboard.allBranches")}</SelectItem>
                <SelectItem value="hq">{t("mess.dashboard.messHq")}</SelectItem>
                <SelectItem value="haji">{t("mess.dashboard.messHaji")}</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        )}
        <FilterField label={t("mess.dashboard.shift")}>
          <Select value={shift} onValueChange={setShift}>
            <SelectTrigger className="h-10 w-full rounded-xl">
              <SelectValue placeholder={t("mess.dashboard.allShifts")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("mess.dashboard.allShifts")}</SelectItem>
              {shiftOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t("mess.dashboard.fromDate")}>
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-10 rounded-xl"
          />
        </FilterField>
        <FilterField label={t("mess.dashboard.toDate")}>
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-10 rounded-xl"
          />
        </FilterField>
        <FilterField label={t("common.search")}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("mess.checker.searchPlaceholder")}
            className="h-10 rounded-xl"
          />
        </FilterField>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl"
            disabled={!filtersDirty}
            onClick={() => {
              const today = todayIso();
              setDateFrom(today);
              setDateTo(today);
              setQuery("");
              setShift("all");
              setBranch("all");
            }}
          >
            {t("mess.dashboard.clearFilters")}
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-neutral-950 text-left text-white">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((row, index) => (
                <tr key={row.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2">{row.check_in_time}</td>
                  <td className="px-3 py-2">{row.shift_name}</td>
                  <td className="px-3 py-2">{row.guest_name}</td>
                  <td className="px-3 py-2">{row.guest_info || "—"}</td>
                  <td className="px-3 py-2">{row.ref_info || "—"}</td>
                  <td className="px-3 py-2">{row.branch_label}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-6 text-neutral-500" colSpan={8}>
                  {t("mess.checker.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </motion.div>
    </PagePane>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
