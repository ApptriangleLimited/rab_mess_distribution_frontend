"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconActivity,
  IconAlertTriangle,
  IconArrowRight,
  IconDownload,
  IconPrinter,
  IconSearch,
  IconSoup,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PagePane } from "@/components/shared/page-pane";
import { MessPageTabs } from "@/components/layout/mess-tabs";
import { SettingsWingFilter } from "@/components/shared/settings-catalog-filters";
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
import { useStore } from "@/hooks/use-store";
import { isApiEnabled, isCcApiEnabled } from "@/lib/api/mode";
import { isOldPublicApiHost } from "@/lib/api/compat";
import {
  ledgerRowApiToLedgerRow,
  listMessLedger,
} from "@/lib/api/mess";
import {
  fetchMessCheckins,
  messCheckinMembers,
  type MessCheckinsData,
} from "@/lib/api/mess-checkins";
import { listPritibhojEventsApi } from "@/lib/api/pritibhoj";
import { MESS_LEDGER_TAGS } from "@/lib/constants";
import {
  fetchZkPunches,
  type ZkGateRow,
  type ZkGateStatus,
} from "@/lib/api/zk-gate";
import { playPunchStatus } from "@/lib/zk/punch-sound";
import { eachISODate, formatDateDisplay, nextISODate, todayISO } from "@/lib/date";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { buildRangeLedger, type LedgerRow } from "@/lib/reports";
import { listGuestMeals } from "@/lib/store/guest-meals";
import { listMealAssigns } from "@/lib/store/meal-assigns";
import { isCurrentShift, listMealShifts, mealShiftLabel } from "@/lib/store/meal-shifts";
import {
  formatMemberWing,
  isHqBranchName,
  memberFormWing,
  memberMatchesWingFilter,
  memberWingCascade,
} from "@/lib/store/org-options";
import {
  listPritibhojEvents,
  replaceLocalPritibhojEvents,
} from "@/lib/store/pritibhoj";
import { isCivilianMember } from "@/lib/store/users";
import type { GuestMeal, MealShiftId, PritibhojEvent, User } from "@/lib/types";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const BRANCH_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#f59e0b",
  "#8b5cf6",
  "#f43f5e",
  "#14b8a6",
  "#6366f1",
  "#fb7185",
];
const SHIFT_RING_COLOR = {
  breakfast: "#f97316",
  lunch: "#22c55e",
  dinner: "#a855f7",
} as const;

type PersonLine = {
  name: string;
  rabId: string;
  personalId: string;
  rank: string;
  wg: string;
  br: string;
  mess: string;
  sift: string;
  checkIn: string;
  status: string;
  sortKey: string;
};

const REPORT_TITLE = "Meal Assignments Report";

const REPORT_HEADERS = [
  "SL",
  "Personal ID",
  "SRB ID",
  "Rank",
  "Name",
  "Wg",
  "Br",
  "Mess",
  "Sift",
  "Check-in-Date-Time",
  "Status",
];

function generatedOnLabel(now = new Date()) {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `Generated on: ${date} at ${time}`;
}

function memberPlace(storedWing: string) {
  const cascade = memberWingCascade(storedWing);
  const branch =
    cascade.leaf || (cascade.sub && !isHqBranchName(cascade.sub) ? cascade.sub : "");
  return {
    wg: formatMemberWing(storedWing) || "—",
    br: branch || "—",
  };
}

function memberRank(user: User | undefined) {
  return (user?.force_rank || user?.rank || "").trim() || "—";
}

function checkInLabel(raw: string) {
  if (!raw.trim()) return "—";
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return raw;
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date}, ${time}`;
}

function reportCells(row: PersonLine, index: number) {
  return [
    String(index + 1),
    row.personalId || "—",
    row.rabId || "—",
    row.rank || "—",
    row.name || "—",
    row.wg || "—",
    row.br || "—",
    row.mess || "—",
    row.sift || "—",
    row.checkIn || "—",
    row.status || "—",
  ];
}

type BoardPunch = ZkGateRow & { mess: string };
type MessSite = "hq" | "haji";

function punchMessSite(mess: string | undefined): MessSite {
  const label = (mess || "SRB HQ").toLowerCase();
  if (label.includes("haji") || label.includes("hazz")) return "haji";
  return "hq";
}

function guestMessSite(row: GuestMeal): MessSite {
  const branch = String((row as GuestMeal & { branch?: string }).branch || "");
  if (!branch.trim()) return "hq";
  return punchMessSite(branch);
}

function personLine(
  user: User | undefined,
  fields: {
    name: string;
    rabId: string;
    status: string;
    sift: string;
    checkIn: string;
    sortKey: string;
    mess?: string;
  },
): PersonLine {
  const place = memberPlace(user?.wing ?? "");
  return {
    name: fields.name,
    rabId: user?.rab_id || fields.rabId,
    personalId: user?.personal_id || "",
    rank: memberRank(user),
    wg: place.wg,
    br: place.br,
    mess: fields.mess || "SRB HQ",
    sift: fields.sift || "—",
    checkIn: fields.checkIn || "—",
    status: fields.status,
    sortKey: fields.sortKey,
  };
}

type ListKind = "planned" | "accepted" | "duplicate" | "punches" | "guests" | "civilian";

function punchStatus(row: ZkGateRow): ZkGateStatus {
  if (
    row.status === "accepted" ||
    row.status === "already_accepted" ||
    row.status === "not_allowed" ||
    row.status === "rfid_not_found"
  ) {
    return row.status;
  }
  return row.allowed ? "accepted" : "not_allowed";
}

function downloadPeople(rows: PersonLine[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(17, 17, 17);
  doc.text(REPORT_TITLE, pageW / 2, 16, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(generatedOnLabel(), pageW / 2, 24, { align: "center" });
  autoTable(doc, {
    startY: 30,
    head: [REPORT_HEADERS],
    body: rows.map((row, index) => reportCells(row, index)),
    styles: {
      fontSize: 8,
      cellPadding: 1.6,
      halign: "center",
      valign: "middle",
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [32, 32, 32],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: { 0: { cellWidth: 12 } },
    margin: { left: 8, right: 8 },
  });
  doc.save("meal-assignments-report.pdf");
}

function printPeople(rows: PersonLine[]) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const view = frame.contentWindow;
  if (!doc || !view) {
    frame.remove();
    return;
  }
  const body = rows
    .map((row, index) => `<tr>${reportCells(row, index).map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><title>${escapeHtml(REPORT_TITLE)}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: sans-serif; color: #111; }
      h1 { font-size: 22px; margin: 0 0 6px; text-align: center; }
      p { font-size: 14px; margin: 0 0 12px; text-align: center; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 4px 5px; text-align: center; font-size: 10px; }
      th { background: #202020; color: #fff; }
    </style></head><body>
    <h1>${escapeHtml(REPORT_TITLE)}</h1>
    <p>${escapeHtml(generatedOnLabel())}</p>
    <table><thead><tr>${REPORT_HEADERS.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${body || `<tr><td colspan="${REPORT_HEADERS.length}">—</td></tr>`}</tbody></table>
    </body></html>`);
  doc.close();
  view.addEventListener("afterprint", () => frame.remove(), { once: true });
  window.setTimeout(() => {
    view.focus();
    view.print();
  }, 250);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type ActivityRow = {
  id: string;
  name: string;
  code: string;
  personalId: string;
  wing: string;
  shiftId: MealShiftId;
  time: string;
  kind: "consumption" | "duplicate" | "guest" | "group" | "not_allowed";
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function avatarTone(seed: string) {
  const tones = [
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
    "bg-sky-100 text-sky-700",
    "bg-amber-100 text-amber-800",
    "bg-rose-100 text-rose-700",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h + seed.charCodeAt(i)) % tones.length;
  return tones[h]!;
}

function formatStamp(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(locale, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date}, ${time}`;
}

function ringArc(consumed: number, planned: number, radius: number) {
  const length = 2 * Math.PI * radius;
  const ratio = planned > 0 ? Math.min(1, consumed / planned) : 0;
  const filled = length * ratio;
  const gap = 1 - ratio;
  const start = 90 + gap * 180;
  return { length, filled, start };
}

function MealRings({
  shift,
  breakfast,
  lunch,
  dinner,
  planned,
  labels,
}: {
  shift: MealShiftId | "all";
  breakfast: number;
  lunch: number;
  dinner: number;
  planned: number;
  labels: { breakfast: string; lunch: string; dinner: string };
}) {
  const counts = { breakfast, lunch, dinner };
  const selected =
    shift === "breakfast" || shift === "lunch" || shift === "dinner" ? shift : null;

  if (selected) {
    const consumed = counts[selected];
    const arc = ringArc(consumed, planned, 46);
    return (
      <div className="flex h-full w-full flex-col px-1 pb-1 pt-2">
        <div className="flex flex-1 items-center justify-center">
          <svg viewBox="0 0 200 200" className="h-60 w-60" role="img" aria-label={`${consumed}/${planned}`}>
            <circle cx="100" cy="100" r="46" fill="none" stroke="#eceff3" strokeWidth="14" />
            {arc.filled > 0 ? (
              <circle
                cx="100"
                cy="100"
                r="46"
                fill="none"
                stroke={SHIFT_RING_COLOR[selected]}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${arc.filled} ${arc.length - arc.filled}`}
                transform={`rotate(${arc.start} 100 100)`}
              />
            ) : null}
            <text
              x="100"
              y="106"
              textAnchor="middle"
              className="fill-neutral-800 dark:fill-neutral-100"
              style={{ fontSize: 16, fontWeight: 650 }}
            >
              {consumed}/{planned}
            </text>
          </svg>
        </div>
        <div>
          <span
            className="inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: SHIFT_RING_COLOR[selected] }}
          >
            {labels[selected]}
          </span>
        </div>
      </div>
    );
  }

  const rings = [
    { key: "dinner" as const, consumed: dinner, r: 78 },
    { key: "lunch" as const, consumed: lunch, r: 58 },
    { key: "breakfast" as const, consumed: breakfast, r: 38 },
  ];
  const total = breakfast + lunch + dinner;
  const capacity = planned * 3;
  const pills = [
    { key: "breakfast" as const, label: labels.breakfast, color: SHIFT_RING_COLOR.breakfast },
    { key: "lunch" as const, label: labels.lunch, color: SHIFT_RING_COLOR.lunch },
    { key: "dinner" as const, label: labels.dinner, color: SHIFT_RING_COLOR.dinner },
  ];
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-2 py-2">
      <svg viewBox="0 0 200 200" className="h-60 w-60" role="img" aria-label={`${total}/${capacity}`}>
        {rings.map((ring) => {
          const length = 2 * Math.PI * ring.r;
          const ratio = planned > 0 ? Math.min(1, ring.consumed / planned) : 0;
          const filled = length * ratio;
          return (
            <g key={ring.key}>
              <circle
                cx="100"
                cy="100"
                r={ring.r}
                fill="none"
                stroke="#eceff3"
                strokeWidth="12"
              />
              {filled > 0 ? (
                <circle
                  cx="100"
                  cy="100"
                  r={ring.r}
                  fill="none"
                  stroke={SHIFT_RING_COLOR[ring.key]}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${filled} ${length - filled}`}
                  transform="rotate(180 100 100)"
                />
              ) : null}
            </g>
          );
        })}
        <text
          x="100"
          y="106"
          textAnchor="middle"
          className="fill-neutral-800 dark:fill-neutral-100"
          style={{ fontSize: 16, fontWeight: 650 }}
        >
          {total}/{capacity}
        </text>
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {pills.map((pill) => (
          <span
            key={pill.key}
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: pill.color }}
          >
            {pill.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function MessDashboardClient({
  embedded = false,
  pulse = false,
}: {
  embedded?: boolean;
  pulse?: boolean;
}) {
  const t = useT();
  const { locale } = useI18n();
  const { session } = useSession();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const apiOn = isApiEnabled();
  const dateLocale = locale === "bn" ? "bn-BD" : "en-US";
  const today = todayISO();
  const tomorrow = nextISODate(today);

  const [wing, setWing] = useState("all");
  const [shift, setShift] = useState<MealShiftId | "all">("all");
  const [messBranch, setMessBranch] = useState<MessSite | "all">("all");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [apiData, setApiData] = useState<MessCheckinsData | null>(null);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [apiEvents, setApiEvents] = useState<PritibhojEvent[] | null>(null);
  const [rangePunches, setRangePunches] = useState<BoardPunch[]>([]);
  const heardPunch = useRef("");
  const [openList, setOpenList] = useState<ListKind | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const shiftPinned = useRef(false);

  const range = useMemo(() => {
    return dateFrom <= dateTo
      ? { from: dateFrom, to: dateTo }
      : { from: dateTo, to: dateFrom };
  }, [dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    if (!apiOn) {
      setApiData(null);
      setLedgerRows([]);
    } else {
      void Promise.all([
        fetchMessCheckins(range.from, range.to).catch(() => null),
        listMessLedger(range.from, range.to).catch(() => null),
      ]).then(([checkins, ledger]) => {
        if (cancelled) return;
        setApiData(checkins);
        setLedgerRows(ledger ? ledger.rows.map(ledgerRowApiToLedgerRow) : []);
      });
    }

    if (!isCcApiEnabled() || isOldPublicApiHost()) {
      setApiEvents(null);
    } else {
      void listPritibhojEventsApi()
        .then((rows) => {
          if (cancelled) return;
          const live = rows.filter((row) => !String(row.id).startsWith("pb_demo_"));
          replaceLocalPritibhojEvents(live);
          setApiEvents(live);
        })
        .catch(() => {
          if (!cancelled) setApiEvents([]);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [apiOn, range.from, range.to, reloadTick]);

  useEffect(() => {
    if (!apiOn) {
      setRangePunches([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void fetchZkPunches(range.from, range.to)
        .then((data) => {
          if (cancelled) return;
          setRangePunches(
            (data.rows ?? []).map((row) => ({
              ...row,
              mess: row.mess || "SRB HQ",
            })),
          );
        })
        .catch(() => {
          if (!cancelled) setRangePunches([]);
        });
    };
    load();
    const timer = window.setInterval(load, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [apiOn, range.from, range.to, reloadTick]);

  useEffect(() => {
    if (rangePunches.length === 0) return;
    const newest = rangePunches.reduce((best, row) =>
      (row.punched_at || "") > (best.punched_at || "") ? row : best,
    );
    const key = `${newest.mess}|${newest.rab_id}|${newest.punched_at}|${newest.status}`;
    if (!heardPunch.current) {
      heardPunch.current = key;
      return;
    }
    if (heardPunch.current === key) return;
    heardPunch.current = key;
    playPunchStatus(punchStatus(newest));
  }, [rangePunches]);

  const shifts = useMemo(
    () => listMealShifts(),
    [state.meal_shifts],
  );
  const [shiftClock, setShiftClock] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setShiftClock((n) => n + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const runningShift = useMemo(() => {
    void shiftClock;
    return shifts.find((row) => isCurrentShift(row))?.id ?? "all";
  }, [shifts, shiftClock]);
  useEffect(() => {
    if (!shiftPinned.current) setShift(runningShift);
  }, [runningShift]);

  const members = useMemo(() => {
    if (apiData?.members?.length) return messCheckinMembers(apiData);
    return state.users;
  }, [apiData, state.users]);

  const memberById = useMemo(() => {
    const map = new Map<string, User>();
    for (const user of members) map.set(user.id, user);
    return map;
  }, [members]);

  const assigns = useMemo(() => {
    const rows = apiData?.assigns ?? listMealAssigns();
    return rows.filter((row) => {
      if (row.date < range.from || row.date > range.to) return false;
      if (shift !== "all" && row.shift_id !== shift) return false;
      const user = memberById.get(row.member_id);
      if (wing !== "all" && !memberMatchesWingFilter(user?.wing ?? "", wing)) {
        return false;
      }
      return true;
    });
  }, [apiData, range, shift, wing, memberById, state.meal_assigns, state.wing_parent]);

  const guests = useMemo(() => {
    const rows = apiData?.guests ?? listGuestMeals();
    return rows.filter((row) => {
      if (row.date < range.from || row.date > range.to) return false;
      if (shift !== "all" && row.shift_id !== shift) return false;
      if (messBranch !== "all" && guestMessSite(row) !== messBranch) return false;
      return true;
    });
  }, [apiData, messBranch, range, shift, state.guest_meals]);

  const liveLedgerRows = useMemo(() => {
    if (apiOn) return ledgerRows;
    return buildRangeLedger(range.from, range.to, MESS_LEDGER_TAGS, {
      carry: true,
      previewFuture: true,
    }).rows;
  }, [
    apiOn,
    ledgerRows,
    range.from,
    range.to,
    state.assignments,
    state.users,
    state.suppressed_carries,
  ]);

  const filteredLedgerRows = useMemo(
    () =>
      liveLedgerRows.filter((row) =>
        memberMatchesWingFilter(row.user.wing, wing),
      ),
    [liveLedgerRows, wing, state.wing_parent],
  );

  const userByKey = useMemo(() => {
    const map = new Map<string, User>();
    const add = (user: User | undefined) => {
      if (!user) return;
      if (user.rab_id) map.set(user.rab_id, user);
      if (user.personal_id) map.set(user.personal_id, user);
    };
    for (const user of state.users) add(user);
    for (const user of members) add(user);
    for (const row of liveLedgerRows) add(row.user);
    return map;
  }, [liveLedgerRows, members, state.users]);

  const plannedLines = useMemo(() => {
    const dates = eachISODate(range.from, range.to);
    const lines: PersonLine[] = [];
    for (const row of filteredLedgerRows) {
      row.days.forEach((tag, index) => {
        if (tag !== "MS") return;
        const day = dates[index] ?? "";
        lines.push(
          personLine(row.user, {
            name: row.user.name,
            rabId: row.user.rab_id,
            status: "Planned",
            sift: "—",
            checkIn: day || "—",
            sortKey: `${day}-${row.user.name}`,
          }),
        );
      });
    }
    lines.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return lines;
  }, [filteredLedgerRows, range.from, range.to]);

  const deviceLines = useMemo(() => {
    const accepted: PersonLine[] = [];
    const duplicate: PersonLine[] = [];
    const rejected: PersonLine[] = [];
    for (const row of rangePunches) {
      const day = (row.punched_at || "").slice(0, 10);
      if (day < range.from || day > range.to) continue;
      const status = punchStatus(row);
      if (
        status !== "accepted" &&
        status !== "already_accepted" &&
        status !== "not_allowed"
      ) {
        continue;
      }
      if (shift !== "all" && row.shift_id !== shift) continue;
      if (messBranch !== "all" && punchMessSite(row.mess) !== messBranch) continue;
      const user = userByKey.get(row.rab_id);
      if (wing !== "all" && (!user || !memberMatchesWingFilter(user.wing, wing))) continue;
      const line = personLine(user, {
        name: user?.name || row.name,
        rabId: row.rab_id,
        status:
          status === "accepted"
            ? "Consumption"
            : status === "already_accepted"
              ? "Duplicate punch"
              : "Not allowed",
        sift: row.shift_id
          ? mealShiftLabel(row.shift_id, shifts.find((item) => item.id === row.shift_id)?.name ?? row.shift_name ?? row.shift_id, t)
          : "—",
        checkIn: checkInLabel(row.punched_at || ""),
        sortKey: row.punched_at || "",
        mess: row.mess,
      });
      if (status === "accepted") accepted.push(line);
      else if (status === "already_accepted") duplicate.push(line);
      else rejected.push(line);
    }
    return { accepted, duplicate, rejected };
  }, [messBranch, range.from, range.to, rangePunches, shift, shifts, t, userByKey, wing]);

  const todayPlanned = plannedLines.length;
  const todayAccepted = deviceLines.accepted.length;
  const todayDuplicate = deviceLines.duplicate.length;
  const shiftConsumed = useMemo(() => {
    const counts = { breakfast: 0, lunch: 0, dinner: 0 };
    for (const row of rangePunches) {
      const day = (row.punched_at || "").slice(0, 10);
      if (day < range.from || day > range.to) continue;
      if (messBranch !== "all" && punchMessSite(row.mess) !== messBranch) continue;
      if (punchStatus(row) !== "accepted") continue;
      const user = userByKey.get(row.rab_id);
      if (wing !== "all" && (!user || !memberMatchesWingFilter(user.wing, wing))) continue;
      const id = row.shift_id;
      if (id === "breakfast" || id === "lunch" || id === "dinner") counts[id] += 1;
    }
    return counts;
  }, [messBranch, range.from, range.to, rangePunches, userByKey, wing]);
  const siteBars = useMemo(() => {
    const counts = { hq: 0, haji: 0 };
    for (const row of rangePunches) {
      const day = (row.punched_at || "").slice(0, 10);
      if (day < range.from || day > range.to) continue;
      if (punchStatus(row) !== "accepted") continue;
      if (shift !== "all" && row.shift_id !== shift) continue;
      const user = userByKey.get(row.rab_id);
      if (wing !== "all" && (!user || !memberMatchesWingFilter(user.wing, wing))) continue;
      counts[punchMessSite(row.mess)] += 1;
    }
    return [
      { name: t("mess.dashboard.siteHq"), value: counts.hq },
      { name: t("mess.dashboard.siteHaji"), value: counts.haji },
    ];
  }, [range.from, range.to, rangePunches, shift, t, userByKey, wing]);
  const ringPlanned = useMemo(() => {
    let count = 0;
    for (const row of filteredLedgerRows) {
      for (const tag of row.days) {
        if (tag === "MS") count += 1;
      }
    }
    return count;
  }, [filteredLedgerRows]);
  const guestCount = guests.length;
  const pritibhojEvents = apiEvents ?? listPritibhojEvents();
  const guestLines = useMemo(() => {
    return guests
      .map((row) =>
        personLine(undefined, {
          name: row.guest_name || t("mess.dashboard.guestMeal"),
          rabId: row.ref_info || "—",
          status: "Guest",
          sift: mealShiftLabel(
            row.shift_id,
            shifts.find((item) => item.id === row.shift_id)?.name ?? row.shift_id,
            t,
          ),
          checkIn: checkInLabel(row.check_in_time || row.date),
          sortKey: row.check_in_time || row.date,
          mess: guestMessSite(row) === "haji" ? "Haji Camp" : "SRB HQ",
        }),
      )
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [guests, shifts, t]);
  const civilianLines = useMemo(() => {
    const lines: PersonLine[] = [];
    for (const row of rangePunches) {
      const day = (row.punched_at || "").slice(0, 10);
      if (day < range.from || day > range.to) continue;
      if (punchStatus(row) !== "accepted") continue;
      if (shift !== "all" && row.shift_id !== shift) continue;
      if (messBranch !== "all" && punchMessSite(row.mess) !== messBranch) continue;
      const user = userByKey.get(row.rab_id);
      if (!user || !isCivilianMember(user)) continue;
      if (wing !== "all" && !memberMatchesWingFilter(user.wing, wing)) continue;
      lines.push(
        personLine(user, {
          name: user.name || row.name,
          rabId: row.rab_id,
          status: "Consumption",
          sift: row.shift_id
            ? mealShiftLabel(
                row.shift_id,
                shifts.find((item) => item.id === row.shift_id)?.name ?? row.shift_name ?? row.shift_id,
                t,
              )
            : "—",
          checkIn: checkInLabel(row.punched_at || ""),
          sortKey: row.punched_at || "",
          mess: row.mess,
        }),
      );
    }
    lines.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return lines;
  }, [messBranch, range.from, range.to, rangePunches, shift, shifts, t, userByKey, wing]);

  const branchBars = useMemo(() => {
    const msCounts = new Map<string, number>();
    const civilCounts = new Map<string, number>();
    for (const row of filteredLedgerRows) {
      if (isCivilianMember(row.user)) continue;
      let ms = 0;
      for (const tag of row.days) {
        if (tag === "MS") ms += 1;
      }
      if (!ms) continue;
      const label =
        memberFormWing(row.user.wing) || t("mess.dashboard.unknownBranch");
      msCounts.set(label, (msCounts.get(label) ?? 0) + ms);
    }
    const dayCount = Math.max(1, eachISODate(range.from, range.to).length);
    for (const user of state.users) {
      if (user.approval_status !== "approved" || user.status !== "1") continue;
      if (!isCivilianMember(user)) continue;
      if (!memberMatchesWingFilter(user.wing, wing)) continue;
      const label =
        memberFormWing(user.wing) || t("mess.dashboard.unknownBranch");
      civilCounts.set(label, (civilCounts.get(label) ?? 0) + dayCount);
    }
    const bars = [...new Set([...msCounts.keys(), ...civilCounts.keys()])]
      .map((name) => {
        const ms = msCounts.get(name) ?? 0;
        const civilian = civilCounts.get(name) ?? 0;
        return { name, ms, civilian, total: ms + civilian };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((row, i) => ({
        ...row,
        fill: BRANCH_COLORS[i % BRANCH_COLORS.length]!,
      }));
    if (bars.length) return bars;
    return [
      {
        name: t("mess.dashboard.noBranch"),
        ms: 0,
        civilian: 0,
        total: 0,
        fill: BRANCH_COLORS[0]!,
      },
    ];
  }, [
    filteredLedgerRows,
    range.from,
    range.to,
    state.users,
    state.wing_parent,
    wing,
    t,
  ]);

  const activities = useMemo(() => {
    const rows: ActivityRow[] = [];
    for (const row of rangePunches) {
      const day = (row.punched_at || "").slice(0, 10);
      if (day < range.from || day > range.to) continue;
      const status = punchStatus(row);
      if (
        status !== "accepted" &&
        status !== "already_accepted" &&
        status !== "not_allowed"
      ) {
        continue;
      }
      if (shift !== "all" && row.shift_id !== shift) continue;
      if (messBranch !== "all" && punchMessSite(row.mess) !== messBranch) continue;
      const user = userByKey.get(row.rab_id);
      if (wing !== "all" && (!user || !memberMatchesWingFilter(user.wing, wing))) continue;
      rows.push({
        id: `${row.mess}-${row.rab_id}-${row.punched_at}`,
        name: user?.name || row.name || t("mess.dashboard.unknownMember"),
        code: user?.rab_id || row.rab_id,
        personalId: user?.personal_id || "",
        wing: memberFormWing(user?.wing ?? "") || "—",
        shiftId: row.shift_id || "lunch",
        time: (row.punched_at || "").replace(" ", "T"),
        kind:
          status === "accepted"
            ? "consumption"
            : status === "already_accepted"
              ? "duplicate"
              : "not_allowed",
      });
    }
    for (const row of guests) {
      rows.push({
        id: row.id,
        name: row.guest_name || t("mess.dashboard.guestMeal"),
        code: row.ref_info || row.guest_info || row.id,
        personalId: "",
        wing: t("mess.dashboard.guestMeal"),
        shiftId: row.shift_id,
        time: row.check_in_time,
        kind: "guest",
      });
    }
    for (const event of pritibhojEvents) {
      if (event.date < range.from || event.date > range.to) continue;
      rows.push({
        id: event.id,
        name: event.title || t("nav.pritibhoj"),
        code: event.occasion || event.org || event.id,
        personalId: "",
        wing: event.org || t("nav.pritibhoj"),
        shiftId: shifts[0]?.id ?? "lunch",
        time: event.date,
        kind: "group",
      });
    }
    rows.sort((a, b) => b.time.localeCompare(a.time));
    const query = search.trim().toLowerCase();
    return (query
      ? rows.filter((row) =>
          [row.name, row.code, row.personalId, row.wing]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : rows
    ).slice(0, 8);
  }, [guests, messBranch, pritibhojEvents, range, rangePunches, search, shift, shifts, state.wing_parent, t, userByKey, wing]);

  const rangeHint = range.from === range.to ? range.from : `${range.from} – ${range.to}`;

  const filtersDirty =
    wing !== "all" ||
    messBranch !== "all" ||
    shift !== runningShift ||
    dateFrom !== today ||
    dateTo !== today;

  function chooseShift(value: MealShiftId | "all") {
    shiftPinned.current = true;
    setShift(value);
  }

  function clearFilters() {
    shiftPinned.current = false;
    setWing("all");
    setMessBranch("all");
    setShift(runningShift);
    setDateFrom(today);
    setDateTo(today);
    setSearch("");
  }

  function refreshDashboard() {
    setReloadTick((n) => n + 1);
  }

  const shiftName = (id: MealShiftId) =>
    mealShiftLabel(id, shifts.find((s) => s.id === id)?.name ?? id, t);

  const listTitle =
    openList === "planned"
      ? t("mess.dashboard.plannedMeals")
      : openList === "accepted"
        ? t("mess.dashboard.totalConsumption")
        : openList === "duplicate"
          ? t("mess.dashboard.duplicateAttempts")
          : openList === "guests"
            ? t("mess.dashboard.guestMealsCard")
            : openList === "civilian"
              ? t("mess.dashboard.civilianConsumption")
              : t("mess.dashboard.recentActivities");
  const listRows =
    openList === "planned"
      ? plannedLines
      : openList === "accepted"
        ? deviceLines.accepted
        : openList === "duplicate"
          ? deviceLines.duplicate
          : openList === "guests"
            ? guestLines
            : openList === "civilian"
              ? civilianLines
              : [
                  ...deviceLines.accepted,
                  ...deviceLines.duplicate,
                  ...deviceLines.rejected,
                ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  if (pulse) {
    const pulseLabel = "text-[10px] font-medium uppercase tracking-wide text-teal-100/70";
    const pulseControl =
      "h-10 w-full rounded-xl border-white/20 bg-white/10 text-white shadow-none placeholder:text-teal-100/60";
    const pulseCards = [
      { key: "planned" as const, label: t("mess.dashboard.plannedMeals"), value: todayPlanned },
      { key: "accepted" as const, label: t("mess.dashboard.totalConsumption"), value: todayAccepted },
      { key: "duplicate" as const, label: t("mess.dashboard.duplicateAttempts"), value: todayDuplicate },
      { key: "guests" as const, label: t("mess.dashboard.guestMealsCard"), value: guestCount },
    ];
    return (
      <>
        <div className="overflow-hidden rounded-2xl border border-teal-800/20 bg-[linear-gradient(135deg,#0f766e_0%,#115e59_42%,#134e4a_100%)] text-white shadow-[0_12px_40px_rgba(15,118,110,0.28)]">
          <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-100/80">
                {t("pages.adminDashboard.pulse.eyebrow")}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                {t("pages.adminDashboard.pulse.title")}
              </h2>
              <p className="mt-1 max-w-xl text-xs text-teal-50/75">
                {t("pages.adminDashboard.pulse.hint", {
                  today: formatDateDisplay(today),
                  tomorrow: formatDateDisplay(tomorrow),
                })}
              </p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <IconSoup className="h-5 w-5" />
            </span>
          </div>
        <div className="grid gap-3 border-t border-white/10 px-4 py-3 sm:grid-cols-2 sm:px-5 xl:grid-cols-6">
          <FilterField label={t("mess.dashboard.messBranch")} labelClassName={pulseLabel}>
            <Select value={messBranch} onValueChange={(value) => setMessBranch(value as MessSite | "all")}>
              <SelectTrigger className={pulseControl}>
                <SelectValue placeholder={t("mess.dashboard.allMessBranches")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("mess.dashboard.allMessBranches")}</SelectItem>
                <SelectItem value="hq">{t("mess.dashboard.messHq")}</SelectItem>
                <SelectItem value="haji">{t("mess.dashboard.messHaji")}</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t("mess.dashboard.branch")} labelClassName={pulseLabel}>
            <SettingsWingFilter
              value={wing}
              onChange={setWing}
              rootsOnly
              namesOnly
              className="w-full"
              triggerClassName={pulseControl}
              placeholder={t("mess.dashboard.allBranches")}
              clearLabel={t("mess.dashboard.allBranches")}
            />
          </FilterField>
          <FilterField label={t("mess.dashboard.shift")} labelClassName={pulseLabel}>
            <Select value={shift} onValueChange={(value) => chooseShift(value as MealShiftId | "all")}>
              <SelectTrigger className={pulseControl}>
                <SelectValue placeholder={t("mess.dashboard.allShifts")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("mess.dashboard.allShifts")}</SelectItem>
                {shifts.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {mealShiftLabel(row.id, row.name, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t("mess.dashboard.fromDate")} labelClassName={pulseLabel}>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value || today)}
              className={`${pulseControl} [color-scheme:dark]`}
            />
          </FilterField>
          <FilterField label={t("mess.dashboard.toDate")} labelClassName={pulseLabel}>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value || today)}
              className={`${pulseControl} [color-scheme:dark]`}
            />
          </FilterField>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-xl border-white/30 bg-transparent text-white hover:bg-white/10"
              disabled={!filtersDirty}
              onClick={clearFilters}
            >
              {t("mess.dashboard.clearFilters")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-xl border-white/30 bg-transparent text-white hover:bg-white/10"
              onClick={refreshDashboard}
            >
              {t("mess.dashboard.refresh")}
            </Button>
          </div>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {pulseCards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => setOpenList(card.key)}
              className="bg-teal-950/35 px-4 py-3.5 text-left backdrop-blur-[2px] transition hover:bg-teal-950/55"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-teal-100/70">
                {card.label}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-white">
                {card.value}
              </p>
            </button>
          ))}
        </div>
        </div>
        <MessCharts />
        {openList ? (
          <PersonList
            title={listTitle}
            rows={listRows}
            labels={{
              print: t("mess.dashboard.printList"),
              download: t("mess.dashboard.downloadList"),
              empty: t("mess.dashboard.listEmpty"),
              close: t("mess.dashboard.closeList"),
            }}
            onClose={() => setOpenList(null)}
          />
        ) : null}
      </>
    );
  }

  const body = (
    <>
        {embedded ? null : (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-sky-50 to-violet-50 p-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center dark:border-emerald-900/50 dark:from-emerald-950/40 dark:via-sky-950/30 dark:to-violet-950/40">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
              {t("pages.messDashboard.title")}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              <IconUser className="h-3.5 w-3.5" />
              {session?.role ? t(`roles.${session.role}`) : t("roles.mess")}
            </span>
          </div>
          <div className="flex min-w-0 justify-center overflow-x-auto">
            <MessPageTabs />
          </div>
          {searchOpen ? (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("mess.dashboard.searchPlaceholder")}
              className="h-9 w-52 rounded-full lg:justify-self-end"
              autoFocus
              onBlur={() => {
                if (!search.trim()) setSearchOpen(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 lg:justify-self-end dark:border-neutral-700 dark:bg-neutral-900"
              aria-label={t("common.search")}
            >
              <IconSearch className="h-4 w-4" />
            </button>
          )}
        </div>
        )}

        <div className="grid gap-3 rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white via-sky-50/70 to-amber-50/60 p-3 sm:grid-cols-2 xl:grid-cols-6 dark:border-sky-900/50 dark:from-neutral-950 dark:via-sky-950/20 dark:to-amber-950/20">
          <FilterField label={t("mess.dashboard.messBranch")}>
            <Select
              value={messBranch}
              onValueChange={(value) => setMessBranch(value as MessSite | "all")}
            >
              <SelectTrigger className="h-10 w-full rounded-xl">
                <SelectValue placeholder={t("mess.dashboard.allMessBranches")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("mess.dashboard.allMessBranches")}</SelectItem>
                <SelectItem value="hq">{t("mess.dashboard.messHq")}</SelectItem>
                <SelectItem value="haji">{t("mess.dashboard.messHaji")}</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t("mess.dashboard.branch")}>
            <SettingsWingFilter
              value={wing}
              onChange={setWing}
              rootsOnly
              namesOnly
              className="w-full"
              triggerClassName="h-10 w-full rounded-xl"
              placeholder={t("mess.dashboard.allBranches")}
              clearLabel={t("mess.dashboard.allBranches")}
            />
          </FilterField>
          <FilterField label={t("mess.dashboard.shift")}>
            <Select
              value={shift}
              onValueChange={(value) => chooseShift(value as MealShiftId | "all")}
            >
              <SelectTrigger className="h-10 w-full rounded-xl">
                <SelectValue placeholder={t("mess.dashboard.allShifts")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("mess.dashboard.allShifts")}</SelectItem>
                {shifts.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {mealShiftLabel(row.id, row.name, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t("mess.dashboard.fromDate")}>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value || today)}
              className="h-10 rounded-xl"
            />
          </FilterField>
          <FilterField label={t("mess.dashboard.toDate")}>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value || today)}
              className="h-10 rounded-xl"
            />
          </FilterField>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-xl"
              disabled={!filtersDirty}
              onClick={clearFilters}
            >
              {t("mess.dashboard.clearFilters")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-xl"
              onClick={refreshDashboard}
            >
              {t("mess.dashboard.refresh")}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("mess.dashboard.plannedMeals")}
            value={todayPlanned}
            icon={<IconSoup className="h-4 w-4" />}
            tone="emerald"
            hint={rangeHint}
            onClick={() => setOpenList("planned")}
          />
          <StatCard
            label={t("mess.dashboard.totalConsumption")}
            value={todayAccepted}
            icon={<IconActivity className="h-4 w-4" />}
            tone="sky"
            hint={rangeHint}
            onClick={() => setOpenList("accepted")}
          />
          <StatCard
            label={t("mess.dashboard.duplicateAttempts")}
            value={todayDuplicate}
            icon={<IconAlertTriangle className="h-4 w-4" />}
            tone="amber"
            hint={rangeHint}
            onClick={() => setOpenList("duplicate")}
          />
          <StatCard
            label={t("mess.dashboard.guestMealsCard")}
            value={guestCount}
            icon={<IconUser className="h-4 w-4" />}
            tone="violet"
            onClick={() => setOpenList("guests")}
          />
        </div>

        <MessCharts />

        {openList ? (
          <PersonList
            title={
              openList === "planned"
                ? t("mess.dashboard.plannedMeals")
                : openList === "accepted"
                  ? t("mess.dashboard.totalConsumption")
                  : openList === "duplicate"
                    ? t("mess.dashboard.duplicateAttempts")
                    : openList === "guests"
                      ? t("mess.dashboard.guestMealsCard")
                      : openList === "civilian"
                        ? t("mess.dashboard.civilianConsumption")
                        : t("mess.dashboard.recentActivities")
            }
            rows={
              openList === "planned"
                ? plannedLines
                : openList === "accepted"
                  ? deviceLines.accepted
                  : openList === "duplicate"
                    ? deviceLines.duplicate
                    : openList === "guests"
                      ? guestLines
                      : openList === "civilian"
                        ? civilianLines
                        : [
                        ...deviceLines.accepted,
                        ...deviceLines.duplicate,
                        ...deviceLines.rejected,
                      ].sort((a, b) => b.sortKey.localeCompare(a.sortKey))
            }
            labels={{
              print: t("mess.dashboard.printList"),
              download: t("mess.dashboard.downloadList"),
              empty: t("mess.dashboard.listEmpty"),
              close: t("mess.dashboard.closeList"),
            }}
            onClose={() => setOpenList(null)}
          />
        ) : null}
    </>
  );

  function MessCharts() {
    return (
      <>
        <div className="flex flex-col gap-4">
          <div className="grid items-stretch gap-4 lg:grid-cols-2">
            <section className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                {t("mess.dashboard.siteOverview")}
              </h2>
              <div className="mt-3 h-64 min-h-64 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={siteBars} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#525252" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#737373" }} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                    <Tooltip cursor={{ fill: "rgba(249,115,22,0.08)" }} />
                    <Bar dataKey="value" name={t("mess.dashboard.consumed")} fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={88} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
                {t("mess.dashboard.mealDistribution")}
              </h2>
              <div className="mt-1 flex min-h-64 flex-1 items-center justify-center">
                <MealRings
                  shift={shift}
                  breakfast={shiftConsumed.breakfast}
                  lunch={shiftConsumed.lunch}
                  dinner={shiftConsumed.dinner}
                  planned={ringPlanned}
                  labels={{
                    breakfast: t("mess.dashboard.shiftOf", {
                      shift: shiftName("breakfast"),
                      consumed: shiftConsumed.breakfast,
                      planned: ringPlanned,
                    }),
                    lunch: t("mess.dashboard.shiftOf", {
                      shift: shiftName("lunch"),
                      consumed: shiftConsumed.lunch,
                      planned: ringPlanned,
                    }),
                    dinner: t("mess.dashboard.shiftOf", {
                      shift: shiftName("dinner"),
                      consumed: shiftConsumed.dinner,
                      planned: ringPlanned,
                    }),
                  }}
                />
              </div>
            </section>
          </div>
          <section className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/70 p-5 dark:border-emerald-900/50 dark:from-neutral-950 dark:to-emerald-950/30">
            <h2 className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
              {t("mess.dashboard.branchOverview")}
            </h2>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchBars} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    height={branchBars.length > 7 ? 58 : 30}
                    angle={branchBars.length > 7 ? -28 : 0}
                    textAnchor={branchBars.length > 7 ? "end" : "middle"}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="ms"
                    name={t("mess.dashboard.msSeries")}
                    stackId="wing"
                  >
                    {branchBars.map((row) => (
                      <Cell key={row.name} fill={row.fill} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="civilian"
                    name={t("mess.dashboard.civilianSeries")}
                    stackId="wing"
                    fill="#7c3aed"
                    radius={[6, 6, 0, 0]}
                  >
                    <LabelList
                      dataKey="civilian"
                      position="top"
                      formatter={(value) => {
                        const count = Number(value);
                        return count > 0 ? String(count) : "";
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white to-sky-50/70 p-4 dark:border-sky-900/50 dark:from-neutral-950 dark:to-sky-950/30">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-sky-800 dark:text-sky-200">
                {t("mess.dashboard.recentActivities")}
              </h2>
              <button
                type="button"
                onClick={() => setOpenList("punches")}
                className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                {t("mess.dashboard.seeMore")}
                <IconArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {activities.length === 0 ? (
                <li className="py-8 text-center text-sm text-neutral-500">
                  {t("mess.dashboard.noActivity")}
                </li>
              ) : (
                activities.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start gap-3 rounded-xl px-1 py-1.5"
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        avatarTone(row.name),
                      )}
                    >
                      {initials(row.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                        {row.name}
                        <span className="font-normal text-neutral-500">
                          {" "}
                          ({row.code})
                        </span>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                        <span>{row.personalId || row.wing}</span>
                        <span>·</span>
                        <span>{shiftName(row.shiftId)}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-px text-[10px] font-semibold",
                            row.kind === "guest"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                              : row.kind === "group"
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
                                : row.kind === "duplicate"
                                  ? "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200"
                                  : row.kind === "not_allowed"
                                    ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-200"
                                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
                          )}
                        >
                          {row.kind === "guest"
                            ? t("mess.dashboard.guestMeal")
                            : row.kind === "group"
                              ? t("nav.pritibhoj")
                              : row.kind === "duplicate"
                                ? t("zkGate.alreadyAccepted")
                                : row.kind === "not_allowed"
                                  ? t("zkGate.notAllowed")
                                  : t("zkGate.accepted")}
                        </span>
                      </p>
                    </div>
                    <p className="shrink-0 text-[10px] tabular-nums text-neutral-400">
                      {formatStamp(row.time, dateLocale)}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
      </>
    );
  }

  if (embedded) {
    return <div className="flex flex-col gap-5">{body}</div>;
  }

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        {body}
      </motion.div>
    </PagePane>
  );
}

function FilterField({
  label,
  children,
  labelClassName,
}: {
  label: string;
  children: ReactNode;
  labelClassName?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className={cn("text-[11px] font-medium text-neutral-500", labelClassName)}>
        {label}
      </span>
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
  hint,
  onClick,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "emerald" | "sky" | "amber" | "violet" | "rose";
  hint?: string;
  onClick?: () => void;
}) {
  const cardClass = {
    emerald:
      "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-950 dark:border-emerald-900/60 dark:from-emerald-950/50 dark:to-teal-950/30 dark:text-emerald-50",
    sky: "border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 text-sky-950 dark:border-sky-900/60 dark:from-sky-950/50 dark:to-blue-950/30 dark:text-sky-50",
    amber:
      "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-100 text-amber-950 dark:border-amber-900/60 dark:from-amber-950/50 dark:to-orange-950/30 dark:text-amber-50",
    violet:
      "border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-100 text-violet-950 dark:border-violet-900/60 dark:from-violet-950/50 dark:to-fuchsia-950/30 dark:text-violet-50",
    rose: "border-rose-200 bg-gradient-to-br from-rose-50 to-pink-100 text-rose-950 dark:border-rose-900/60 dark:from-rose-950/50 dark:to-pink-950/30 dark:text-rose-50",
  }[tone];
  const toneClass = {
    emerald: "bg-white/80 text-emerald-600 dark:bg-emerald-900/70 dark:text-emerald-200",
    sky: "bg-white/80 text-sky-600 dark:bg-sky-900/70 dark:text-sky-200",
    amber: "bg-white/80 text-amber-600 dark:bg-amber-900/70 dark:text-amber-200",
    violet: "bg-white/80 text-violet-600 dark:bg-violet-900/70 dark:text-violet-200",
    rose: "bg-white/80 text-rose-600 dark:bg-rose-900/70 dark:text-rose-200",
  }[tone];
  const className = cn(
    "flex w-full items-start justify-between rounded-2xl border p-4 text-left shadow-sm",
    onClick && "cursor-pointer transition hover:brightness-[0.98]",
    cardClass,
  );
  const body = (
    <>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-[11px] opacity-70">{hint}</p> : null}
      </div>
      <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg", toneClass)}>
        {icon}
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return (
    <div className={className}>
      {body}
    </div>
  );
}

function PersonList({
  title,
  rows,
  labels,
  onClose,
}: {
  title: string;
  rows: PersonLine[];
  labels: {
    print: string;
    download: string;
    empty: string;
    close: string;
  };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h2>
            <p className="text-xs text-neutral-500">{rows.length}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="h-8 rounded-lg" onClick={() => printPeople(rows)}>
              <IconPrinter className="mr-1.5 h-4 w-4" />
              {labels.print}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-lg"
              onClick={() => downloadPeople(rows)}
            >
              <IconDownload className="mr-1.5 h-4 w-4" />
              {labels.download}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              aria-label={labels.close}
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-900">
              <tr>
                {REPORT_HEADERS.map((header) => (
                  <th key={header} className="whitespace-nowrap px-3 py-2 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, index) => (
                  <tr key={`${row.rabId}-${row.sortKey}-${index}`} className="border-t border-neutral-100 dark:border-neutral-800">
                    {reportCells(row, index).map((cell, cellIndex) => (
                      <td
                        key={REPORT_HEADERS[cellIndex]}
                        className={cn(
                          "whitespace-nowrap px-3 py-2",
                          cellIndex === 3 && "text-neutral-900 dark:text-neutral-100",
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={REPORT_HEADERS.length} className="px-4 py-8 text-center text-neutral-500">
                    {labels.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

