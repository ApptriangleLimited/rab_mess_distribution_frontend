"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  IconActivity,
  IconAlertTriangle,
  IconArrowRight,
  IconCake,
  IconCheck,
  IconClockHour4,
  IconDownload,
  IconPrinter,
  IconSearch,
  IconSettings,
  IconSoup,
  IconTags,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
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
  fetchHazzDisplay,
  fetchZkDisplay,
  type ZkGateRow,
  type ZkGateStatus,
} from "@/lib/api/zk-gate";
import { eachISODate, todayISO } from "@/lib/date";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { buildRangeLedger, type LedgerRow } from "@/lib/reports";
import { listGuestMeals } from "@/lib/store/guest-meals";
import { listMealAssigns } from "@/lib/store/meal-assigns";
import { listMealShifts, mealShiftLabel } from "@/lib/store/meal-shifts";
import {
  formatMemberWing,
  isHqBranchName,
  memberFormWing,
  memberMatchesWingFilter,
  memberWingCascade,
} from "@/lib/store/org-options";
import {
  eventManpower,
  listPritibhojEvents,
  replaceLocalPritibhojEvents,
} from "@/lib/store/pritibhoj";
import { isCivilianMember } from "@/lib/store/users";
import type { PritibhojEvent } from "@/lib/types";
import type { MealShiftId, User } from "@/lib/types";
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
const DONUT_REST = "#e2e8f0";
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

type ListKind = "planned" | "accepted" | "duplicate" | "punches";

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
  kind: "consumption" | "duplicate" | "guest" | "group";
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

function ShiftRing({
  consumed,
  planned,
  color,
  label,
  large,
}: {
  consumed: number;
  planned: number;
  color: string;
  label: string;
  large: boolean;
}) {
  const remaining = Math.max(0, planned - consumed);
  const data = [
    { name: "consumed", value: consumed, fill: color },
    { name: "rest", value: remaining || (planned ? 0 : 1), fill: DONUT_REST },
  ];
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div className={cn("relative w-full", large ? "h-56" : "h-40")}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={large ? 68 : 46}
              outerRadius={large ? 86 : 60}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {data.map((row) => (
                <Cell key={row.name} fill={row.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
            {consumed}/{planned}
          </p>
        </div>
      </div>
      <p className="mt-1 text-center text-xs font-medium" style={{ color }}>
        {label}
      </p>
    </div>
  );
}

export default function MessDashboardClient() {
  const t = useT();
  const { locale } = useI18n();
  const { session } = useSession();
  const state = useStore();
  const reduceMotion = useReducedMotion();
  const apiOn = isApiEnabled();
  const dateLocale = locale === "bn" ? "bn-BD" : "en-US";
  const today = todayISO();

  const [wing, setWing] = useState("all");
  const [shift, setShift] = useState<MealShiftId | "all">("all");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [apiData, setApiData] = useState<MessCheckinsData | null>(null);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [apiEvents, setApiEvents] = useState<PritibhojEvent[] | null>(null);
  const [devicePunches, setDevicePunches] = useState<BoardPunch[]>([]);
  const [todayLedger, setTodayLedger] = useState<LedgerRow[]>([]);
  const [openList, setOpenList] = useState<ListKind | null>(null);

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
  }, [apiOn, range.from, range.to]);

  useEffect(() => {
    if (!apiOn) {
      setTodayLedger([]);
      return;
    }
    let cancelled = false;
    void listMessLedger(today, today)
      .then((ledger) => {
        if (!cancelled) setTodayLedger(ledger.rows.map(ledgerRowApiToLedgerRow));
      })
      .catch(() => {
        if (!cancelled) setTodayLedger([]);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, today]);

  useEffect(() => {
    if (!apiOn) {
      setDevicePunches([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void Promise.all([
        fetchZkDisplay().catch(() => null),
        fetchHazzDisplay().catch(() => null),
      ]).then(([hq, hazz]) => {
        if (cancelled) return;
        setDevicePunches([
          ...(hq?.rows ?? []).map((row) => ({ ...row, mess: "SRB HQ" })),
          ...(hazz?.rows ?? []).map((row) => ({ ...row, mess: "Haji camp" })),
        ]);
      });
    };
    load();
    const timer = window.setInterval(load, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [apiOn]);

  const shifts = useMemo(
    () => listMealShifts(),
    [state.meal_shifts],
  );

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
      return true;
    });
  }, [apiData, range, shift, state.guest_meals]);

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
    for (const row of todayLedger) add(row.user);
    return map;
  }, [members, state.users, todayLedger]);

  const plannedLines = useMemo(() => {
    const todayRange = liveLedgerRows.filter(
      () => range.from === today && range.to === today,
    );
    const source = todayLedger.length ? todayLedger : todayRange;
    const lines: PersonLine[] = [];
    for (const row of source) {
      if (!memberMatchesWingFilter(row.user.wing, wing)) continue;
      if (!row.days.some((tag) => tag === "MS")) continue;
      lines.push(
        personLine(row.user, {
          name: row.user.name,
          rabId: row.user.rab_id,
          status: "Planned",
          sift: "—",
          checkIn: "—",
          sortKey: row.user.name,
        }),
      );
    }
    if (!apiOn && !(range.from === today && range.to === today)) {
      for (const row of state.assignments) {
        if (row.date !== today || row.tag !== "MS") continue;
        const user = state.users.find((item) => item.id === row.user_id);
        if (!user || !memberMatchesWingFilter(user.wing, wing)) continue;
        lines.push(
          personLine(user, {
            name: user.name,
            rabId: user.rab_id,
            status: "Planned",
            sift: "—",
            checkIn: "—",
            sortKey: user.name,
          }),
        );
      }
    }
    lines.sort((a, b) => a.name.localeCompare(b.name));
    return lines;
  }, [apiOn, liveLedgerRows, range.from, range.to, state.assignments, state.users, state.wing_parent, today, todayLedger, wing]);

  const deviceLines = useMemo(() => {
    const accepted: PersonLine[] = [];
    const duplicate: PersonLine[] = [];
    for (const row of devicePunches) {
      const day = (row.punched_at || "").slice(0, 10);
      if (day !== today) continue;
      const status = punchStatus(row);
      if (status !== "accepted" && status !== "already_accepted") continue;
      if (shift !== "all" && row.shift_id !== shift) continue;
      const user = userByKey.get(row.rab_id);
      if (wing !== "all" && (!user || !memberMatchesWingFilter(user.wing, wing))) continue;
      const line = personLine(user, {
        name: user?.name || row.name,
        rabId: row.rab_id,
        status: status === "accepted" ? "Consumption" : "Duplicate",
        sift: row.shift_id
          ? mealShiftLabel(row.shift_id, shifts.find((item) => item.id === row.shift_id)?.name ?? row.shift_name ?? row.shift_id, t)
          : "—",
        checkIn: checkInLabel(row.punched_at || ""),
        sortKey: row.punched_at || "",
        mess: row.mess,
      });
      if (status === "accepted") accepted.push(line);
      else duplicate.push(line);
    }
    return { accepted, duplicate };
  }, [devicePunches, shift, shifts, t, today, userByKey, wing]);

  const todayPlanned = plannedLines.length;
  const todayAccepted = deviceLines.accepted.length;
  const todayDuplicate = deviceLines.duplicate.length;
  const shiftConsumed = useMemo(() => {
    const counts = { breakfast: 0, lunch: 0, dinner: 0 };
    for (const row of devicePunches) {
      const day = (row.punched_at || "").slice(0, 10);
      if (day !== today) continue;
      if (punchStatus(row) !== "accepted") continue;
      const user = userByKey.get(row.rab_id);
      if (wing !== "all" && (!user || !memberMatchesWingFilter(user.wing, wing))) continue;
      const id = row.shift_id;
      if (id === "breakfast" || id === "lunch" || id === "dinner") counts[id] += 1;
    }
    return counts;
  }, [devicePunches, today, userByKey, wing]);
  const ringShifts = (shift === "all"
    ? (["breakfast", "lunch", "dinner"] as const)
    : shift === "breakfast" || shift === "lunch" || shift === "dinner"
      ? ([shift] as const)
      : ([] as const));
  const guestCount = guests.length;
  const pritibhojEvents = apiEvents ?? listPritibhojEvents();
  const groupCount = useMemo(() => {
    return pritibhojEvents
      .filter((event) => event.date >= range.from && event.date <= range.to)
      .reduce((sum, event) => {
        const sheetTotal = [...event.main_rows, ...event.admin_rows].reduce(
          (s, row) => s + (row.total || 0),
          0,
        );
        return sum + (sheetTotal || eventManpower(event));
      }, 0);
  }, [pritibhojEvents, range]);
  const otherMeals = guestCount + groupCount;

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
    for (const row of devicePunches) {
      const day = (row.punched_at || "").slice(0, 10);
      if (day < range.from || day > range.to) continue;
      const status = punchStatus(row);
      if (status !== "accepted" && status !== "already_accepted") continue;
      if (shift !== "all" && row.shift_id !== shift) continue;
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
        kind: status === "accepted" ? "consumption" : "duplicate",
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
  }, [devicePunches, guests, pritibhojEvents, range, search, shift, shifts, state.wing_parent, t, userByKey, wing]);

  const filtersDirty =
    wing !== "all" || shift !== "all" || dateFrom !== today || dateTo !== today;

  function clearFilters() {
    setWing("all");
    setShift("all");
    setDateFrom(today);
    setDateTo(today);
    setSearch("");
  }

  const shiftName = (id: MealShiftId) =>
    mealShiftLabel(id, shifts.find((s) => s.id === id)?.name ?? id, t);

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
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

        <div className="grid gap-3 rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white via-sky-50/70 to-amber-50/60 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] dark:border-sky-900/50 dark:from-neutral-950 dark:via-sky-950/20 dark:to-amber-950/20">
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
              onValueChange={(value) => setShift(value as MealShiftId | "all")}
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
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl"
              disabled={!filtersDirty}
              onClick={clearFilters}
            >
              {t("mess.dashboard.clearFilters")}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("mess.dashboard.plannedMeals")}
            value={todayPlanned}
            icon={<IconSoup className="h-4 w-4" />}
            tone="emerald"
            hint={t("mess.totalMs")}
            onClick={() => setOpenList("planned")}
          />
          <StatCard
            label={t("mess.dashboard.totalConsumption")}
            value={todayAccepted}
            icon={<IconActivity className="h-4 w-4" />}
            tone="sky"
            hint={t("mess.dashboard.todayHint")}
            onClick={() => setOpenList("accepted")}
          />
          <StatCard
            label={t("mess.dashboard.duplicateAttempts")}
            value={todayDuplicate}
            icon={<IconAlertTriangle className="h-4 w-4" />}
            tone="amber"
            hint={t("mess.dashboard.todayHint")}
            onClick={() => setOpenList("duplicate")}
          />
          <StatCard
            label={t("mess.dashboard.otherMeals")}
            value={otherMeals}
            icon={<IconCheck className="h-4 w-4" />}
            tone="violet"
            hint={t("mess.dashboard.otherMealsHint", {
              guest: guestCount,
              group: groupCount,
            })}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/70 p-4 dark:border-emerald-900/50 dark:from-neutral-950 dark:to-emerald-950/30">
            <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              {t("mess.dashboard.branchOverview")}
            </h2>
            <div className="mt-3 h-72">
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

          <section className="rounded-2xl border border-orange-200/80 bg-gradient-to-br from-white to-orange-50/70 p-4 dark:border-orange-900/50 dark:from-neutral-950 dark:to-orange-950/30">
            <h2 className="text-sm font-semibold text-orange-800 dark:text-orange-200">
              {t("mess.dashboard.mealDistribution")}
            </h2>
            <div className="mt-3 flex items-end justify-center gap-2">
              {ringShifts.map((id) => (
                <ShiftRing
                  key={id}
                  consumed={shiftConsumed[id]}
                  planned={todayPlanned}
                  color={SHIFT_RING_COLOR[id]}
                  label={t("mess.dashboard.shiftOf", {
                    shift: shiftName(id),
                    consumed: shiftConsumed[id],
                    planned: todayPlanned,
                  })}
                  large={ringShifts.length === 1}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-white to-violet-50/70 p-4 dark:border-violet-900/50 dark:from-neutral-950 dark:to-violet-950/30">
            <h2 className="text-sm font-semibold text-violet-800 dark:text-violet-200">
              {t("mess.dashboard.quickActions")}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <QuickAction
                href="/mess/ledger"
                icon={<IconTags className="h-5 w-5" />}
                tone="sky"
                title={t("nav.messLedger")}
                hint={t("mess.dashboard.openLedgerHint")}
              />
              <QuickAction
                href="/mess/pritibhoj"
                icon={<IconCake className="h-5 w-5" />}
                tone="rose"
                title={t("nav.pritibhoj")}
                hint={t("mess.dashboard.newPritibhojHint")}
              />
              <QuickAction
                href="/mess/shifts"
                icon={<IconClockHour4 className="h-5 w-5" />}
                tone="emerald"
                title={t("nav.shifts")}
                hint={t("mess.dashboard.createShiftHint")}
              />
              <QuickAction
                href="/settings"
                icon={<IconSettings className="h-5 w-5" />}
                tone="violet"
                title={t("nav.settings")}
                hint={t("mess.dashboard.openSettingsHint")}
              />
            </div>
          </section>

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
                                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
                          )}
                        >
                          {row.kind === "guest"
                            ? t("mess.dashboard.guestMeal")
                            : row.kind === "group"
                              ? t("nav.pritibhoj")
                              : row.kind === "duplicate"
                                ? t("zkGate.alreadyAccepted")
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
        </div>
        {openList ? (
          <PersonList
            title={
              openList === "planned"
                ? t("mess.dashboard.plannedMeals")
                : openList === "accepted"
                  ? t("mess.dashboard.totalConsumption")
                  : openList === "duplicate"
                    ? t("mess.dashboard.duplicateAttempts")
                    : t("mess.dashboard.recentActivities")
            }
            rows={
              openList === "planned"
                ? plannedLines
                : openList === "accepted"
                  ? deviceLines.accepted
                  : openList === "duplicate"
                    ? deviceLines.duplicate
                    : [...deviceLines.accepted, ...deviceLines.duplicate].sort((a, b) =>
                        b.sortKey.localeCompare(a.sortKey),
                      )
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
  tone: "emerald" | "sky" | "amber" | "violet";
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
  }[tone];
  const toneClass = {
    emerald: "bg-white/80 text-emerald-600 dark:bg-emerald-900/70 dark:text-emerald-200",
    sky: "bg-white/80 text-sky-600 dark:bg-sky-900/70 dark:text-sky-200",
    amber: "bg-white/80 text-amber-600 dark:bg-amber-900/70 dark:text-amber-200",
    violet: "bg-white/80 text-violet-600 dark:bg-violet-900/70 dark:text-violet-200",
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

function QuickAction({
  href,
  icon,
  tone,
  title,
  hint,
}: {
  href: string;
  icon: ReactNode;
  tone: "violet" | "amber" | "emerald" | "sky" | "rose" | "orange";
  title: string;
  hint: string;
}) {
  const cardClass = {
    violet:
      "border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-100 hover:from-violet-100 dark:border-violet-900/50 dark:from-violet-950/40 dark:to-fuchsia-950/20",
    amber:
      "border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-100 hover:from-amber-100 dark:border-amber-900/50 dark:from-amber-950/40 dark:to-yellow-950/20",
    emerald:
      "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 hover:from-emerald-100 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-teal-950/20",
    sky: "border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 hover:from-sky-100 dark:border-sky-900/50 dark:from-sky-950/40 dark:to-blue-950/20",
    rose: "border-rose-200 bg-gradient-to-br from-rose-50 to-pink-100 hover:from-rose-100 dark:border-rose-900/50 dark:from-rose-950/40 dark:to-pink-950/20",
    orange:
      "border-orange-200 bg-gradient-to-br from-orange-50 to-amber-100 hover:from-orange-100 dark:border-orange-900/50 dark:from-orange-950/40 dark:to-amber-950/20",
  }[tone];
  const toneClass = {
    violet: "bg-white/80 text-violet-600 dark:bg-violet-900/70 dark:text-violet-200",
    amber: "bg-white/80 text-amber-600 dark:bg-amber-900/70 dark:text-amber-200",
    emerald: "bg-white/80 text-emerald-600 dark:bg-emerald-900/70 dark:text-emerald-200",
    sky: "bg-white/80 text-sky-600 dark:bg-sky-900/70 dark:text-sky-200",
    rose: "bg-white/80 text-rose-600 dark:bg-rose-900/70 dark:text-rose-200",
    orange: "bg-white/80 text-orange-600 dark:bg-orange-900/70 dark:text-orange-200",
  }[tone];
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border px-3 py-5 text-center transition hover:shadow-sm",
        cardClass,
      )}
    >
      <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl", toneClass)}>
        {icon}
      </span>
      <span className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</span>
      <span className="text-[11px] text-neutral-600 dark:text-neutral-400">{hint}</span>
    </Link>
  );
}
