"use client";

import { useCallback, useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { MessTabs } from "@/components/layout/mess-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { useT } from "@/i18n/provider";
import { fetchGuestList, type GuestListItem } from "@/lib/api/mess-checker";
import { ApiClientError } from "@/lib/api/client";

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
  const [date, setDate] = useState(todayIso);
  const [branch, setBranch] = useState("");
  const [items, setItems] = useState<GuestListItem[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchGuestList(date, locked ? "" : branch);
      setItems(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : t("mess.checker.empty"));
    }
  }, [branch, date, locked, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const headers = [
    "#",
    t("mess.checker.colTime"),
    t("mess.checker.colShift"),
    t("mess.checker.colName"),
    t("mess.checker.colInfo"),
    t("mess.checker.colRef"),
    t("mess.checker.branch"),
  ];

  function printList() {
    const body = items
      .map(
        (row, index) =>
          `<tr><td>${index + 1}</td><td>${escapeHtml(row.check_in_time)}</td><td>${escapeHtml(row.shift_name)}</td><td>${escapeHtml(row.guest_name)}</td><td>${escapeHtml(row.guest_info)}</td><td>${escapeHtml(row.ref_info)}</td><td>${escapeHtml(row.branch_label)}</td></tr>`,
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
      <p>${escapeHtml(date)}</p>
      <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${body || `<tr><td colspan="7">${escapeHtml(t("mess.checker.empty"))}</td></tr>`}</tbody></table>
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
    doc.text(date, 14, 24);
    autoTable(doc, {
      startY: 30,
      head: [headers],
      body: items.length
        ? items.map((row, index) => [
            String(index + 1),
            row.check_in_time,
            row.shift_name,
            row.guest_name,
            row.guest_info,
            row.ref_info,
            row.branch_label,
          ])
        : [["", "", "", t("mess.checker.empty"), "", "", ""]],
    });
    doc.save(`guest-list-${date}.pdf`);
  }

  return (
    <div className="page-pane">
      <PageHeader
        title={t("nav.guestList")}
        subtitle={date}
        center={<MessTabs />}
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={printList}>
              {t("mess.checker.print")}
            </Button>
            <Button type="button" onClick={downloadPdf}>
              {t("mess.checker.pdf")}
            </Button>
          </div>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="date"
          className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        {locked ? null : (
          <select
            className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-600 dark:bg-neutral-900"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          >
            <option value="">{t("mess.checker.allBranches")}</option>
            <option value="hq">SRB HQ</option>
            <option value="haji">Haji Camp</option>
          </select>
        )}
      </div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
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
            {items.length ? (
              items.map((row, index) => (
                <tr key={row.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2">{index + 1}</td>
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
                <td className="px-3 py-6 text-neutral-500" colSpan={7}>
                  {t("mess.checker.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
