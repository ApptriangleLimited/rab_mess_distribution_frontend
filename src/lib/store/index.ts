import {
  defaultForceRanks,
  FORCE_DEFAULT_RANKS,
  FORCES,
  FORCE_LABELS,
  FORCE_LABELS_BN,
  FORCE_CATALOG_SERIALS,
  PINNED_FORCE_LADDERS,
  FORCE_RANK_LABELS,
  FORCE_RANK_LABELS_BN,
  FORCE_RANK_SERIALS,
  FORCE_RANK_SHORT_RENAMES,
  canonicalForceName,
  canonicalForceServiceRank,
  defaultForceRankForSrb,
  forceRankChoices,
  LEGACY_AIR_FORCE_RANKS,
  LEGACY_ANSAR_RANKS,
  LEGACY_ARMY_RANKS,
  LEGACY_BGB_RANKS,
  LEGACY_CIVILIAN_RANKS,
  LEGACY_FORCES,
  LEGACY_NAVY_RANKS,
  LEGACY_POLICE_RANKS,
  LEGACY_RANKS,
  DROPPED_MAIN_WINGS,
  LEGACY_WINGS,
  ADMIN_SUB_WINGS,
  HQ_SUB_WINGS,
  LEGACY_FORM1_WINGS,
  LEGACY_HQ_SUB_WINGS,
  DEFAULT_WING_PARENT,
  LEGACY_MEMBER_BANKS,
  DEFAULT_AUTHORIZED,
  MEMBER_BANKS,
  CL_FR_MONTHLY_TAG,
  DAILY_TAGS,
  RATE_ONLY_TAGS,
  RANKS,
  RANK_LABELS,
  RANK_LABELS_BN,
  RANK_CATALOG_SERIALS,
  canonicalRankName,
  isPreviousSrbRankCatalog,
  STORE_KEY,
  WINGS,
  WING_LABELS,
  WING_LABELS_BN,
  WING_CATALOG_SERIALS,
  canonicalWingName,
  authorizedIdForLabel,
} from "@/lib/constants";
import { parseMoney } from "@/lib/money";
import {
  isLegacyDemoSenders,
  officialSenderAccounts,
  renameFirewoodFrSender,
} from "@/lib/official-senders";
import { isCcApiEnabled } from "@/lib/api/mode";
import {
  demoPritibhojEvents,
  normalizePritibhojEvent,
} from "@/lib/pritibhoj-demo";
import {
  ensureTagRequests,
  MIN_TAG_REQUESTS_PER_QUEUE,
  storedTagRequests,
} from "@/lib/tag-request-demo";
import {
  createLiveCatalogState,
  createSeedState,
  extraCockpitPoliceMembers,
  extraTrustFirewoodAssignments,
  extraTrustFirewoodMembers,
  SEED_VERSION,
} from "@/lib/store/seed";
import type {
  AllowanceRate,
  AppState,
  EmergencyContact,
  PaperReportRequest,
  PritibhojEvent,
  User,
} from "@/lib/types";

type Listener = () => void;
type PersistHook = (state: AppState) => void;

let memory: AppState | null = null;
const listeners = new Set<Listener>();
let persistHook: PersistHook | null = null;
let persistPaused = false;
let apiBacked = false;
/** Avoid re-running catalog heal on every getState() (new object → React loop). */
let catalogHealed = false;

export function setPersistHook(hook: PersistHook | null) {
  persistHook = hook;
}

export function applyApiSnapshot(partial: Partial<AppState>) {
  persistPaused = true;
  apiBacked = true;
  const prev = getState();
  const merged: AppState = { ...prev, version: SEED_VERSION };
  for (const [key, value] of Object.entries(partial) as [keyof AppState, AppState[keyof AppState]][]) {
    if (value == null) continue;
    const current = merged[key];
    if (Array.isArray(value) && value.length === 0 && Array.isArray(current) && current.length > 0) {
      if (
        key === "users" ||
        key === "assignments" ||
        key === "tag_requests" ||
        key === "state_reports" ||
        key === "meal_plans" ||
        key === "meal_assigns" ||
        key === "guest_meals" ||
        key === "pritibhoj_events"
      ) {
        merged[key] = value as never;
        continue;
      }
      continue;
    }
    if (
      (key === "manpower_held" ||
        key === "manpower_absent" ||
        key === "manpower_present" ||
        key === "manpower_absence_detail" ||
        key === "force_rank_officer" ||
        key === "force_rank_cells") &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as object).length === 0 &&
      current &&
      typeof current === "object" &&
      !Array.isArray(current) &&
      Object.keys(current as object).length > 0
    ) {
      continue;
    }
    merged[key] = value as never;
  }
  catalogHealed = true;
  memory = normalizeState(merged);
  writeStorage(memory);
  listeners.forEach((l) => l());
  persistPaused = false;
  // Do not write this snapshot back. A full save of the loaded copy races
  // with Settings and puts the old rank catalog back after a new rank is added.
}

type LegacyUser = User & {
  emergency_name?: string;
  emergency_relation?: string;
  emergency_phone?: string;
};

function normalizeEmergencyContacts(u: LegacyUser): EmergencyContact[] {
  if (Array.isArray(u.emergency_contacts) && u.emergency_contacts.length > 0) {
    return u.emergency_contacts.map((c) => ({
      name: c?.name ?? "",
      relation: c?.relation ?? "",
      phone: c?.phone ?? "",
    }));
  }
  const name = u.emergency_name ?? "";
  const relation = u.emergency_relation ?? "";
  const phone = u.emergency_phone ?? "";
  if (name || relation || phone) {
    return [{ name, relation, phone }];
  }
  return [];
}

function ensureStringList(
  raw: unknown,
  fallback: readonly string[],
): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const label = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

function asFiniteNumber(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function ensureDayWingCatMap(
  raw: unknown,
): Record<string, Record<string, Record<string, number>>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, Record<string, Record<string, number>>> = {};
  for (const [date, wings] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!wings || typeof wings !== "object") continue;
    const wingMap: Record<string, Record<string, number>> = {};
    for (const [wing, cats] of Object.entries(wings as Record<string, unknown>)) {
      const wingKey = canonicalWingName(wing);
      if (!wingKey || !cats || typeof cats !== "object") continue;
      const catMap: Record<string, number> = { ...(wingMap[wingKey] ?? {}) };
      for (const [catId, n] of Object.entries(cats as Record<string, unknown>)) {
        const num = Number(n);
        if (!catId.trim() || !Number.isFinite(num) || num < 0) continue;
        catMap[catId] = (catMap[catId] ?? 0) + Math.floor(num);
      }
      if (Object.keys(catMap).length) wingMap[wingKey] = catMap;
    }
    if (Object.keys(wingMap).length) out[date] = wingMap;
  }
  return out;
}

function ensureForceRankOfficer(
  raw: unknown,
): Record<string, { held: number; total: number }> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, { held: number; total: number }> = {};
  for (const [date, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!row || typeof row !== "object") continue;
    const held = Number((row as { held?: unknown }).held);
    const total = Number((row as { total?: unknown }).total);
    const nextHeld =
      Number.isFinite(held) && held > 0 ? Math.floor(held) : 0;
    const nextTotal =
      Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
    if (nextHeld || nextTotal) out[date] = { held: nextHeld, total: nextTotal };
  }
  return out;
}

function sanitizePritibhojEvent(raw: unknown): PritibhojEvent | null {
  return normalizePritibhojEvent(raw);
}

function ensurePritibhojEvents(state: AppState): PritibhojEvent[] {
  const raw = Object.prototype.hasOwnProperty.call(state, "pritibhoj_events")
    ? state.pritibhoj_events
    : undefined;
  const cleaned = Array.isArray(raw)
    ? raw
        .map(sanitizePritibhojEvent)
        .filter((event): event is PritibhojEvent => event !== null)
        .filter((event) => !event.id.startsWith("pb_demo_"))
    : [];
  if (apiBacked) return cleaned;
  if (cleaned.length === 0) return demoPritibhojEvents();
  return cleaned;
}

function ensurePaperReports(raw: unknown): PaperReportRequest[] {
  if (!Array.isArray(raw)) return [];
  const out: PaperReportRequest[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<PaperReportRequest>;
    const kind =
      row.kind === "pritibhoj"
        ? "pritibhoj"
        : row.kind === "manpower"
          ? "manpower"
          : null;
    const id = String(row.id ?? "").trim();
    const ref = String(row.ref ?? "").trim();
    if (!kind || !id || !ref) continue;
    const status =
      row.status === "approved" || row.status === "submitted"
        ? row.status
        : "draft";
    out.push({
      id,
      kind,
      ref,
      form:
        row.form === "1" ||
        row.form === "2" ||
        row.form === "3" ||
        row.form === "4"
          ? row.form
          : undefined,
      title: String(row.title ?? ""),
      date: String(row.date ?? ""),
      status,
      submitted_at: String(row.submitted_at ?? ""),
      submitted_by: String(row.submitted_by ?? ""),
      reviewed_at: String(row.reviewed_at ?? ""),
      reviewed_by: String(row.reviewed_by ?? ""),
    });
  }
  return out;
}

/** Swap battalion-era defaults → parent-force list once. */
function isLegacyForces(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length !== LEGACY_FORCES.length) return false;
  const legacy = new Set(LEGACY_FORCES.map((f) => f.toLowerCase()));
  const seen = new Set<string>();
  for (const item of raw) {
    const label = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (!label || !legacy.has(label)) return false;
    seen.add(label);
  }
  return seen.size === LEGACY_FORCES.length;
}

function isRabRanks(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length !== RANKS.length) return false;
  const have = new Set<string>();
  for (const item of raw) {
    const label = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (label) have.add(label);
  }
  if (have.size !== RANKS.length) return false;
  return RANKS.every((r) => have.has(r.toLowerCase()));
}

function isLegacyRanks(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length !== LEGACY_RANKS.length) return false;
  const legacy = new Set(LEGACY_RANKS.map((r) => r.toLowerCase()));
  const seen = new Set<string>();
  for (const item of raw) {
    const label = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (!label || !legacy.has(label)) return false;
    seen.add(label);
  }
  return seen.size === LEGACY_RANKS.length;
}

function isLegacyWings(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length !== LEGACY_WINGS.length) return false;
  const legacy = new Set(LEGACY_WINGS.map((r) => r.toLowerCase()));
  const seen = new Set<string>();
  for (const item of raw) {
    const label = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (!label || !legacy.has(label)) return false;
    seen.add(label);
  }
  return seen.size === LEGACY_WINGS.length;
}

function uniqueWingLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of labels) {
    const label = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** Keep stored wings so Settings add/remove persists. Official Admin/HQ subs are always present. */
function ensureWings(raw: unknown): string[] {
  const banned = new Set(
    [
      ...LEGACY_WINGS,
      ...LEGACY_FORM1_WINGS,
      ...LEGACY_HQ_SUB_WINGS,
      ...DROPPED_MAIN_WINGS,
    ]
      .map((w) => w.toLowerCase())
      .filter(
        (key) =>
          !WINGS.some((w) => w.toLowerCase() === key) &&
          !ADMIN_SUB_WINGS.some((w) => w.toLowerCase() === key) &&
          !HQ_SUB_WINGS.some((w) => w.toLowerCase() === key),
      ),
  );
  const catalog = uniqueWingLabels([
    ...WINGS,
    ...ADMIN_SUB_WINGS,
    ...HQ_SUB_WINGS,
  ]);
  if (isLegacyWings(raw) || !Array.isArray(raw)) return catalog;
  const stored = uniqueWingLabels(
    raw.map((item) => canonicalWingName(String(item ?? ""))).filter((label) => {
      const key = label.trim().toLowerCase();
      return Boolean(key) && !banned.has(key);
    }),
  );
  if (!stored.length) return catalog;
  return uniqueWingLabels([...stored, ...ADMIN_SUB_WINGS, ...HQ_SUB_WINGS]);
}

/** Core member-bank catalog + user-added names. */
function ensureMemberBanks(raw: unknown): string[] {
  const base: string[] = [...MEMBER_BANKS];
  const seen = new Set<string>(base.map((b) => b.toLowerCase()));
  const legacy = new Set<string>(
    LEGACY_MEMBER_BANKS.map((b) => b.toLowerCase()),
  );
  if (!Array.isArray(raw)) return base;
  for (const item of raw) {
    const label = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!label) continue;
    const key = label.toLowerCase();
    if (legacy.has(key) || seen.has(key)) continue;
    seen.add(key);
    base.push(label);
  }
  return base;
}


function parseAuthorizedWings(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [wingRaw, countRaw] of Object.entries(raw as Record<string, unknown>)) {
    const wing = canonicalWingName(
      String(wingRaw ?? "")
        .trim()
        .replace(/\s+/g, " "),
    );
    if (!wing) continue;
    const n = Number(countRaw);
    if (!Number.isFinite(n) || n < 0) continue;
    out[wing] = (out[wing] ?? 0) + Math.floor(n);
  }
  return out;
}

function sumAuthorizedWings(wings: Record<string, number>): number {
  let sum = 0;
  for (const n of Object.values(wings)) sum += n;
  return sum;
}

/**
 * Map legacy authorized labels → current Settings rank labels (or Officer).
 * Empty string = drop (not a mess rank).
 */
const AUTHORIZED_LABEL_MIGRATE: Record<string, string> = {
  officer: "Officer",
  jco: "DAD",
  dad: "DAD",
  others: "RT",
  other: "RT",
  rt: "RT",
  nco: "SI",
  si: "SI",
  lnco: "ASI",
  aasi: "ASI",
  nayek: "Naik",
  naik: "Naik",
  or: "Constable",
  co: "Constable",
  constable: "Constable",
  cook: "Cook",
  "lp(e)": "NCE",
  lpe: "NCE",
  "lp (e)": "NCE",
  "nc(e)": "NCE",
  nce: "NCE",
  ance: "NCE",
  civil: "Civil",
  civill: "Civil",
  civilian: "Civil",
  attached: "Attached",
};

function mergeWingMaps(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out = { ...a };
  for (const [wing, n] of Object.entries(b)) {
    out[wing] = (out[wing] ?? 0) + n;
  }
  return out;
}

/**
 * Authorized = Officer + Settings ranks (order).
 * Wing counts preserved across renames. `count` always = sum of `wings`.
 */
function ensureAuthorized(
  raw: unknown,
  ranks: string[],
): typeof DEFAULT_AUTHORIZED {
  const wingBuckets = new Map<string, Record<string, number>>();
  const heldBuckets = new Map<string, Record<string, number>>();

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const idRaw = String(row.id ?? "").trim();
      let label = String(row.label ?? "")
        .trim()
        .replace(/\s+/g, " ");
      if (!label) continue;

      const lpNorm = label.toLowerCase().replace(/\s+/g, " ");
      if (idRaw === "auth_jco" || lpNorm === "jco") label = "DAD";
      else if (idRaw === "auth_others" || lpNorm === "others" || lpNorm === "other")
        label = "RT";
      else if (
        idRaw === "auth_nco" ||
        idRaw === "auth_asi" ||
        idRaw === "auth_si" ||
        lpNorm === "nco" ||
        lpNorm === "si"
      )
        label = "SI";
      else if (
        idRaw === "auth_lnco" ||
        idRaw === "auth_aasi" ||
        lpNorm === "lnco" ||
        lpNorm === "aasi" ||
        label === "এএএসআই"
      )
        label = "ASI";
      else if (
        idRaw === "auth_lpe" ||
        lpNorm === "lp(e)" ||
        lpNorm === "lpe" ||
        lpNorm === "lp (e)" ||
        idRaw === "auth_nce" ||
        idRaw === "auth_ance" ||
        lpNorm === "nc(e)" ||
        lpNorm === "nce" ||
        lpNorm === "ance"
      )
        label = "NCE";
      else if (idRaw === "auth_or" || lpNorm === "or" || lpNorm === "co")
        label = "Constable";
      else if (idRaw === "auth_nayek" || lpNorm === "nayek") label = "Naik";
      else if (
        idRaw === "auth_civil" ||
        idRaw === "auth_civill" ||
        lpNorm === "civil" ||
        lpNorm === "civill"
      )
        label = "Civil";
      else if (idRaw === "auth_officer" || lpNorm === "officer") label = "Officer";
      else if (idRaw === "auth_attached" || lpNorm === "attached")
        label = "Attached";
      else {
        const mapped = AUTHORIZED_LABEL_MIGRATE[lpNorm];
        if (mapped === "") continue;
        if (mapped) label = mapped;
      }

      const key = label.toLowerCase();
      const wings = parseAuthorizedWings(row.wings);
      wingBuckets.set(key, mergeWingMaps(wingBuckets.get(key) ?? {}, wings));

      if (key === "officer") {
        let heldMap = parseAuthorizedWings(row.held_wings);
        // Legacy single HQ held → Admin bucket once.
        if (Object.keys(heldMap).length === 0) {
          const legacy = Number(row.held);
          if (Number.isFinite(legacy) && legacy > 0) {
            heldMap = { Admin: Math.floor(legacy) };
          }
        }
        heldBuckets.set(
          key,
          mergeWingMaps(heldBuckets.get(key) ?? {}, heldMap),
        );
      }
    }
  }

  const officerWings = wingBuckets.get("officer") ?? {};
  const officerHeld = heldBuckets.get("officer") ?? {};
  const out: {
    id: string;
    label: string;
    count: number;
    wings: Record<string, number>;
    held_wings?: Record<string, number>;
  }[] = [
    {
      id: "auth_officer",
      label: "Officer",
      count: sumAuthorizedWings(officerWings),
      wings: officerWings,
      held_wings: officerHeld,
    },
  ];

  for (const rank of ranks) {
    const key = rank.toLowerCase();
    const wings = wingBuckets.get(key) ?? {};
    out.push({
      id: authorizedIdForLabel(rank),
      label: rank,
      count: sumAuthorizedWings(wings),
      wings,
    });
  }

  if (out.length === 1 && ranks.length === 0 && Array.isArray(raw) && raw.length === 0) {
    return [];
  }
  if (out.length === 1 && ranks.length === 0) {
    return DEFAULT_AUTHORIZED.map((row) => ({ ...row, wings: { ...row.wings } }));
  }
  return out;
}

/** Old seed put same full ladder under every force. */
function isUniformLegacyForceRanks(
  raw: unknown,
  forces: string[],
  ranks: string[],
): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const src = raw as Record<string, unknown>;
  const expect = new Set(ranks.map((r) => r.toLowerCase()));
  if (expect.size === 0) return false;
  for (const force of forces) {
    const list = Array.isArray(src[force]) ? src[force] : null;
    if (!list || list.length !== ranks.length) return false;
    const have = new Set(
      list.map((item) =>
        String(item ?? "")
          .trim()
          .replace(/\s+/g, " ")
          .toLowerCase(),
      ),
    );
    if (have.size !== expect.size) return false;
    for (const key of expect) {
      if (!have.has(key)) return false;
    }
  }
  return true;
}

/** Old dump put SRB catalog under every Force — migrate to service ladders. */
function forcesHoldStaleRabRanks(
  raw: unknown,
  forces: string[],
): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const src = raw as Record<string, unknown>;
  const rab = new Set(RANKS.map((r) => r.toLowerCase()));
  for (const force of forces) {
    const ladder =
      FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? null;
    if (!ladder || ladder.length === 0) continue;
    const ladderSet = new Set(ladder.map((r) => r.toLowerCase()));
    const list = Array.isArray(src[force]) ? src[force] : [];
    for (const item of list) {
      const key = String(item ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
      if (!key) continue;
      if (rab.has(key) && !ladderSet.has(key)) return true;
    }
  }
  return false;
}

/** Old Army officer ladder (MWO / 2/Lt / Gen…) → new enlisted + trade list. */
function forcesHoldLegacyArmyRanks(
  raw: unknown,
  forces: string[],
): boolean {
  if (!forces.includes("Army")) return false;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const src = raw as Record<string, unknown>;
  const list = Array.isArray(src.Army) ? src.Army : [];
  if (list.length === 0) return false;
  const armySet = new Set(
    FORCE_DEFAULT_RANKS.Army.map((r) => r.toLowerCase()),
  );
  const legacyOnly = new Set(
    LEGACY_ARMY_RANKS.filter((r) => !armySet.has(r.toLowerCase())).map((r) =>
      r.toLowerCase(),
    ),
  );
  for (const item of list) {
    const key = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (key && legacyOnly.has(key)) return true;
  }
  // Partial migrate: shared codes kept, new trades (SWO…) missing
  const stored = new Set(
    list
      .map((item) =>
        String(item ?? "")
          .trim()
          .replace(/\s+/g, " ")
          .toLowerCase(),
      )
      .filter(Boolean),
  );
  if (!stored.has("swo") && stored.has("or") && stored.has("wo")) {
    return true;
  }
  return false;
}

/** Old Navy officer ladder (MCPO / SLt / Adm…) → new ratings + trades. */
function forcesHoldLegacyNavyRanks(
  raw: unknown,
  forces: string[],
): boolean {
  if (!forces.includes("Navy")) return false;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const src = raw as Record<string, unknown>;
  const list = Array.isArray(src.Navy) ? src.Navy : [];
  if (list.length === 0) return false;
  const navySet = new Set(
    FORCE_DEFAULT_RANKS.Navy.map((r) => r.toLowerCase()),
  );
  const legacyOnly = new Set(
    LEGACY_NAVY_RANKS.filter((r) => !navySet.has(r.toLowerCase())).map((r) =>
      r.toLowerCase(),
    ),
  );
  for (const item of list) {
    const key = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (key && legacyOnly.has(key)) return true;
  }
  return false;
}

/** Old Air Force officer ladder (FS / Plt Off / ACM…) → new airman + trade list. */
function forcesHoldLegacyAirForceRanks(
  raw: unknown,
  forces: string[],
): boolean {
  if (!forces.includes("Air Force")) return false;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const src = raw as Record<string, unknown>;
  const list = Array.isArray(src["Air Force"]) ? src["Air Force"] : [];
  if (list.length === 0) return false;
  const airSet = new Set(
    FORCE_DEFAULT_RANKS["Air Force"].map((r) => r.toLowerCase()),
  );
  const legacyOnly = new Set(
    LEGACY_AIR_FORCE_RANKS.filter((r) => !airSet.has(r.toLowerCase())).map(
      (r) => r.toLowerCase(),
    ),
  );
  for (const item of list) {
    const key = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (key && legacyOnly.has(key)) return true;
  }
  return false;
}

function forcesHoldLegacyForceLadder(
  raw: unknown,
  forces: string[],
  force: string,
  legacyRanks: readonly string[],
): boolean {
  if (!forces.includes(force)) return false;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const src = raw as Record<string, unknown>;
  const list = Array.isArray(src[force]) ? src[force] : [];
  if (list.length === 0) return false;
  const current = FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? [];
  const currentSet = new Set(current.map((r) => r.toLowerCase()));
  const legacyOnly = new Set(
    legacyRanks
      .filter((r) => !currentSet.has(r.toLowerCase()))
      .map((r) => r.toLowerCase()),
  );
  for (const item of list) {
    const key = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (key && legacyOnly.has(key)) return true;
  }
  return false;
}

function ensureWingParent(
  raw: unknown,
  wings: string[],
): Record<string, string> {
  const wingSet = new Set(wings);
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Record<string, string> = {};
  for (const [childRaw, parentRaw] of Object.entries(src)) {
    const child = canonicalWingName(
      String(childRaw ?? "")
        .trim()
        .replace(/\s+/g, " "),
    );
    const parent = canonicalWingName(
      String(parentRaw ?? "")
        .trim()
        .replace(/\s+/g, " "),
    );
    if (!child || !parent) continue;
    if (!wingSet.has(child) || !wingSet.has(parent)) continue;
    if (child.toLowerCase() === parent.toLowerCase()) continue;
    out[child] = parent;
  }
  for (const child of Object.keys(out)) {
    const seen = new Set<string>();
    let cur: string | undefined = child;
    let cyclic = false;
    while (cur) {
      if (seen.has(cur)) {
        cyclic = true;
        break;
      }
      seen.add(cur);
      cur = out[cur];
    }
    if (cyclic) delete out[child];
  }
  for (const [child, parent] of Object.entries(DEFAULT_WING_PARENT)) {
    if (!wingSet.has(child) || !wingSet.has(parent)) continue;
    out[child] = parent;
  }
  return out;
}

function ensureForces(raw: unknown): string[] {
  if (isLegacyForces(raw) || !Array.isArray(raw)) return [...FORCES];
  const seen = new Set<string>();
  const stored: string[] = [];
  for (const item of raw) {
    const label = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    stored.push(label);
  }
  return stored.length ? stored : [...FORCES];
}

function ensureForceLabels(
  raw: unknown,
  forces: string[],
): Record<string, string> {
  const remapped = remapWingKeyedRecord(raw, (value) => {
    const label = String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
    return label || undefined;
  });
  const out = ensureRankLabels(remapped, forces);
  for (const force of forces) {
    const catalog = FORCE_LABELS[force];
    if (!catalog) continue;
    if (!(out[force] ?? "").trim()) out[force] = catalog;
  }
  return out;
}

function ensureForceLabelsBn(
  raw: unknown,
  forces: string[],
): Record<string, string> {
  const remapped = remapWingKeyedRecord(raw, (value) => {
    const label = String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
    return label || undefined;
  });
  const out = ensureRankLabels(remapped, forces);
  for (const force of forces) {
    const catalog = FORCE_LABELS_BN[force];
    if (!catalog) continue;
    if (!(out[force] ?? "").trim()) out[force] = catalog;
  }
  return out;
}

function ensureForceSerials(
  raw: unknown,
  forces: string[],
): Record<string, number> {
  const allowed = new Set(forces.map((f) => f.toLowerCase()));
  const remapped = remapWingKeyedRecord(raw, (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.floor(n);
  });
  const out: Record<string, number> = {};
  for (const [short, n] of Object.entries(remapped)) {
    if (!allowed.has(short.toLowerCase())) continue;
    out[short] = n;
  }
  for (const [force, serial] of Object.entries(FORCE_CATALOG_SERIALS)) {
    if (!allowed.has(force.toLowerCase())) continue;
    if (out[force] == null) out[force] = serial;
  }
  return out;
}

function ensureRanks(raw: unknown): string[] {
  // Always keep core SRB catalog; append user-added ranks after.
  if (isLegacyRanks(raw)) return [...RANKS];
  const base: string[] = [...RANKS];
  const seen = new Set<string>(base.map((r) => r.toLowerCase()));
  if (!Array.isArray(raw)) return base;
  const catalog = raw.map((item) => String(item ?? "").trim());
  for (const item of raw) {
    const label = canonicalRankName(
      String(item ?? "")
        .trim()
        .replace(/\s+/g, " "),
      catalog,
    );
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    base.push(label);
  }
  return base;
}

function ensureSrbRankLabels(
  raw: unknown,
  ranks: string[],
): Record<string, string> {
  const remapped = remapRankKeyedRecord(raw, (value) => {
    const label = String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
    return label || undefined;
  });
  const out = ensureRankLabels(remapped, ranks);
  for (const rank of ranks) {
    const catalog = RANK_LABELS[rank];
    if (!catalog) continue;
    if (!(out[rank] ?? "").trim()) out[rank] = catalog;
  }
  return out;
}

function ensureSrbRankLabelsBn(
  raw: unknown,
  ranks: string[],
): Record<string, string> {
  const remapped = remapRankKeyedRecord(raw, (value) => {
    const label = String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
    return label || undefined;
  });
  const out = ensureRankLabels(remapped, ranks);
  for (const rank of ranks) {
    const catalog = RANK_LABELS_BN[rank];
    if (!catalog) continue;
    const current = (out[rank] ?? "").trim();
    if (!current) {
      out[rank] = catalog;
      continue;
    }
    if (rank === "SI" && (current === "এএসআই" || current.toLowerCase() === "asi")) {
      out[rank] = catalog;
      continue;
    }
    if (
      rank === "ASI" &&
      (current === "এসআই" ||
        current === "এএএসআই" ||
        current.toLowerCase() === "aasi")
    ) {
      out[rank] = catalog;
      continue;
    }
    if (rank === "Cook") {
      out[rank] = catalog;
    }
  }
  return out;
}

function ensureSrbRankSerials(
  raw: unknown,
  ranks: string[],
): Record<string, number> {
  const allowed = new Set(ranks.map((r) => r.toLowerCase()));
  const remapped = remapRankKeyedRecord(raw, (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.floor(n);
  });
  const out: Record<string, number> = {};
  for (const [short, n] of Object.entries(remapped)) {
    if (!allowed.has(short.toLowerCase())) continue;
    out[short] = n;
  }
  for (const [rank, serial] of Object.entries(RANK_CATALOG_SERIALS)) {
    if (!allowed.has(rank.toLowerCase())) continue;
    if (out[rank] == null) out[rank] = serial;
  }
  return out;
}

function remapRankKeyedRecord<T>(
  raw: unknown,
  mapValue: (value: unknown) => T | undefined,
): Record<string, T> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const catalog = Object.keys(raw as Record<string, unknown>);
  const out: Record<string, T> = {};
  for (const [short, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = canonicalRankName(
      String(short ?? "")
        .trim()
        .replace(/\s+/g, " "),
      catalog,
    );
    if (!key) continue;
    const next = mapValue(value);
    if (next === undefined) continue;
    out[key] = next;
  }
  return out;
}

function ensureForceRankExtras(
  raw: unknown,
  forces: string[],
): Record<string, string[]> {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Record<string, string[]> = {};
  for (const force of forces) {
    const ladder =
      FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? [];
    const ladderSet = new Set(ladder.map((r) => r.toLowerCase()));
    const list = Array.isArray(src[force]) ? src[force] : [];
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const label = canonicalForceServiceRank(
        String(item ?? "")
          .trim()
          .replace(/\s+/g, " "),
      );
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key) || ladderSet.has(key)) continue;
      seen.add(key);
      cleaned.push(label);
    }
    out[force] = cleaned;
  }
  return out;
}


function ensureForceRankRemoved(
  raw: unknown,
  forces: string[],
): Record<string, string[]> {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Record<string, string[]> = {};
  for (const force of forces) {
    const list = Array.isArray(src[force]) ? src[force] : [];
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const label = canonicalForceServiceRank(
        String(item ?? "")
          .trim()
          .replace(/\s+/g, " "),
      );
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(label);
    }
    out[force] = cleaned;
  }
  return out;
}

function ensureForceRankLabels(
  raw: unknown,
  forces: string[],
  extras: Record<string, string[]>,
  removed: Record<string, string[]>,
): Record<string, Record<string, string>> {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Record<string, Record<string, string>> = {};
  for (const force of forces) {
    const allowed = new Set(
      forceRankChoices(force, [], extras[force] ?? [], removed[force] ?? []).map((r) =>
        r.toLowerCase(),
      ),
    );
    const forceSrc =
      src[force] && typeof src[force] === "object" && !Array.isArray(src[force])
        ? (src[force] as Record<string, unknown>)
        : {};
    const labels: Record<string, string> = {};
    for (const [short, long] of Object.entries(forceSrc)) {
      const s = canonicalForceServiceRank(
        String(short ?? "")
          .trim()
          .replace(/\s+/g, " "),
      );
      const l = String(long ?? "")
        .trim()
        .replace(/\s+/g, " ");
      if (!s || !l) continue;
      if (!allowed.has(s.toLowerCase())) continue;
      labels[s] = l;
    }
    const catalog = FORCE_RANK_LABELS[force as (typeof FORCES)[number]] ?? {};
    for (const [short, long] of Object.entries(catalog)) {
      if (!allowed.has(short.toLowerCase())) continue;
      const have = (labels[short] ?? "").trim();
      if (!have || have.toLowerCase() === short.toLowerCase()) {
        labels[short] = long;
      }
    }
    out[force] = labels;
  }
  return out;
}

function ensureForceRankLabelsBn(
  raw: unknown,
  forces: string[],
  extras: Record<string, string[]>,
  removed: Record<string, string[]>,
): Record<string, Record<string, string>> {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Record<string, Record<string, string>> = {};
  for (const force of forces) {
    const allowed = new Set(
      forceRankChoices(force, [], extras[force] ?? [], removed[force] ?? []).map(
        (r) => r.toLowerCase(),
      ),
    );
    const forceSrc =
      src[force] && typeof src[force] === "object" && !Array.isArray(src[force])
        ? (src[force] as Record<string, unknown>)
        : {};
    const labels: Record<string, string> = {};
    for (const [short, long] of Object.entries(forceSrc)) {
      const s = canonicalForceServiceRank(
        String(short ?? "")
          .trim()
          .replace(/\s+/g, " "),
      );
      const l = String(long ?? "")
        .trim()
        .replace(/\s+/g, " ");
      if (!s || !l) continue;
      if (!allowed.has(s.toLowerCase())) continue;
      labels[s] = l;
    }
    const catalog = FORCE_RANK_LABELS_BN[force as (typeof FORCES)[number]] ?? {};
    for (const [short, long] of Object.entries(catalog)) {
      if (!allowed.has(short.toLowerCase())) continue;
      const current = (labels[short] ?? "").trim();
      if (!current || current.includes("মেসেঞ্জার")) labels[short] = long;
    }
    out[force] = labels;
  }
  return out;
}

function ensureForceRankSerials(
  raw: unknown,
  forces: string[],
  extras: Record<string, string[]>,
  removed: Record<string, string[]>,
): Record<string, Record<string, number>> {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Record<string, Record<string, number>> = {};
  for (const force of forces) {
    const choices = forceRankChoices(
      force,
      [],
      extras[force] ?? [],
      removed[force] ?? [],
    );
    const allowed = new Set(choices.map((r) => r.toLowerCase()));
    const forceSrc =
      src[force] && typeof src[force] === "object" && !Array.isArray(src[force])
        ? (src[force] as Record<string, unknown>)
        : {};
    const serials: Record<string, number> = {};
    for (const [short, value] of Object.entries(forceSrc)) {
      const s = canonicalForceServiceRank(
        String(short ?? "")
          .trim()
          .replace(/\s+/g, " "),
      );
      const n = Number(value);
      if (!s || !allowed.has(s.toLowerCase())) continue;
      if (!Number.isFinite(n) || n <= 0) continue;
      serials[s] = Math.floor(n);
    }
    const catalog = FORCE_RANK_SERIALS[force] ?? {};
    for (const [short, n] of Object.entries(catalog)) {
      if (!allowed.has(short.toLowerCase())) continue;
      if (serials[short] == null) serials[short] = n;
    }
    let next = Math.max(0, ...Object.values(serials), 0) + 1;
    for (const rank of choices) {
      if (serials[rank] == null) {
        serials[rank] = next;
        next += 1;
      }
    }
    out[force] = serials;
  }
  return out;
}

function ensureRankLabels(
  raw: unknown,
  ranks: string[],
): Record<string, string> {
  const allowed = new Set(ranks.map((r) => r.toLowerCase()));
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Record<string, string> = {};
  for (const [short, long] of Object.entries(src)) {
    const s = String(short ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const l = String(long ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!s || !l) continue;
    if (!allowed.has(s.toLowerCase())) continue;
    out[s] = l;
  }
  return out;
}

function remapWingKeyedRecord<T>(
  raw: unknown,
  mapValue: (value: unknown) => T | undefined,
): Record<string, T> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, T> = {};
  for (const [short, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = canonicalWingName(
      String(short ?? "")
        .trim()
        .replace(/\s+/g, " "),
    );
    if (!key) continue;
    const next = mapValue(value);
    if (next === undefined) continue;
    out[key] = next;
  }
  return out;
}

function ensureWingLabels(
  raw: unknown,
  wings: string[],
): Record<string, string> {
  const remapped = remapWingKeyedRecord(raw, (value) => {
    const label = String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
    return label || undefined;
  });
  const out = ensureRankLabels(remapped, wings);
  for (const wing of [...WINGS, ...ADMIN_SUB_WINGS, ...HQ_SUB_WINGS]) {
    const catalog = WING_LABELS[wing];
    if (!catalog) continue;
    const current = (out[wing] ?? "").trim();
    if (
      !current ||
      current.toLowerCase() === wing.toLowerCase() ||
      current.toLowerCase() === "admin wing" ||
      current.toLowerCase() === "training school" ||
      current.toLowerCase() === "director (admin) office"
    ) {
      out[wing] = catalog;
    }
  }
  return out;
}

function ensureWingLabelsBn(
  raw: unknown,
  wings: string[],
): Record<string, string> {
  const remapped = remapWingKeyedRecord(raw, (value) => {
    const label = String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
    return label || undefined;
  });
  const out = ensureRankLabels(remapped, wings);
  for (const wing of [...WINGS, ...ADMIN_SUB_WINGS, ...HQ_SUB_WINGS]) {
    const catalog = WING_LABELS_BN[wing];
    if (!catalog) continue;
    if (!(out[wing] ?? "").trim()) out[wing] = catalog;
  }
  return out;
}

function ensureWingSerials(
  raw: unknown,
  wings: string[],
): Record<string, number> {
  const allowed = new Set(wings.map((w) => w.toLowerCase()));
  const remapped = remapWingKeyedRecord(raw, (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.floor(n);
  });
  const out: Record<string, number> = {};
  for (const [short, n] of Object.entries(remapped)) {
    if (!allowed.has(short.toLowerCase())) continue;
    out[short] = n;
  }
  for (const [wing, serial] of Object.entries(WING_CATALOG_SERIALS)) {
    if (!allowed.has(wing.toLowerCase())) continue;
    if (out[wing] == null) out[wing] = serial;
  }
  return out;
}

/** Keep known forces; ladder ranks + user extras allowed. */
function ensureForceRanks(
  raw: unknown,
  forces: string[],
  ranks: string[],
  extras: Record<string, string[]>,
  removed: Record<string, string[]>,
): Record<string, string[]> {
  const rankSet = new Set(ranks.map((r) => r.toLowerCase()));
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Record<string, string[]> = {};
  for (const force of forces) {
    const list = Array.isArray(src[force]) ? src[force] : [];
    const choices = forceRankChoices(
      force,
      ranks,
      extras[force] ?? [],
      removed[force] ?? [],
    );
    const choiceByKey = new Map(
      choices.map((r) => [r.toLowerCase(), r] as const),
    );
    const hasDefaultLadder = Boolean(
      FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]],
    );
    if ((PINNED_FORCE_LADDERS as readonly string[]).includes(force)) {
      const removedSet = new Set(
        (removed[force] ?? []).map((r) => r.toLowerCase()),
      );
      const official = (
        FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? []
      ).filter((r) => !removedSet.has(r.toLowerCase()));
      const officialSet = new Set(
        (FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? []).map((r) =>
          r.toLowerCase(),
        ),
      );
      const extra = (extras[force] ?? []).filter(
        (r) => !officialSet.has(r.toLowerCase()),
      );
      out[force] = [...official, ...extra];
      continue;
    }

    if (hasDefaultLadder || choices.length > 0) {
      const kept: string[] = [];
      const seen = new Set<string>();
      for (const item of list) {
        const label = canonicalForceServiceRank(
          String(item ?? "")
            .trim()
            .replace(/\s+/g, " "),
        );
        if (!label) continue;
        const canon = choiceByKey.get(label.toLowerCase());
        if (!canon) continue;
        if (seen.has(canon.toLowerCase())) continue;
        seen.add(canon.toLowerCase());
        kept.push(canon);
      }
      if (kept.length === 0 && hasDefaultLadder) {
        out[force] = [
          ...(FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? []),
        ];
      } else {
        out[force] = choices.filter((r) => kept.includes(r));
      }
      continue;
    }

    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const label = String(item ?? "")
        .trim()
        .replace(/\s+/g, " ");
      if (!label || !rankSet.has(label.toLowerCase())) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(label);
    }
    out[force] = cleaned;
  }
  return out;
}

/** Keep only known ranks; force values must exist in `forces`. */
function ensureRankForces(
  raw: unknown,
  ranks: string[],
  forces: string[],
): Record<string, string[]> {
  const forceSet = new Set(forces);
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Record<string, string[]> = {};
  for (const rank of ranks) {
    const rawList =
      src[rank] ??
      src[Object.keys(src).find((k) => canonicalRankName(k, Object.keys(src)) === rank) ?? ""];
    const list = Array.isArray(rawList) ? rawList : [];
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const label = String(item ?? "")
        .trim()
        .replace(/\s+/g, " ");
      if (!label || !forceSet.has(label)) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(label);
    }
    out[rank] = cleaned;
  }
  return out;
}

/** Keep SRB rank → force → service-rank equivalents in sync. */
function ensureRankEquivalents(
  raw: unknown,
  ranks: string[],
  forces: string[],
  extras: Record<string, string[]>,
  removed: Record<string, string[]>,
): Record<string, Record<string, string[]>> {
  const forceSet = new Set(forces);
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Record<string, Record<string, string[]>> = {};
  for (const rank of ranks) {
    const rawRank =
      src[rank] ??
      src[Object.keys(src).find((k) => canonicalRankName(k, Object.keys(src)) === rank) ?? ""];
    const rankSrc =
      rawRank && typeof rawRank === "object" && !Array.isArray(rawRank)
        ? (rawRank as Record<string, unknown>)
        : {};
    const byForce: Record<string, string[]> = {};
    for (const force of forces) {
      if (!forceSet.has(force)) continue;
      const choices = forceRankChoices(
      force,
      ranks,
      extras[force] ?? [],
      removed[force] ?? [],
    );
      const choiceByKey = new Map(
        choices.map((r) => [r.toLowerCase(), r] as const),
      );
      const list = Array.isArray(rankSrc[force]) ? rankSrc[force] : [];
      const cleaned: string[] = [];
      const seen = new Set<string>();
      for (const item of list) {
        const label = canonicalForceServiceRank(
          String(item ?? "")
            .trim()
            .replace(/\s+/g, " "),
        );
        if (!label) continue;
        const canon = choiceByKey.get(label.toLowerCase());
        if (!canon) continue;
        if (seen.has(canon.toLowerCase())) continue;
        seen.add(canon.toLowerCase());
        cleaned.push(canon);
      }
      if (cleaned.length > 0) byForce[force] = cleaned;
    }
    out[rank] = byForce;
  }
  return out;
}

/** Keep rank → force → wings in sync with known labels. */
function ensureRankForceWings(
  raw: unknown,
  ranks: string[],
  forces: string[],
  wings: string[],
  rankForces: Record<string, string[]>,
): Record<string, Record<string, string[]>> {
  const wingSet = new Set(wings);
  const forceSet = new Set(forces);
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Record<string, Record<string, string[]>> = {};
  for (const rank of ranks) {
    const rawRank =
      src[rank] ??
      src[Object.keys(src).find((k) => canonicalRankName(k, Object.keys(src)) === rank) ?? ""];
    const rankSrc =
      rawRank && typeof rawRank === "object" && !Array.isArray(rawRank)
        ? (rawRank as Record<string, unknown>)
        : {};
    const byForce: Record<string, string[]> = {};
    const assignedForces = rankForces[rank] ?? [];
    for (const force of assignedForces) {
      if (!forceSet.has(force)) continue;
      const list = Array.isArray(rankSrc[force]) ? rankSrc[force] : [];
      const cleaned: string[] = [];
      const seen = new Set<string>();
      for (const item of list) {
        const label = canonicalWingName(
          String(item ?? "")
            .trim()
            .replace(/\s+/g, " "),
        );
        if (!label || !wingSet.has(label)) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(label);
      }
      byForce[force] = cleaned;
    }
    out[rank] = byForce;
  }
  return out;
}

function ensureRateOnlyRates(rates: AllowanceRate[]): AllowanceRate[] {
  const next = rates
    .filter((r) => r.tag.toLowerCase() !== CL_FR_MONTHLY_TAG.toLowerCase())
    .map((r) => ({
      ...r,
      amount_per_day: parseMoney(r.amount_per_day),
    }));
  for (const builtIn of DAILY_TAGS) {
    const exists = next.some(
      (r) => r.tag.toLowerCase() === builtIn.code.toLowerCase(),
    );
    if (!exists) {
      next.push({
        tag: builtIn.code,
        amount_per_day: builtIn.allowance
          ? builtIn.code === "MS"
            ? 180
            : 220
          : 0,
      });
    }
  }
  for (const only of RATE_ONLY_TAGS) {
    const exists = next.some(
      (r) => r.tag.toLowerCase() === only.code.toLowerCase(),
    );
    if (!exists) {
      next.push({ tag: only.code, amount_per_day: only.defaultAmount });
    }
  }
  return next;
}

function readStorage(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: AppState | null = null;

export function flushStorage() {
  if (!pendingState || typeof window === "undefined") return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(pendingState));
  } catch {
    // Ignore quota errors
  }
  pendingState = null;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
}

function writeStorage(state: AppState) {
  if (typeof window === "undefined") return;
  pendingState = state;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flushStorage, 50);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushStorage);
}

/** Version check only — not a type predicate (stale disk is still AppState). */
function isCurrentSeed(state: AppState | null): boolean {
  return !!state && (state.version ?? 0) >= SEED_VERSION;
}

export function getState(): AppState {
  if (typeof window !== "undefined" && isCcApiEnabled()) {
    apiBacked = true;
  }
  if (memory && isCurrentSeed(memory)) {
    const hasBanned = memory.wings.some((w) => {
      const key = w.toLowerCase();
      if (HQ_SUB_WINGS.some((wing) => wing.toLowerCase() === key)) return false;
      if (ADMIN_SUB_WINGS.some((wing) => wing.toLowerCase() === key)) return false;
      if (WINGS.some((wing) => wing.toLowerCase() === key)) return false;
      return [...LEGACY_WINGS, ...LEGACY_FORM1_WINGS, ...DROPPED_MAIN_WINGS].some(
        (b) => b.toLowerCase() === key,
      );
    });
    const catalogMetaMissing =
      !memory.wing_labels_bn || !memory.wing_serials;
    const officialLabelsStale = WINGS.some((wing) => {
      const want = WING_LABELS[wing];
      if (!want) return false;
      const have = (memory!.wing_labels[wing] ?? "").trim();
      return (
        !have ||
        have.toLowerCase() === wing.toLowerCase() ||
        have.toLowerCase() === "admin wing" ||
        have.toLowerCase() === "training school"
      );
    });
    const officialSubs = [...ADMIN_SUB_WINGS, ...HQ_SUB_WINGS];
    const haveWings = new Set(memory.wings.map((w) => w.toLowerCase()));
    const adminHqCatalogStale =
      officialSubs.some((wing) => !haveWings.has(wing.toLowerCase())) ||
      HQ_SUB_WINGS.some((wing) => memory!.wing_parent[wing] !== "HQ Br") ||
      officialSubs.some((wing) => memory!.wing_serials?.[wing] == null) ||
      officialSubs.some(
        (wing) => !(memory!.wing_labels_bn?.[wing] ?? "").trim(),
      );
    const officialServiceRanksStale = PINNED_FORCE_LADDERS.some((force) => {
      const removed = new Set(
        (memory!.force_rank_removed[force] ?? []).map((r) =>
          canonicalForceServiceRank(r).toLowerCase(),
        ),
      );
      const have = (memory!.force_ranks[force] ?? []).map((r) =>
        canonicalForceServiceRank(r.trim()).toLowerCase(),
      );
      const haveSet = new Set(have);
      const want = FORCE_DEFAULT_RANKS[force] ?? [];
      const missingOfficial = want.some(
        (rank) =>
          !removed.has(rank.toLowerCase()) && !haveSet.has(rank.toLowerCase()),
      );
      const hasLegacyLong = (memory!.force_ranks[force] ?? []).some((r) =>
        Boolean(
          FORCE_RANK_SHORT_RENAMES[r.trim().replace(/\s+/g, " ").toLowerCase()],
        ),
      );
      return missingOfficial || hasLegacyLong;
    });
    const forceRankCatalogMetaMissing = PINNED_FORCE_LADDERS.some((force) => {
      const removed = new Set(
        (memory!.force_rank_removed[force] ?? []).map((r) =>
          canonicalForceServiceRank(r).toLowerCase(),
        ),
      );
      const want = (FORCE_DEFAULT_RANKS[force] ?? []).filter(
        (rank) => !removed.has(rank.toLowerCase()),
      );
      const bn = memory!.force_rank_labels_bn?.[force] ?? {};
      const serials = memory!.force_rank_serials?.[force] ?? {};
      return want.some(
        (rank) =>
          !(bn[rank] ?? "").trim() ||
          (bn[rank] ?? "").includes("মেসেঞ্জার") ||
          serials[rank] == null,
      );
    });
    const forceCatalogMetaMissing =
      !memory.force_labels_bn ||
      !memory.force_serials ||
      memory.forces.some((force) => memory!.force_serials?.[force] == null);
    const rankCatalogMetaMissing =
      !memory.rank_labels_bn ||
      !memory.rank_serials ||
      memory.ranks.some((rank) => memory!.rank_serials?.[rank] == null);
    const officialSrbRanksStale =
      isPreviousSrbRankCatalog(memory!.ranks) ||
      RANKS.some(
        (rank) =>
          !memory!.ranks.some((have) => have.toLowerCase() === rank.toLowerCase()),
      );
    const authStale = memory.authorized.some((row) => {
      const wings = row.wings ?? {};
      if (Object.keys(wings).length === 0) return false;
      const sum = sumAuthorizedWings(wings);
      return row.count !== sum;
    });
    const shortRequestQueues =
      !apiBacked &&
      (["daily", "ration", "consume"] as const).some(
        (queue) =>
          memory!.tag_requests.filter((r) => (r.queue ?? "daily") === queue)
            .length < MIN_TAG_REQUESTS_PER_QUEUE,
      );
    if (
      !catalogHealed &&
      (hasBanned ||
        officialLabelsStale ||
        adminHqCatalogStale ||
        forceCatalogMetaMissing ||
        rankCatalogMetaMissing ||
        officialSrbRanksStale ||
        officialServiceRanksStale ||
        forceRankCatalogMetaMissing ||
        catalogMetaMissing ||
        authStale ||
        shortRequestQueues ||
        (!apiBacked && isLegacyDemoSenders(memory.senders)))
    ) {
      catalogHealed = true;
      memory = normalizeState(memory);
      writeStorage(memory);
      if (!persistPaused) persistHook?.(memory);
    }
    return memory;
  }

  const fromDisk = readStorage();
  if (fromDisk && isCurrentSeed(fromDisk)) {
    catalogHealed = true;
    memory = normalizeState(
      isCcApiEnabled()
        ? {
            ...fromDisk,
            users: [],
            assignments: [],
            tag_requests: [],
            pritibhoj_events: [],
          }
        : fromDisk,
    );
    writeStorage(memory);
    return memory;
  }

  // Stale / missing seed version → live catalog when API is on, else demo reseed.
  const seeded = isCcApiEnabled() ? createLiveCatalogState() : createSeedState();
  if (fromDisk && Array.isArray(fromDisk.authorized) && fromDisk.authorized.length) {
    seeded.authorized = ensureAuthorized(
      fromDisk.authorized,
      seeded.ranks ?? [],
    );
  }
  if (
    fromDisk &&
    fromDisk.manpower_officer_absent &&
    typeof fromDisk.manpower_officer_absent === "object"
  ) {
    seeded.manpower_officer_absent = fromDisk.manpower_officer_absent;
  }
  if (fromDisk && fromDisk.manpower_held && typeof fromDisk.manpower_held === "object") {
    seeded.manpower_held = fromDisk.manpower_held;
  }
  if (
    fromDisk &&
    fromDisk.manpower_absent &&
    typeof fromDisk.manpower_absent === "object"
  ) {
    seeded.manpower_absent = fromDisk.manpower_absent;
  }
  if (
    fromDisk &&
    fromDisk.manpower_present &&
    typeof fromDisk.manpower_present === "object"
  ) {
    seeded.manpower_present = fromDisk.manpower_present;
  }
  if (
    fromDisk &&
    fromDisk.manpower_absence_detail &&
    typeof fromDisk.manpower_absence_detail === "object"
  ) {
    seeded.manpower_absence_detail = fromDisk.manpower_absence_detail;
  }
  if (
    fromDisk &&
    fromDisk.force_rank_officer &&
    typeof fromDisk.force_rank_officer === "object"
  ) {
    seeded.force_rank_officer = fromDisk.force_rank_officer;
  }
  if (
    fromDisk &&
    fromDisk.force_rank_cells &&
    typeof fromDisk.force_rank_cells === "object"
  ) {
    seeded.force_rank_cells = fromDisk.force_rank_cells;
  }
  catalogHealed = true;
  memory = seeded;
  writeStorage(seeded);
  return seeded;
}

function ensureCockpitPoliceMembers(users: User[]): User[] {
  const extras = extraCockpitPoliceMembers();
  if (extras.length === 0) return users;
  const ids = new Set(users.map((u) => u.id));
  const missing = extras.filter((u) => !ids.has(u.id));
  return missing.length ? [...users, ...missing] : users;
}

function ensureTrustFirewoodMembers(users: User[]): User[] {
  const extras = extraTrustFirewoodMembers();
  if (extras.length === 0) return users;
  const ids = new Set(users.map((u) => u.id));
  const missing = extras.filter((u) => !ids.has(u.id));
  return missing.length ? [...users, ...missing] : users;
}

function ensureTrustFirewoodAssignments(
  assignments: AppState["assignments"],
): AppState["assignments"] {
  const extras = extraTrustFirewoodAssignments();
  if (extras.length === 0) return assignments;
  const keys = new Set(assignments.map((a) => `${a.user_id}|${a.date}`));
  const missing = extras.filter((a) => !keys.has(`${a.user_id}|${a.date}`));
  return missing.length ? [...assignments, ...missing] : assignments;
}

function normalizeState(state: AppState): AppState {
  const member_banks = ensureMemberBanks(state.member_banks);
  const bankSet = new Map(
    member_banks.map((b) => [b.toLowerCase(), b] as const),
  );
  return {
    ...state,
    users: (() => {
      const mapped = (state.users ?? []).map((u) => {
      const legacy = u as LegacyUser;
      const {
        emergency_name: _n,
        emergency_relation: _r,
        emergency_phone: _p,
        ...rest
      } = legacy;
      const rawBank = String(legacy.bank_name ?? "").trim();
      const bank_name = bankSet.get(rawBank.toLowerCase()) ?? "";
      const member_type = legacy.member_type ?? "permanent";
      const rank = canonicalRankName(
        legacy.rank ?? "",
        Array.isArray(state.ranks) ? state.ranks.map(String) : undefined,
      );
      const force = canonicalForceName(legacy.force ?? "", rank, member_type);
      const storedForceRank = canonicalForceServiceRank(legacy.force_rank ?? "");
      return {
        ...rest,
        joining_date: legacy.joining_date ?? "",
        duty_start: legacy.duty_start ?? "",
        out_date: legacy.out_date ?? "",
        inactive_spans:
          Array.isArray(legacy.inactive_spans) && legacy.inactive_spans.length > 0
            ? legacy.inactive_spans
            : legacy.status !== "1"
              ? [{ from: legacy.joining_date || "2020-01-01", to: null }]
              : [],
        wing: canonicalWingName(legacy.wing ?? ""),
        rank,
        member_type,
        personal_id: legacy.personal_id ?? "",
        force,
        force_rank: storedForceRank || defaultForceRankForSrb(force, rank),
        religion: legacy.religion ?? "",
        blood_group: legacy.blood_group ?? "",
        jl_end_date: legacy.jl_end_date ?? "",
        branch_location: legacy.branch_location ?? "",
        bank_name,
        documents_verified: Boolean(
          (legacy as User & { documents_verified?: boolean }).documents_verified,
        ),
        emergency_contacts: normalizeEmergencyContacts(legacy),
      };
      });
      if (apiBacked || isCcApiEnabled()) return mapped;
      return ensureTrustFirewoodMembers(ensureCockpitPoliceMembers(mapped));
    })(),
    assignments:
      apiBacked || isCcApiEnabled()
        ? (state.assignments ?? [])
        : ensureTrustFirewoodAssignments(state.assignments ?? []),
    rates: ensureRateOnlyRates(state.rates ?? []),
    ranks: ensureRanks(state.ranks),
    wings: ensureWings(state.wings),
    wing_parent: (() => {
      const wings = ensureWings(state.wings);
      const raw = isLegacyWings(state.wings) ? {} : state.wing_parent;
      return ensureWingParent(raw, wings);
    })(),
    wing_labels: (() => {
      const wings = ensureWings(state.wings);
      return ensureWingLabels(state.wing_labels, wings);
    })(),
    wing_labels_bn: (() => {
      const wings = ensureWings(state.wings);
      return ensureWingLabelsBn(state.wing_labels_bn, wings);
    })(),
    wing_serials: (() => {
      const wings = ensureWings(state.wings);
      return ensureWingSerials(state.wing_serials, wings);
    })(),
    forces: ensureForces(state.forces),
    force_labels: (() => {
      const forces = ensureForces(state.forces);
      return ensureForceLabels(state.force_labels, forces);
    })(),
    force_labels_bn: (() => {
      const forces = ensureForces(state.forces);
      return ensureForceLabelsBn(state.force_labels_bn, forces);
    })(),
    force_serials: (() => {
      const forces = ensureForces(state.forces);
      return ensureForceSerials(state.force_serials, forces);
    })(),
    force_rank_extras: (() => {
      const forces = ensureForces(state.forces);
      return ensureForceRankExtras(state.force_rank_extras, forces);
    })(),
    force_rank_removed: (() => {
      const forces = ensureForces(state.forces);
      return ensureForceRankRemoved(state.force_rank_removed, forces);
    })(),
    force_rank_labels: (() => {
      const forces = ensureForces(state.forces);
      const extras = ensureForceRankExtras(state.force_rank_extras, forces);
      const removed = ensureForceRankRemoved(state.force_rank_removed, forces);
      return ensureForceRankLabels(
        state.force_rank_labels,
        forces,
        extras,
        removed,
      );
    })(),
    force_rank_labels_bn: (() => {
      const forces = ensureForces(state.forces);
      const extras = ensureForceRankExtras(state.force_rank_extras, forces);
      const removed = ensureForceRankRemoved(state.force_rank_removed, forces);
      return ensureForceRankLabelsBn(
        state.force_rank_labels_bn,
        forces,
        extras,
        removed,
      );
    })(),
    force_rank_serials: (() => {
      const forces = ensureForces(state.forces);
      const extras = ensureForceRankExtras(state.force_rank_extras, forces);
      const removed = ensureForceRankRemoved(state.force_rank_removed, forces);
      return ensureForceRankSerials(
        state.force_rank_serials,
        forces,
        extras,
        removed,
      );
    })(),
    rank_labels: (() => {
      const ranks = ensureRanks(state.ranks);
      return ensureSrbRankLabels(state.rank_labels, ranks);
    })(),
    rank_labels_bn: (() => {
      const ranks = ensureRanks(state.ranks);
      return ensureSrbRankLabelsBn(state.rank_labels_bn, ranks);
    })(),
    rank_serials: (() => {
      const ranks = ensureRanks(state.ranks);
      return ensureSrbRankSerials(state.rank_serials, ranks);
    })(),
    force_ranks: (() => {
      const ranks = ensureRanks(state.ranks);
      const forces = ensureForces(state.forces);
      const extras = ensureForceRankExtras(state.force_rank_extras, forces);
      const removed = ensureForceRankRemoved(state.force_rank_removed, forces);
      if (
        isLegacyForces(state.forces) ||
        isLegacyRanks(state.ranks) ||
        forcesHoldStaleRabRanks(state.force_ranks, forces) ||
        forcesHoldLegacyArmyRanks(state.force_ranks, forces) ||
        forcesHoldLegacyNavyRanks(state.force_ranks, forces) ||
        forcesHoldLegacyAirForceRanks(state.force_ranks, forces) ||
        forcesHoldLegacyForceLadder(
          state.force_ranks,
          forces,
          "BGB",
          LEGACY_BGB_RANKS,
        ) ||
        forcesHoldLegacyForceLadder(
          state.force_ranks,
          forces,
          "Police",
          LEGACY_POLICE_RANKS,
        ) ||
        forcesHoldLegacyForceLadder(
          state.force_ranks,
          forces,
          "Ansar",
          LEGACY_ANSAR_RANKS,
        ) ||
        forcesHoldLegacyForceLadder(
          state.force_ranks,
          forces,
          "Civilian",
          LEGACY_CIVILIAN_RANKS,
        ) ||
        isUniformLegacyForceRanks(state.force_ranks, forces, ranks)
      ) {
        return defaultForceRanks(forces);
      }
      const existing = ensureForceRanks(
        state.force_ranks,
        forces,
        ranks,
        extras,
        removed,
      );
      const anyAssigned = forces.some((f) => (existing[f] ?? []).length > 0);
      if (!anyAssigned) {
        return defaultForceRanks(forces);
      }
      return existing;
    })(),
    rank_equivalents: (() => {
      const ranks = ensureRanks(state.ranks);
      const forces = ensureForces(state.forces);
      const extras = ensureForceRankExtras(state.force_rank_extras, forces);
      const removed = ensureForceRankRemoved(state.force_rank_removed, forces);
      return ensureRankEquivalents(
        state.rank_equivalents,
        ranks,
        forces,
        extras,
        removed,
      );
    })(),
    rank_forces: (() => {
      const ranks = ensureRanks(state.ranks);
      const forces = ensureForces(state.forces);
      const extras = ensureForceRankExtras(state.force_rank_extras, forces);
      const removed = ensureForceRankRemoved(state.force_rank_removed, forces);
      const equivs = ensureRankEquivalents(
        state.rank_equivalents,
        ranks,
        forces,
        extras,
        removed,
      );
      const fromEquiv = Object.fromEntries(
        ranks.map((r) => [r, Object.keys(equivs[r] ?? {})]),
      );
      const anyEquiv = ranks.some((r) => (fromEquiv[r] ?? []).length > 0);
      if (anyEquiv) return fromEquiv;
      return ensureRankForces(state.rank_forces, ranks, forces);
    })(),
    rank_force_wings: ensureRankForceWings(
      state.rank_force_wings,
      ensureRanks(state.ranks),
      ensureForces(state.forces),
      ensureWings(state.wings),
      ensureRankForces(
        state.rank_forces,
        ensureRanks(state.ranks),
        ensureForces(state.forces),
      ),
    ),
    member_banks,
    authorized: ensureAuthorized(
      (state as AppState & { authorized?: unknown }).authorized,
      ensureRanks(state.ranks),
    ),
    manpower_officer_absent: (() => {
      const raw = (state as AppState & { manpower_officer_absent?: unknown })
        .manpower_officer_absent;
      if (!raw || typeof raw !== "object") return {};
      const out: Record<string, Record<string, number>> = {};
      for (const [date, wings] of Object.entries(
        raw as Record<string, unknown>,
      )) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        if (!wings || typeof wings !== "object") continue;
        const map: Record<string, number> = {};
        for (const [w, n] of Object.entries(
          wings as Record<string, unknown>,
        )) {
          const wing = canonicalWingName(w);
          const num = Number(n);
          if (!wing || !Number.isFinite(num) || num < 0) continue;
          map[wing] = (map[wing] ?? 0) + Math.floor(num);
        }
        if (Object.keys(map).length) out[date] = map;
      }
      return out;
    })(),
    manpower_held: ensureDayWingCatMap(
      (state as AppState & { manpower_held?: unknown }).manpower_held,
    ),
    manpower_absent: ensureDayWingCatMap(
      (state as AppState & { manpower_absent?: unknown }).manpower_absent,
    ),
    manpower_present: ensureDayWingCatMap(
      (state as AppState & { manpower_present?: unknown }).manpower_present,
    ),
    manpower_absence_detail: ensureDayWingCatMap(
      (state as AppState & { manpower_absence_detail?: unknown })
        .manpower_absence_detail,
    ),
    force_rank_officer: ensureForceRankOfficer(
      (state as AppState & { force_rank_officer?: unknown }).force_rank_officer,
    ),
    force_rank_cells: ensureDayWingCatMap(
      (state as AppState & { force_rank_cells?: unknown }).force_rank_cells,
    ),
    senders: (() => {
      const raw = (state.senders ?? []).map((s) => ({
        ...s,
        active: s.active !== false,
        branch_location: s.branch_location ?? "",
      }));
      return isLegacyDemoSenders(raw)
        ? officialSenderAccounts()
        : raw.map(renameFirewoodFrSender);
    })(),
    approved_dates: Array.isArray(state.approved_dates)
      ? state.approved_dates
      : [],
    suppressed_carries: Array.isArray(state.suppressed_carries)
      ? state.suppressed_carries
      : [],
    boro_khana_dates: Array.isArray(state.boro_khana_dates)
      ? state.boro_khana_dates
      : [],
    state_reports: Array.isArray(state.state_reports)
      ? state.state_reports
      : [],
    meal_plans: Array.isArray(state.meal_plans) ? state.meal_plans : [],
    meal_assigns: Array.isArray(state.meal_assigns) ? state.meal_assigns : [],
    meal_shifts: Array.isArray(state.meal_shifts) ? state.meal_shifts : [],
    guest_meals: Array.isArray(state.guest_meals) ? state.guest_meals : [],
    pritibhoj_events: ensurePritibhojEvents(state),
    paper_report_requests: ensurePaperReports(
      (state as AppState & { paper_report_requests?: unknown })
        .paper_report_requests,
    ),
    tag_requests: apiBacked
      ? storedTagRequests(state.tag_requests)
      : ensureTagRequests(state.tag_requests, state.users ?? []),
  };
}

export function setState(next: AppState | ((prev: AppState) => AppState)) {
  const prev = getState();
  const resolved = typeof next === "function" ? next(prev) : next;
  catalogHealed = false;
  memory = resolved;
  writeStorage(resolved);
  listeners.forEach((l) => l());
  if (!persistPaused) persistHook?.(resolved);
}

export function resetToSeed() {
  const seeded = createSeedState();
  setState(seeded);
  return seeded;
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const EMPTY_SERVER_SNAPSHOT: AppState = {
  users: [],
  assignments: [],
  senders: [],
  rates: [],
  ranks: [],
  wings: [],
  wing_parent: {},
  wing_labels: {},
  wing_labels_bn: {},
  wing_serials: {},
  forces: [],
  force_labels: {},
  force_labels_bn: {},
  force_serials: {},
  force_ranks: {},
  force_rank_extras: {},
  force_rank_removed: {},
  force_rank_labels: {},
  force_rank_labels_bn: {},
  force_rank_serials: {},
  rank_labels: {},
  rank_labels_bn: {},
  rank_serials: {},
  rank_forces: {},
  rank_equivalents: {},
  rank_force_wings: {},
  member_banks: [],
  authorized: [],
  manpower_officer_absent: {},
  manpower_held: {},
  manpower_absent: {},
  manpower_present: {},
  manpower_absence_detail: {},
  force_rank_officer: {},
  force_rank_cells: {},
  approved_dates: [],
  suppressed_carries: [],
  boro_khana_dates: [],
  state_reports: [],
  meal_plans: [],
  meal_assigns: [],
  meal_shifts: [],
  guest_meals: [],
  pritibhoj_events: [],
  paper_report_requests: [],
  tag_requests: [],
  version: 0,
};

export function getServerSnapshot(): AppState {
  return EMPTY_SERVER_SNAPSHOT;
}

let hydrated = false;

export function hydrateStore() {
  getState();
  if (typeof window === "undefined") return;
  if (hydrated) return;
  hydrated = true;
  void import("@/lib/api/app-sync").then((mod) => {
    void mod.syncStoreFromApi();
  });
}
