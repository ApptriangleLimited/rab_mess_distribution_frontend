"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconDownload,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/provider";
import { printLetterElement } from "@/lib/print-letter-pdf";
import {
  addPritibhojMember,
  editPritibhojMember,
  excludePritibhojMember,
  isFormulaPritibhojColumn,
  isManualPritibhojColumn,
  pritibhojAddBuckets,
  readPritibhojCell,
} from "@/lib/pritibhoj-roster";
import {
  memberFitsPritibhojBucket,
  pritibhojBucketsHolding,
  pritibhojColumnMembers,
  pritibhojSheetColumnMembers,
  type PritibhojCountCtx,
} from "@/lib/store/pritibhoj-counts";
import type {
  PritibhojBucket,
  PritibhojColumn,
  PritibhojRoster,
  PritibhojRow,
  PritibhojSheetId,
  User,
} from "@/lib/types";

function bnDigits(n: number) {
  return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const body = [header, ...rows]
    .map((line) => line.map(csvCell).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function columnLabel(
  t: ReturnType<typeof useT>,
  column: PritibhojColumn,
) {
  switch (column) {
    case "officer":
      return t("mess.pritibhoj.officer");
    case "dad":
      return t("mess.pritibhoj.dad");
    case "azadHall":
      return t("mess.pritibhoj.azadHall");
    case "distribution":
      return t("mess.pritibhoj.distribution");
    case "others":
      return t("mess.pritibhoj.others");
    case "civilian":
      return t("mess.pritibhoj.civilian");
    case "nonMuslim":
      return t("mess.pritibhoj.nonMuslim");
    case "total":
      return t("mess.pritibhoj.total");
    case "azadHallDist":
      return t("mess.pritibhoj.azadHallDist");
    case "distribution2":
      return t("mess.pritibhoj.distribution2");
    case "totalDistribution":
      return t("mess.pritibhoj.totalDistribution");
  }
}

function shownText(
  user: User,
  roster: PritibhojRoster | undefined,
  sheet: PritibhojSheetId,
  wing: string,
  buckets: PritibhojBucket[],
) {
  for (const bucket of buckets) {
    const edit = readPritibhojCell(roster, sheet, wing, bucket).edits[user.id];
    if (!edit) continue;
    return {
      name: edit.name?.trim() || user.name,
      phone: edit.phone?.trim() || user.phone,
    };
  }
  return { name: user.name, phone: user.phone || "" };
}

export function PritibhojMemberDialog({
  sheet,
  wing,
  column,
  rows,
  sheetCount,
  date,
  ctx,
  roster,
  onClose,
  onRoster,
}: {
  sheet: PritibhojSheetId;
  wing: string;
  column: PritibhojColumn;
  rows: PritibhojRow[];
  sheetCount: number;
  date: string;
  ctx: PritibhojCountCtx;
  roster: PritibhojRoster | undefined;
  onClose: () => void;
  onRoster: (next: PritibhojRoster) => Promise<void>;
}) {
  const t = useT();
  const printRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const addBuckets = pritibhojAddBuckets(column);
  const [addBucket, setAddBucket] = useState<PritibhojBucket>(addBuckets[0]!);
  const [addWing, setAddWing] = useState(
    wing === "*" ? (rows[0]?.wing ?? "") : wing,
  );
  const wingKey = rows.map((row) => row.wing).join("|");

  useEffect(() => {
    setQuery("");
    setAddQuery("");
    setEditing(null);
    setAddBucket(pritibhojAddBuckets(column)[0]!);
    setAddWing(wing === "*" ? wingKey.split("|")[0] ?? "" : wing);
  }, [column, wing, sheet, wingKey]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);

  const members = useMemo(() => {
    if (wing === "*") {
      return pritibhojSheetColumnMembers(date, rows, column, ctx, roster, sheet);
    }
    return pritibhojColumnMembers(date, wing, column, ctx, roster, sheet);
  }, [column, ctx, date, roster, rows, sheet, wing]);

  function wingOf(memberId: string) {
    if (wing !== "*") return wing;
    for (const row of rows) {
      const hit = pritibhojColumnMembers(
        date,
        row.wing,
        column,
        ctx,
        roster,
        sheet,
      ).some((user) => user.id === memberId);
      if (hit) return row.wing;
    }
    return rows[0]?.wing ?? "";
  }

  function textOf(user: User) {
    return shownText(user, roster, sheet, wingOf(user.id), addBuckets);
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? members.filter((user) => {
        const text = textOf(user);
        return [text.name, text.phone, user.rab_id, user.personal_id]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
    : members;

  const listed = useMemo(() => new Set(members.map((user) => user.id)), [members]);
  const candidates = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    return ctx.users
      .filter((user) => memberFitsPritibhojBucket(user, addBucket))
      .filter((user) => !listed.has(user.id))
      .filter((user) => {
        if (!q) return true;
        return [user.name, user.phone, user.rab_id, user.personal_id]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 30);
  }, [addBucket, addQuery, ctx.users, listed]);

  async function commit(next: PritibhojRoster) {
    setBusy(true);
    try {
      await onRoster(next);
      setEditing(null);
      setAddQuery("");
    } catch {
      // The save hook already reports the error.
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(user: User) {
    const home = wingOf(user.id);
    const wings = wing === "*" ? rows.map((row) => row.wing) : [home];
    let next = roster ?? {};
    for (const rowWing of wings) {
      const holding = pritibhojBucketsHolding(
        date,
        rowWing,
        ctx,
        next,
        sheet,
        user.id,
        addBuckets,
      );
      for (const bucket of holding) {
        next = excludePritibhojMember(next, sheet, rowWing, bucket, user.id);
      }
    }
    await commit(next);
  }

  async function onAdd(user: User) {
    if (!addWing) return;
    await commit(addPritibhojMember(roster, sheet, addWing, addBucket, user.id));
  }

  function startEdit(user: User) {
    const text = textOf(user);
    setEditing(user);
    setNameDraft(text.name);
    setPhoneDraft(text.phone);
  }

  async function saveEdit() {
    if (!editing) return;
    const home = wingOf(editing.id);
    const holding = pritibhojBucketsHolding(
      date,
      home,
      ctx,
      roster,
      sheet,
      editing.id,
      addBuckets,
    );
    const targets = holding.length > 0 ? holding : addBuckets.slice(0, 1);
    const name =
      nameDraft.trim() === editing.name.trim() ? "" : nameDraft.trim();
    const phone =
      phoneDraft.trim() === (editing.phone || "").trim()
        ? ""
        : phoneDraft.trim();
    let next = roster ?? {};
    for (const bucket of targets) {
      next = editPritibhojMember(next, sheet, home, bucket, editing.id, {
        name,
        phone,
      });
    }
    await commit(next);
  }

  function onDownload() {
    const header = [
      t("cc.fields.sl"),
      t("cc.fields.rabId"),
      t("mess.pritibhoj.membersPersonalId"),
      t("cc.fields.name"),
      t("mess.pritibhoj.membersPhone"),
    ];
    const body = members.map((user, index) => {
      const text = textOf(user);
      return [
        String(index + 1),
        user.rab_id,
        user.personal_id,
        text.name,
        text.phone,
      ];
    });
    const stem = `pritibhoj-${column}`.replace(/[^\w.-]+/g, "-");
    downloadCsv(`${stem}.csv`, header, body);
  }

  async function onPrint() {
    const el = printRef.current;
    if (!el || printing) return;
    setPrinting(true);
    try {
      await printLetterElement(el, `pritibhoj-${column}.pdf`, "portrait");
    } finally {
      setPrinting(false);
    }
  }

  const title = t("mess.pritibhoj.membersTitle", {
    column: columnLabel(t, column),
    wing: wing === "*" ? t("mess.pritibhoj.membersAllWings") : wing,
  });
  const manualEmpty =
    isManualPritibhojColumn(column) &&
    members.length === 0 &&
    (wing === "*"
      ? true
      : readPritibhojCell(
          roster,
          sheet,
          wing,
          column as PritibhojBucket,
        ).managed !== true);

  const tableHead = (
    <tr className="bg-neutral-100 text-left text-xs dark:bg-neutral-800">
      <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
        {t("cc.fields.sl")}
      </th>
      <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
        {t("cc.fields.rabId")}
      </th>
      <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
        {t("mess.pritibhoj.membersPersonalId")}
      </th>
      <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
        {t("cc.fields.name")}
      </th>
      <th className="border border-neutral-300 px-2 py-2 dark:border-neutral-600">
        {t("mess.pritibhoj.membersPhone")}
      </th>
    </tr>
  );

  function memberRows(list: User[], bangla: boolean) {
    return list.map((user, index) => {
      const text = textOf(user);
      return (
        <tr key={user.id}>
          <td className="border border-neutral-300 px-2 py-1.5 text-center tabular-nums dark:border-neutral-600">
            {bangla ? bnDigits(index + 1) : index + 1}
          </td>
          <td className="border border-neutral-300 px-2 py-1.5 dark:border-neutral-600">
            {user.rab_id}
          </td>
          <td className="border border-neutral-300 px-2 py-1.5 dark:border-neutral-600">
            {user.personal_id}
          </td>
          <td className="border border-neutral-300 px-2 py-1.5 dark:border-neutral-600">
            {text.name}
          </td>
          <td className="border border-neutral-300 px-2 py-1.5 dark:border-neutral-600">
            {text.phone}
          </td>
        </tr>
      );
    });
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="no-print fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t("mess.pritibhoj.membersClose")}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {t("mess.pritibhoj.membersListed", { count: members.length })}
              {sheetCount !== members.length
                ? ` · ${t("mess.pritibhoj.membersCountDiff", {
                    sheet: sheetCount,
                    listed: members.length,
                  })}`
                : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-xl"
            onClick={onClose}
            disabled={busy}
          >
            <IconX className="h-4 w-4" />
            {t("mess.pritibhoj.membersClose")}
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {manualEmpty ? (
            <p className="text-xs text-neutral-500">
              {t("mess.pritibhoj.membersManualHint")}
            </p>
          ) : null}
          {isFormulaPritibhojColumn(column) ? (
            <p className="text-xs text-neutral-500">
              {t("mess.pritibhoj.membersFormulaHint")}
            </p>
          ) : null}

          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("mess.pritibhoj.membersSearch")}
              className="h-10 rounded-xl pl-9"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-neutral-100 text-left text-xs dark:bg-neutral-800">
                  <th className="border border-neutral-200 px-2 py-2 dark:border-neutral-700">
                    {t("cc.fields.sl")}
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 dark:border-neutral-700">
                    {t("cc.fields.rabId")}
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 dark:border-neutral-700">
                    {t("mess.pritibhoj.membersPersonalId")}
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 dark:border-neutral-700">
                    {t("cc.fields.name")}
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 dark:border-neutral-700">
                    {t("mess.pritibhoj.membersPhone")}
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 text-right dark:border-neutral-700">
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-sm text-neutral-500"
                    >
                      {t("mess.pritibhoj.membersEmpty")}
                    </td>
                  </tr>
                ) : (
                  filtered.map((user) => {
                    const text = textOf(user);
                    return (
                      <tr key={user.id} className="odd:bg-neutral-50/70 dark:odd:bg-neutral-900/40">
                        <td className="border border-neutral-200 px-2 py-1.5 text-center tabular-nums dark:border-neutral-700">
                          {bnDigits(members.indexOf(user) + 1)}
                        </td>
                        <td className="border border-neutral-200 px-2 py-1.5 dark:border-neutral-700">
                          {user.rab_id}
                        </td>
                        <td className="border border-neutral-200 px-2 py-1.5 dark:border-neutral-700">
                          {user.personal_id}
                        </td>
                        <td className="border border-neutral-200 px-2 py-1.5 dark:border-neutral-700">
                          {text.name}
                        </td>
                        <td className="border border-neutral-200 px-2 py-1.5 dark:border-neutral-700">
                          {text.phone}
                        </td>
                        <td className="border border-neutral-200 px-2 py-1.5 dark:border-neutral-700">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg"
                              disabled={busy}
                              onClick={() => startEdit(user)}
                            >
                              <IconPencil className="h-3.5 w-3.5" />
                              {t("common.edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg text-red-600"
                              disabled={busy}
                              onClick={() => void onDelete(user)}
                            >
                              <IconTrash className="h-3.5 w-3.5" />
                              {t("common.delete")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {editing ? (
            <div className="grid gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[1fr_1fr_auto] dark:border-neutral-800">
              <Input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder={t("cc.fields.name")}
                className="h-10 rounded-xl"
              />
              <Input
                value={phoneDraft}
                onChange={(event) => setPhoneDraft(event.target.value)}
                placeholder={t("mess.pritibhoj.membersPhone")}
                className="h-10 rounded-xl"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="cta"
                  size="sm"
                  className="h-10 rounded-xl"
                  disabled={busy}
                  onClick={() => void saveEdit()}
                >
                  {busy ? t("common.saving") : t("common.save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-xl"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
            <p className="mb-2 text-sm font-medium">{t("mess.pritibhoj.membersAdd")}</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {wing === "*" ? (
                <select
                  aria-label={t("mess.pritibhoj.membersPickWing")}
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={addWing}
                  onChange={(event) => setAddWing(event.target.value)}
                >
                  {rows.map((row) => (
                    <option key={row.wing} value={row.wing}>
                      {row.wing}
                    </option>
                  ))}
                </select>
              ) : null}
              {addBuckets.length > 1 ? (
                <select
                  aria-label={t("mess.pritibhoj.membersPickBucket")}
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={addBucket}
                  onChange={(event) =>
                    setAddBucket(event.target.value as PritibhojBucket)
                  }
                >
                  {addBuckets.map((bucket) => (
                    <option key={bucket} value={bucket}>
                      {columnLabel(t, bucket)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="relative mb-2">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={addQuery}
                onChange={(event) => setAddQuery(event.target.value)}
                placeholder={t("mess.pritibhoj.membersAddSearch")}
                className="h-10 rounded-xl pl-9"
              />
            </div>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {candidates.length === 0 ? (
                <li className="px-1 py-2 text-xs text-neutral-500">
                  {t("mess.pritibhoj.membersNoMatch")}
                </li>
              ) : (
                candidates.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      disabled={busy || !addWing}
                      onClick={() => void onAdd(user)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-900"
                    >
                      <span>
                        {user.name}
                        <span className="ml-2 text-xs text-neutral-500">
                          {user.rab_id || user.personal_id}
                        </span>
                      </span>
                      <IconPlus className="h-4 w-4 shrink-0" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-xl"
            onClick={onDownload}
          >
            <IconDownload className="h-4 w-4" />
            {t("common.download")}
          </Button>
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="h-10 rounded-xl"
            disabled={printing}
            onClick={() => void onPrint()}
          >
            <IconPrinter className="h-4 w-4" />
            {printing ? t("common.loading") : t("paperReports.print")}
          </Button>
        </div>

        <div ref={printRef} className="hidden">
          <h2 style={{ fontSize: "14px", marginBottom: "8px" }}>{title}</h2>
          <table className="w-full border-collapse text-sm">
            <thead>{tableHead}</thead>
            <tbody>{memberRows(members, true)}</tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  );
}
