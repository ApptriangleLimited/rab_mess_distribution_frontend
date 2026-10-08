import {
  FORCE_DEFAULT_RANKS,
  FORCES,
  canonicalForceServiceRank,
  forceRankChoices,
  forceRankOfficialSerial,
  ADMIN_SUB_WINGS,
  DROPPED_MAIN_WINGS,
  HQ_SUB_WINGS,
  LEGACY_FORM1_WINGS,
  LEGACY_WINGS,
  WING_LABELS,
  WING_LABELS_BN,
  WING_CATALOG_SERIALS,
  WINGS,
  canonicalWingName,
  forceOfficialSerial,
  rankOfficialSerial,
  wingOfficialName,
  wingOfficialSerial,
  authorizedIdForLabel,
} from "@/lib/constants";
import { persistAppStateNow } from "@/lib/api/app-sync";
import { getState, setState } from "@/lib/store";

const OFFICIAL_WING_KEYS = new Set(
  [...WINGS, ...ADMIN_SUB_WINGS, ...HQ_SUB_WINGS].map((w) => w.toLowerCase()),
);

const BANNED_WINGS = new Set(
  [...LEGACY_WINGS, ...LEGACY_FORM1_WINGS, ...DROPPED_MAIN_WINGS]
    .filter((w) => !OFFICIAL_WING_KEYS.has(w.toLowerCase()))
    .map((w) => w.toLowerCase()),
);

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function listRanks(): string[] {
  const { ranks, rank_serials } = getState();
  return [...ranks].sort((a, b) => {
    const as = rankOfficialSerial(a, rank_serials) ?? 10_000;
    const bs = rankOfficialSerial(b, rank_serials) ?? 10_000;
    if (as !== bs) return as - bs;
    return a.localeCompare(b);
  });
}

export function listWings(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of getState().wings) {
    if (BANNED_WINGS.has(w.toLowerCase())) continue;
    const key = w.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

function lookupParent(
  wingParent: Record<string, string>,
  wing: string,
): string {
  if (wingParent[wing]) return wingParent[wing];
  const key = wing.trim().toLowerCase();
  for (const [child, parent] of Object.entries(wingParent)) {
    if (child.trim().toLowerCase() === key) return parent;
  }
  return "";
}

function resolveWingName(wings: string[], label: string): string {
  const want = canonicalWingName(normalizeLabel(label)).toLowerCase();
  if (!want) return "";
  return (
    wings.find((w) => w.toLowerCase() === want) ||
    wings.find((w) => canonicalWingName(w).toLowerCase() === want) ||
    ""
  );
}

function wingNameTaken(label: string, except?: string): boolean {
  const key = canonicalWingName(normalizeLabel(label)).toLowerCase();
  if (!key) return false;
  if (BANNED_WINGS.has(key)) return true;
  return listWings().some((w) => {
    if (except && w === except) return false;
    return (
      w.toLowerCase() === key || canonicalWingName(w).toLowerCase() === key
    );
  });
}

/** Direct children of `parent` (null = root wings). Order follows catalog. */
export function listWingChildrenFrom(
  wings: string[],
  wingParent: Record<string, string>,
  parent: string | string[] | null,
): string[] {
  const seen = new Set<string>();
  const live = wings.filter((w) => {
    if (BANNED_WINGS.has(w.toLowerCase())) return false;
    const key = w.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (parent === null) {
    const hqKids = new Set(HQ_SUB_WINGS.map((w) => w.toLowerCase()));
    return live.filter((w) => {
      if (hqKids.has(w.toLowerCase())) return false;
      return !lookupParent(wingParent, w);
    });
  }
  const parents = (Array.isArray(parent) ? parent : [parent]).map((p) =>
    p.trim().toLowerCase(),
  );
  const hqKids = new Set(HQ_SUB_WINGS.map((w) => w.toLowerCase()));
  const extras = live.filter((w) => {
    if (hqKids.has(w.toLowerCase())) return false;
    return parents.includes(lookupParent(wingParent, w).toLowerCase());
  });
  if (parents.some((p) => p === "hq br" || p === "headquarters branch")) {
    const hqSeen = new Set(HQ_SUB_WINGS.map((w) => w.toLowerCase()));
    return [
      ...HQ_SUB_WINGS,
      ...extras.filter((w) => {
        const key = w.toLowerCase();
        if (hqSeen.has(key)) return false;
        hqSeen.add(key);
        return true;
      }),
    ];
  }
  return extras;
}

export function listWingChildren(parent: string | null): string[] {
  const { wings, wing_parent, wing_serials } = getState();
  return listWingChildrenFrom(wings, wing_parent, parent).sort((a, b) => {
    const as = wingOfficialSerial(a, wing_serials) ?? 10_000;
    const bs = wingOfficialSerial(b, wing_serials) ?? 10_000;
    if (as !== bs) return as - bs;
    return a.localeCompare(b);
  });
}

/** Nested children under `parent` (depth-first, catalog order per level). */
export function listWingDescendants(parent: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (node: string) => {
    for (const child of listWingChildren(node)) {
      const key = child.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(child);
      walk(child);
    }
  };
  walk(parent);
  return out;
}

/**
 * True when a member's stored wing is the filter, or sits under it.
 * Selecting a main wing includes its sub-wings.
 */
export function memberMatchesWingFilter(
  storedWing: string,
  filterWing: string,
): boolean {
  const want = canonicalWingName(normalizeLabel(filterWing)).toLowerCase();
  if (!want || want === "all") return true;
  let cur = normalizeLabel(storedWing);
  if (!cur) return false;
  const { wing_parent } = getState();
  const seen = new Set<string>();
  while (cur) {
    const key = canonicalWingName(cur).toLowerCase();
    if (key === want) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    const parent = lookupParent(wing_parent, cur);
    if (!parent) return false;
    cur = parent;
  }
  return false;
}

/** Settings wings in serial order: mains, then Admin/HQ children. */
export function listOfficialWings(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (wing: string) => {
    const key = wing.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(wing);
  };
  for (const main of listWingChildren(null)) {
    push(main);
    for (const child of listWingChildren(main)) {
      push(child);
      if (isHqBranchName(child)) {
        for (const hq of listWingDescendants(child)) push(hq);
      }
    }
  }
  return out;
}

export function isAdminRootName(label: string): boolean {
  return label.trim().toLowerCase() === "admin";
}

export function isHqBranchName(label: string): boolean {
  const key = label.trim().toLowerCase();
  return key === "hq br" || key === "headquarters branch";
}

export function isHqSubWingName(label: string): boolean {
  const key = label.trim().toLowerCase();
  return HQ_SUB_WINGS.some((wing) => wing.toLowerCase() === key);
}

/** Split a stored member wing into main / Admin sub / HQ leaf for the create form. */
export function memberWingCascade(wing: string): {
  main: string;
  sub: string;
  leaf: string;
} {
  const stored = normalizeLabel(wing);
  if (!stored) return { main: "", sub: "", leaf: "" };
  const { wing_parent } = getState();
  if (isHqBranchName(stored)) {
    return { main: "Admin", sub: "HQ Br", leaf: "" };
  }
  const chain: string[] = [stored];
  const seen = new Set<string>([stored.toLowerCase()]);
  let cur = lookupParent(wing_parent, stored);
  while (cur) {
    const key = cur.toLowerCase();
    if (seen.has(key)) break;
    seen.add(key);
    chain.unshift(cur);
    cur = lookupParent(wing_parent, cur);
  }
  if (chain.some(isHqBranchName) || isHqSubWingName(stored)) {
    const leaf = chain[chain.length - 1];
    return {
      main: "Admin",
      sub: "HQ Br",
      leaf: isHqBranchName(leaf) ? "" : leaf,
    };
  }
  if (chain.some(isAdminRootName) || isAdminRootName(stored)) {
    const last = chain[chain.length - 1];
    return {
      main: "Admin",
      sub: isAdminRootName(last) ? "" : last,
      leaf: "",
    };
  }
  return { main: stored, sub: "", leaf: "" };
}

/** Official name of the member's main wing. Branches roll up to that wing. */
export function formatMemberWing(storedWing: string): string {
  const stored = normalizeLabel(storedWing);
  if (!stored) return "";
  const { wing_parent, wing_labels } = getState();
  let root = canonicalWingName(stored);
  const seen = new Set<string>([stored.toLowerCase()]);
  let cur = lookupParent(wing_parent, stored);
  while (cur) {
    const key = cur.toLowerCase();
    if (seen.has(key)) break;
    seen.add(key);
    root = canonicalWingName(cur);
    cur = lookupParent(wing_parent, cur);
  }
  return wingOfficialName(root, wing_labels);
}

export function listForceServiceRanks(force: string): string[] {
  if (!force.trim()) return [];
  const {
    ranks,
    force_ranks,
    force_rank_extras,
    force_rank_removed,
    force_rank_serials,
  } = getState();
  const choices = forceRankChoices(
    force,
    ranks,
    force_rank_extras[force] ?? [],
    force_rank_removed[force] ?? [],
  );
  const assigned = force_ranks[force] ?? [];
  const seen = new Set(choices.map((r) => r.toLowerCase()));
  const extraAssigned = assigned.filter((r) => {
    const key = r.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...choices, ...extraAssigned].sort((a, b) => {
    const as = forceRankOfficialSerial(force, a, force_rank_serials) ?? 10_000;
    const bs = forceRankOfficialSerial(force, b, force_rank_serials) ?? 10_000;
    if (as !== bs) return as - bs;
    return a.localeCompare(b);
  });
}

/** Paper HQ Br children stay official; extra nested HQ units are kept. */
export function repairOfficialHqBranch() {
  const prev = getState();
  const have = new Set(prev.wings.map((w) => w.toLowerCase()));
  const missing = HQ_SUB_WINGS.some((w) => !have.has(w.toLowerCase()));
  const wrongParent = HQ_SUB_WINGS.some(
    (w) => (prev.wing_parent[w] ?? "").trim() !== "HQ Br",
  );
  if (!missing && !wrongParent) return;

  setState((state) => {
    const seen = new Set<string>();
    const wings: string[] = [];
    for (const raw of [...state.wings, ...HQ_SUB_WINGS]) {
      const next = canonicalWingName(raw);
      const key = next.toLowerCase();
      if (!next || seen.has(key)) continue;
      seen.add(key);
      wings.push(next);
    }
    const wing_parent = { ...state.wing_parent };
    for (const child of HQ_SUB_WINGS) wing_parent[child] = "HQ Br";
    const wing_labels = { ...state.wing_labels };
    const wing_labels_bn = { ...(state.wing_labels_bn ?? {}) };
    const wing_serials = { ...(state.wing_serials ?? {}) };
    HQ_SUB_WINGS.forEach((wing, i) => {
      if (WING_LABELS[wing]) wing_labels[wing] = WING_LABELS[wing];
      if (WING_LABELS_BN[wing]) wing_labels_bn[wing] = WING_LABELS_BN[wing];
      wing_serials[wing] = WING_CATALOG_SERIALS[wing] ?? i + 1;
    });
    return {
      ...state,
      wings,
      wing_parent,
      wing_labels,
      wing_labels_bn,
      wing_serials,
    };
  });
  persistAppStateNow();
}

/** Admin family roots collapsed to one key (Authorized tab only). */
const ADMIN_AUTH_ROOTS = new Set([
  "admin",
  "admin (new)",
  "admin (old)",
]);

export function isAdminAuthorizedRoot(wing: string): boolean {
  return ADMIN_AUTH_ROOTS.has(wing.trim().toLowerCase());
}

/**
 * Root wings for Settings → Authorized প্রাধিকৃত.
 * Same Settings serial order as Daily manpower Form 1.
 */
export function listAuthorizedRootWingsFrom(wings: string[]): string[] {
  const { wing_parent, wing_serials } = getState();
  const roots = listWingChildrenFrom(wings, wing_parent, null)
    .filter((w) => !BANNED_WINGS.has(w.toLowerCase()))
    .sort((a, b) => {
      const as = wingOfficialSerial(a, wing_serials) ?? 10_000;
      const bs = wingOfficialSerial(b, wing_serials) ?? 10_000;
      if (as !== bs) return as - bs;
      return a.localeCompare(b);
    });
  if (roots.length) return roots;
  return WINGS.filter((w) => !BANNED_WINGS.has(w.toLowerCase()));
}

export function listAuthorizedRootWings(): string[] {
  return listAuthorizedRootWingsFrom(listWings());
}

function authorizedWingKeyMatch(stored: string, wanted: string): boolean {
  const a = stored.trim().toLowerCase();
  const b = wanted.trim().toLowerCase();
  if (a === b) return true;
  return canonicalWingName(stored).toLowerCase() === canonicalWingName(wanted).toLowerCase();
}

/** Count for Authorized / Form 1 প্রাধিকৃত (Admin = sum of Admin family keys). */
export function authorizedWingDisplayCount(
  wings: Record<string, number> | undefined,
  wing: string,
): number {
  const map = wings ?? {};
  if (isAdminAuthorizedRoot(wing) || wing === "Admin") {
    let sum = 0;
    for (const [k, n] of Object.entries(map)) {
      if (isAdminAuthorizedRoot(k)) sum += n || 0;
    }
    return sum;
  }
  if (typeof map[wing] === "number") return map[wing] ?? 0;
  let sum = 0;
  let found = false;
  for (const [k, n] of Object.entries(map)) {
    if (!authorizedWingKeyMatch(k, wing)) continue;
    sum += n || 0;
    found = true;
  }
  return found ? sum : 0;
}

export function isBannedWing(label: string): boolean {
  return BANNED_WINGS.has(label.trim().toLowerCase());
}

/** `Wing / Sub / Leaf` path for display. */
export function wingPathLabel(label: string): string {
  const { wing_parent } = getState();
  const parts: string[] = [label];
  const seen = new Set<string>([label.toLowerCase()]);
  let cur = wing_parent[label];
  while (cur) {
    if (seen.has(cur.toLowerCase())) break;
    seen.add(cur.toLowerCase());
    parts.unshift(cur);
    cur = wing_parent[cur];
  }
  return parts.join(" / ");
}

function wingSubtree(
  root: string,
  wings: string[],
  wingParent: Record<string, string>,
): string[] {
  const kids = wings.filter((w) => wingParent[w] === root);
  return [root, ...kids.flatMap((k) => wingSubtree(k, wings, wingParent))];
}

export function listForces(): string[] {
  const { forces, force_serials } = getState();
  return [...forces].sort((a, b) => {
    const as = forceOfficialSerial(a, force_serials) ?? 10_000;
    const bs = forceOfficialSerial(b, force_serials) ?? 10_000;
    if (as !== bs) return as - bs;
    return a.localeCompare(b);
  });
}

export function listRanksForForce(force: string): string[] {
  return getState().force_ranks[force] ?? [];
}

export function listForcesForRank(rank: string): string[] {
  return getState().rank_forces[rank] ?? [];
}

export function listWingsForRankForce(rank: string, force: string): string[] {
  return getState().rank_force_wings[rank]?.[force] ?? [];
}

export function listEquivalentsForRankForce(
  rank: string,
  force: string,
): string[] {
  return getState().rank_equivalents[rank]?.[force] ?? [];
}

export function addRank(
  label: string,
  elaborate?: string,
  bangla?: string,
  serial?: number | null,
): string | null {
  const next = normalizeLabel(label);
  if (!next) return null;
  const key = next.toLowerCase();
  if (listRanks().some((r) => r.toLowerCase() === key)) return null;
  const full = normalizeLabel(elaborate ?? "");
  const bn = normalizeLabel(bangla ?? "");
  const serialNo =
    typeof serial === "number" && Number.isFinite(serial) && serial > 0
      ? Math.floor(serial)
      : 0;
  setState((prev) => {
    const hasAuth = prev.authorized.some(
      (r) => r.label.toLowerCase() === key,
    );
    return {
      ...prev,
      ranks: [...prev.ranks, next],
      rank_forces: { ...prev.rank_forces, [next]: [] },
      rank_equivalents: { ...prev.rank_equivalents, [next]: {} },
      rank_force_wings: { ...prev.rank_force_wings, [next]: {} },
      rank_labels: full
        ? { ...prev.rank_labels, [next]: full }
        : (prev.rank_labels ?? {}),
      rank_labels_bn: bn
        ? { ...prev.rank_labels_bn, [next]: bn }
        : (prev.rank_labels_bn ?? {}),
      rank_serials: serialNo
        ? { ...prev.rank_serials, [next]: serialNo }
        : (prev.rank_serials ?? {}),
      authorized: hasAuth
        ? prev.authorized
        : [
            ...prev.authorized,
            {
              id: authorizedIdForLabel(next),
              label: next,
              count: 0,
              wings: {},
            },
          ],
    };
  });
  persistAppStateNow();
  return next;
}

/** Add service rank under a force (short + optional full name). */
export function addForceRank(
  force: string,
  short: string,
  elaborate?: string,
  bangla?: string,
  serial?: number | null,
): string | null {
  const next = canonicalForceServiceRank(normalizeLabel(short));
  if (!next) return null;
  const key = next.toLowerCase();
  setState((prev) => {
    if (!prev.forces.includes(force)) return prev;
    const ladder =
      FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? [];
    const extras = prev.force_rank_extras[force] ?? [];
    const onLadder = ladder.some((r) => r.toLowerCase() === key);
    const onExtra = extras.some((r) => r.toLowerCase() === key);
    if (onLadder || onExtra) return prev;
    const full = normalizeLabel(elaborate ?? "");
    const bn = normalizeLabel(bangla ?? "");
    const serialNo =
      typeof serial === "number" && Number.isFinite(serial) && serial > 0
        ? Math.floor(serial)
        : 0;
    const nextExtras = {
      ...prev.force_rank_extras,
      [force]: [...extras, next],
    };
    const assigned = prev.force_ranks[force] ?? [];
    const alreadyOn = assigned.some((r) => r.toLowerCase() === key);
    return {
      ...prev,
      force_rank_extras: nextExtras,
      force_ranks: {
        ...prev.force_ranks,
        [force]: alreadyOn ? assigned : [...assigned, next],
      },
      force_rank_labels: full
        ? {
            ...prev.force_rank_labels,
            [force]: {
              ...(prev.force_rank_labels[force] ?? {}),
              [next]: full,
            },
          }
        : prev.force_rank_labels,
      force_rank_labels_bn: bn
        ? {
            ...prev.force_rank_labels_bn,
            [force]: {
              ...(prev.force_rank_labels_bn[force] ?? {}),
              [next]: bn,
            },
          }
        : (prev.force_rank_labels_bn ?? {}),
      force_rank_serials: serialNo
        ? {
            ...prev.force_rank_serials,
            [force]: {
              ...(prev.force_rank_serials[force] ?? {}),
              [next]: serialNo,
            },
          }
        : (prev.force_rank_serials ?? {}),
    };
  });
  persistAppStateNow();
  const after = getState();
  const extras = after.force_rank_extras[force] ?? [];
  return extras.some((r) => r.toLowerCase() === key) ? next : null;
}


/** Rename service rank under a force (short + optional full). */
export function renameForceRank(
  force: string,
  from: string,
  to: string,
  elaborate?: string,
  bangla?: string,
  serial?: number | null,
): boolean {
  const next = canonicalForceServiceRank(normalizeLabel(to));
  if (!next || !from) return false;
  const fromCanon = canonicalForceServiceRank(normalizeLabel(from));
  const fromKey = fromCanon.toLowerCase();
  const toKey = next.toLowerCase();
  setState((prev) => {
    if (!prev.forces.includes(force)) return prev;
    const ladder =
      FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? [];
    const extras = prev.force_rank_extras[force] ?? [];
    const removed = prev.force_rank_removed[force] ?? [];
    const choices = [
      ...ladder.filter(
        (r) => !removed.some((x) => x.toLowerCase() === r.toLowerCase()),
      ),
      ...extras,
    ];
    const hasFrom = choices.some((r) => r.toLowerCase() === fromKey);
    if (!hasFrom) return prev;
    if (
      toKey !== fromKey &&
      choices.some((r) => r.toLowerCase() === toKey)
    ) {
      return prev;
    }

    const onLadder = ladder.some((r) => r.toLowerCase() === fromKey);
    const onExtra = extras.some((r) => r.toLowerCase() === fromKey);
    let nextExtras = [...extras];
    let nextRemoved = [...removed];

    if (onExtra) {
      nextExtras = extras.map((r) => (r.toLowerCase() === fromKey ? next : r));
    }
    if (onLadder && toKey !== fromKey) {
      if (!nextRemoved.some((r) => r.toLowerCase() === fromKey)) {
        nextRemoved = [...nextRemoved, fromCanon];
      }
      if (!nextExtras.some((r) => r.toLowerCase() === toKey)) {
        nextExtras = [...nextExtras, next];
      }
      nextRemoved = nextRemoved.filter((r) => r.toLowerCase() !== toKey);
    } else if (!onExtra && !onLadder) {
      return prev;
    } else if (onExtra && toKey !== fromKey) {
      // already remapped in extras
    } else if (onLadder && toKey === fromKey) {
      // label-only change on default
    }

    const assigned = (prev.force_ranks[force] ?? []).map((r) =>
      r.toLowerCase() === fromKey ? next : r,
    );
    const labels = { ...(prev.force_rank_labels[force] ?? {}) };
    const oldLabel = labels[fromCanon] ?? labels[from];
    delete labels[fromCanon];
    delete labels[from];
    const full = normalizeLabel(elaborate ?? "");
    if (full) labels[next] = full;
    else if (oldLabel && toKey === fromKey) labels[next] = oldLabel;
    else if (oldLabel && toKey !== fromKey) labels[next] = oldLabel;
    const labelsBn = { ...(prev.force_rank_labels_bn[force] ?? {}) };
    if (labelsBn[fromCanon] ?? labelsBn[from]) {
      labelsBn[next] = labelsBn[fromCanon] ?? labelsBn[from];
      delete labelsBn[fromCanon];
      delete labelsBn[from];
    }
    if (bangla !== undefined) {
      const bn = normalizeLabel(bangla);
      if (bn) labelsBn[next] = bn;
      else delete labelsBn[next];
    }
    const serials = { ...(prev.force_rank_serials[force] ?? {}) };
    if (serials[fromCanon] != null || serials[from] != null) {
      serials[next] = serials[fromCanon] ?? serials[from];
      delete serials[fromCanon];
      delete serials[from];
    }
    if (serial !== undefined) {
      if (typeof serial === "number" && Number.isFinite(serial) && serial > 0) {
        serials[next] = Math.floor(serial);
      } else {
        delete serials[next];
      }
    }

    const rank_equivalents: Record<string, Record<string, string[]>> = {};
    for (const [rank, byForce] of Object.entries(prev.rank_equivalents)) {
      const nextByForce: Record<string, string[]> = {};
      for (const [f, list] of Object.entries(byForce)) {
        if (f !== force) {
          nextByForce[f] = list;
          continue;
        }
        nextByForce[f] = list.map((r) =>
          r.toLowerCase() === fromKey ? next : r,
        );
      }
      rank_equivalents[rank] = nextByForce;
    }

    return {
      ...prev,
      force_rank_extras: { ...prev.force_rank_extras, [force]: nextExtras },
      force_rank_removed: {
        ...prev.force_rank_removed,
        [force]: nextRemoved,
      },
      force_ranks: { ...prev.force_ranks, [force]: assigned },
      force_rank_labels: { ...prev.force_rank_labels, [force]: labels },
      force_rank_labels_bn: {
        ...prev.force_rank_labels_bn,
        [force]: labelsBn,
      },
      force_rank_serials: {
        ...prev.force_rank_serials,
        [force]: serials,
      },
      rank_equivalents,
    };
  });
  const after = getState();
  const choices = [
    ...(FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? []).filter(
      (r) =>
        !(after.force_rank_removed[force] ?? []).some(
          (x) => x.toLowerCase() === r.toLowerCase(),
        ),
    ),
    ...(after.force_rank_extras[force] ?? []),
  ];
  persistAppStateNow();
  return choices.some((r) => r.toLowerCase() === toKey);
}

/** Delete service rank under a force (extras gone; defaults hidden). */
export function removeForceRank(force: string, rank: string) {
  const key = canonicalForceServiceRank(normalizeLabel(rank)).toLowerCase();
  if (!key) return;
  setState((prev) => {
    if (!prev.forces.includes(force)) return prev;
    const ladder =
      FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? [];
    const extras = (prev.force_rank_extras[force] ?? []).filter(
      (r) => r.toLowerCase() !== key,
    );
    const onLadder = ladder.some((r) => r.toLowerCase() === key);
    let removed = [...(prev.force_rank_removed[force] ?? [])];
    if (onLadder && !removed.some((r) => r.toLowerCase() === key)) {
      const canon = ladder.find((r) => r.toLowerCase() === key) ?? rank;
      removed = [...removed, canon];
    }
    const assigned = (prev.force_ranks[force] ?? []).filter(
      (r) => r.toLowerCase() !== key,
    );
    const labels = { ...(prev.force_rank_labels[force] ?? {}) };
    for (const k of Object.keys(labels)) {
      if (k.toLowerCase() === key) delete labels[k];
    }
    const labelsBn = { ...(prev.force_rank_labels_bn[force] ?? {}) };
    for (const k of Object.keys(labelsBn)) {
      if (k.toLowerCase() === key) delete labelsBn[k];
    }
    const serials = { ...(prev.force_rank_serials[force] ?? {}) };
    for (const k of Object.keys(serials)) {
      if (k.toLowerCase() === key) delete serials[k];
    }
    const rank_equivalents: Record<string, Record<string, string[]>> = {};
    for (const [rab, byForce] of Object.entries(prev.rank_equivalents)) {
      const nextByForce: Record<string, string[]> = {};
      for (const [f, list] of Object.entries(byForce)) {
        if (f !== force) {
          nextByForce[f] = list;
          continue;
        }
        const nextList = list.filter((r) => r.toLowerCase() !== key);
        if (nextList.length > 0) nextByForce[f] = nextList;
      }
      rank_equivalents[rab] = nextByForce;
    }
    const rank_forces = Object.fromEntries(
      Object.entries(prev.rank_forces).map(([rab, list]) => [
        rab,
        Object.keys(rank_equivalents[rab] ?? {}),
      ]),
    );
    // Prefer keeping existing rank_forces if no equivs used — sync from equiv keys when present
    const anyEquiv = Object.values(rank_equivalents).some(
      (by) => Object.keys(by).length > 0,
    );
    return {
      ...prev,
      force_rank_extras: { ...prev.force_rank_extras, [force]: extras },
      force_rank_removed: { ...prev.force_rank_removed, [force]: removed },
      force_ranks: { ...prev.force_ranks, [force]: assigned },
      force_rank_labels: { ...prev.force_rank_labels, [force]: labels },
      force_rank_labels_bn: {
        ...prev.force_rank_labels_bn,
        [force]: labelsBn,
      },
      force_rank_serials: {
        ...prev.force_rank_serials,
        [force]: serials,
      },
      rank_equivalents,
      rank_forces: anyEquiv
        ? {
            ...prev.rank_forces,
            ...Object.fromEntries(
              Object.keys(prev.rank_equivalents).map((rab) => [
                rab,
                Object.keys(rank_equivalents[rab] ?? {}),
              ]),
            ),
          }
        : prev.rank_forces,
    };
  });
  persistAppStateNow();
}

export function addWing(
  label: string,
  parent?: string | null,
  elaborate?: string,
  bangla?: string,
  serial?: number | null,
): string | null {
  const next = canonicalWingName(normalizeLabel(label));
  if (!next) return null;
  const key = next.toLowerCase();
  if (wingNameTaken(next)) return null;
  const parentWanted = parent ? canonicalWingName(normalizeLabel(parent)) : "";
  const full = normalizeLabel(elaborate ?? "");
  const bn = normalizeLabel(bangla ?? "");
  const serialNo =
    typeof serial === "number" && Number.isFinite(serial) && serial > 0
      ? Math.floor(serial)
      : 0;
  setState((prev) => {
    const parentFound = parentWanted
      ? resolveWingName(prev.wings, parentWanted)
      : "";
    if (parentWanted && !parentFound) return prev;
    const wing_parent = { ...prev.wing_parent };
    if (parentFound) wing_parent[next] = parentFound;
    return {
      ...prev,
      wings: [...prev.wings, next],
      wing_parent,
      wing_labels: full
        ? { ...prev.wing_labels, [next]: full }
        : prev.wing_labels,
      wing_labels_bn: bn
        ? { ...prev.wing_labels_bn, [next]: bn }
        : (prev.wing_labels_bn ?? {}),
      wing_serials: serialNo
        ? { ...prev.wing_serials, [next]: serialNo }
        : (prev.wing_serials ?? {}),
    };
  });
  const created = getState().wings.some((w) => w.toLowerCase() === key)
    ? next
    : null;
  if (created) persistAppStateNow();
  return created;
}

export function addForce(
  label: string,
  elaborate?: string,
  bangla?: string,
  serial?: number | null,
): string | null {
  const next = normalizeLabel(label);
  if (!next) return null;
  const key = next.toLowerCase();
  if (listForces().some((f) => f.toLowerCase() === key)) return null;
  const full = normalizeLabel(elaborate ?? "");
  const bn = normalizeLabel(bangla ?? "");
  const serialNo =
    typeof serial === "number" && Number.isFinite(serial) && serial > 0
      ? Math.floor(serial)
      : 0;
  setState((prev) => ({
    ...prev,
    forces: [...prev.forces, next],
    force_labels: full
      ? { ...prev.force_labels, [next]: full }
      : (prev.force_labels ?? {}),
    force_labels_bn: bn
      ? { ...prev.force_labels_bn, [next]: bn }
      : (prev.force_labels_bn ?? {}),
    force_serials: serialNo
      ? { ...prev.force_serials, [next]: serialNo }
      : (prev.force_serials ?? {}),
    force_ranks: {
      ...prev.force_ranks,
      [next]: [],
    },
    force_rank_extras: {
      ...prev.force_rank_extras,
      [next]: [],
    },
    force_rank_removed: {
      ...prev.force_rank_removed,
      [next]: [],
    },
    force_rank_labels: {
      ...prev.force_rank_labels,
      [next]: {},
    },
    force_rank_labels_bn: {
      ...prev.force_rank_labels_bn,
      [next]: {},
    },
    force_rank_serials: {
      ...prev.force_rank_serials,
      [next]: {},
    },
  }));
  persistAppStateNow();
  return next;
}

export function renameRank(
  from: string,
  to: string,
  elaborate?: string,
  bangla?: string,
  serial?: number | null,
): boolean {
  const next = normalizeLabel(to);
  if (!next) return false;
  const key = next.toLowerCase();
  const ranks = listRanks();
  if (!ranks.includes(from)) return false;
  if (ranks.some((r) => r !== from && r.toLowerCase() === key)) return false;
  setState((prev) => {
    const linked = prev.rank_forces[from] ?? [];
    const wingsMap = prev.rank_force_wings[from] ?? {};
    const equivMap = prev.rank_equivalents[from] ?? {};
    const rank_forces = { ...prev.rank_forces };
    const rank_force_wings = { ...prev.rank_force_wings };
    const rank_equivalents = { ...prev.rank_equivalents };
    delete rank_forces[from];
    delete rank_force_wings[from];
    delete rank_equivalents[from];
    rank_forces[next] = linked;
    rank_force_wings[next] = wingsMap;
    rank_equivalents[next] = equivMap;
    const rank_labels = { ...(prev.rank_labels ?? {}) };
    if (rank_labels[from]) {
      rank_labels[next] = rank_labels[from];
      delete rank_labels[from];
    }
    const full = normalizeLabel(elaborate ?? "");
    if (full) rank_labels[next] = full;
    else if (elaborate !== undefined) delete rank_labels[next];
    const rank_labels_bn = { ...(prev.rank_labels_bn ?? {}) };
    if (rank_labels_bn[from]) {
      rank_labels_bn[next] = rank_labels_bn[from];
      delete rank_labels_bn[from];
    }
    if (bangla !== undefined) {
      const bn = normalizeLabel(bangla);
      if (bn) rank_labels_bn[next] = bn;
      else delete rank_labels_bn[next];
    }
    const rank_serials = { ...(prev.rank_serials ?? {}) };
    if (rank_serials[from] != null) {
      rank_serials[next] = rank_serials[from];
      delete rank_serials[from];
    }
    if (serial !== undefined) {
      if (typeof serial === "number" && Number.isFinite(serial) && serial > 0) {
        rank_serials[next] = Math.floor(serial);
      } else {
        delete rank_serials[next];
      }
    }
    return {
      ...prev,
      ranks: prev.ranks.map((r) => (r === from ? next : r)),
      rank_forces,
      rank_force_wings,
      rank_equivalents,
      rank_labels,
      rank_labels_bn,
      rank_serials,
      authorized: prev.authorized.map((row) => {
        if (row.label !== from) return row;
        return {
          ...row,
          id: authorizedIdForLabel(next),
          label: next,
        };
      }),
      users: prev.users.map((u) =>
        u.rank === from ? { ...u, rank: next } : u,
      ),
    };
  });
  persistAppStateNow();
  return true;
}

export function renameWing(
  from: string,
  to: string,
  elaborate?: string,
  bangla?: string,
  serial?: number | null,
): boolean {
  const next = canonicalWingName(normalizeLabel(to));
  if (!next) return false;
  const wings = listWings();
  if (!wings.includes(from)) return false;
  if (wingNameTaken(next, from)) return false;
  const full = normalizeLabel(elaborate ?? "");
  setState((prev) => {
    const rank_force_wings: Record<string, Record<string, string[]>> = {};
    for (const [rank, byForce] of Object.entries(prev.rank_force_wings)) {
      const nextByForce: Record<string, string[]> = {};
      for (const [force, list] of Object.entries(byForce)) {
        nextByForce[force] = list.map((w) => (w === from ? next : w));
      }
      rank_force_wings[rank] = nextByForce;
    }
    const wing_parent: Record<string, string> = {};
    for (const [child, parent] of Object.entries(prev.wing_parent)) {
      const childKey = child === from ? next : child;
      const parentKey = parent === from ? next : parent;
      if (childKey.toLowerCase() === parentKey.toLowerCase()) continue;
      wing_parent[childKey] = parentKey;
    }
    const wing_labels = { ...prev.wing_labels };
    if (wing_labels[from]) {
      wing_labels[next] = wing_labels[from];
      delete wing_labels[from];
    }
    if (full) wing_labels[next] = full;
    else if (elaborate !== undefined) delete wing_labels[next];
    const wing_labels_bn = { ...(prev.wing_labels_bn ?? {}) };
    if (wing_labels_bn[from]) {
      wing_labels_bn[next] = wing_labels_bn[from];
      delete wing_labels_bn[from];
    }
    if (bangla !== undefined) {
      const bn = normalizeLabel(bangla);
      if (bn) wing_labels_bn[next] = bn;
      else delete wing_labels_bn[next];
    }
    const wing_serials = { ...(prev.wing_serials ?? {}) };
    if (wing_serials[from] != null) {
      wing_serials[next] = wing_serials[from];
      delete wing_serials[from];
    }
    if (serial !== undefined) {
      if (typeof serial === "number" && Number.isFinite(serial) && serial > 0) {
        wing_serials[next] = Math.floor(serial);
      } else {
        delete wing_serials[next];
      }
    }
    const authorized = prev.authorized.map((row) => {
      const wings: Record<string, number> = {};
      for (const [w, n] of Object.entries(row.wings ?? {})) {
        wings[w === from ? next : w] = n;
      }
      const heldRaw = row.held_wings;
      let held_wings: Record<string, number> | undefined;
      if (heldRaw && Object.keys(heldRaw).length > 0) {
        held_wings = {};
        for (const [w, n] of Object.entries(heldRaw)) {
          held_wings[w === from ? next : w] = n;
        }
      }
      return {
        ...row,
        wings,
        count: sumWingAuth(wings),
        ...(held_wings ? { held_wings } : {}),
      };
    });
    const manpower_officer_absent: Record<string, Record<string, number>> = {};
    for (const [date, wings] of Object.entries(
      prev.manpower_officer_absent ?? {},
    )) {
      const map: Record<string, number> = {};
      for (const [w, n] of Object.entries(wings)) {
        map[w === from ? next : w] = n;
      }
      manpower_officer_absent[date] = map;
    }
    const renameDayWingCat = (
      prevMap: Record<string, Record<string, Record<string, number>>>,
    ) => {
      const out: Record<string, Record<string, Record<string, number>>> = {};
      for (const [date, wings] of Object.entries(prevMap ?? {})) {
        const map: Record<string, Record<string, number>> = {};
        for (const [w, cats] of Object.entries(wings)) {
          map[w === from ? next : w] = cats;
        }
        out[date] = map;
      }
      return out;
    };
    return {
      ...prev,
      wings: prev.wings.map((w) => (w === from ? next : w)),
      wing_parent,
      wing_labels,
      wing_labels_bn,
      wing_serials,
      rank_force_wings,
      authorized,
      manpower_officer_absent,
      manpower_held: renameDayWingCat(prev.manpower_held ?? {}),
      manpower_absent: renameDayWingCat(prev.manpower_absent ?? {}),
      manpower_present: renameDayWingCat(prev.manpower_present ?? {}),
      manpower_absence_detail: renameDayWingCat(
        prev.manpower_absence_detail ?? {},
      ),
      users: prev.users.map((u) =>
        u.wing === from ? { ...u, wing: next } : u,
      ),
    };
  });
  persistAppStateNow();
  return true;
}

export function renameForce(
  from: string,
  to: string,
  elaborate?: string,
  bangla?: string,
  serial?: number | null,
): boolean {
  const next = normalizeLabel(to);
  if (!next) return false;
  const key = next.toLowerCase();
  const forces = listForces();
  if (!forces.includes(from)) return false;
  if (forces.some((f) => f !== from && f.toLowerCase() === key)) return false;
  setState((prev) => {
    const rank_forces: Record<string, string[]> = {};
    const rank_force_wings: Record<string, Record<string, string[]>> = {};
    const rank_equivalents: Record<string, Record<string, string[]>> = {};
    for (const [rank, list] of Object.entries(prev.rank_forces)) {
      rank_forces[rank] = list.map((f) => (f === from ? next : f));
    }
    for (const [rank, byForce] of Object.entries(prev.rank_force_wings)) {
      const nextByForce: Record<string, string[]> = {};
      for (const [force, list] of Object.entries(byForce)) {
        const forceKey = force === from ? next : force;
        nextByForce[forceKey] = list;
      }
      rank_force_wings[rank] = nextByForce;
    }
    for (const [rank, byForce] of Object.entries(prev.rank_equivalents)) {
      const nextByForce: Record<string, string[]> = {};
      for (const [force, list] of Object.entries(byForce)) {
        const forceKey = force === from ? next : force;
        nextByForce[forceKey] = list;
      }
      rank_equivalents[rank] = nextByForce;
    }
    const linked = prev.force_ranks[from] ?? [];
    const force_ranks = { ...prev.force_ranks };
    delete force_ranks[from];
    force_ranks[next] = linked;
    const linkedExtras = prev.force_rank_extras[from] ?? [];
    const force_rank_extras = { ...prev.force_rank_extras };
    delete force_rank_extras[from];
    force_rank_extras[next] = linkedExtras;
    const linkedRemoved = prev.force_rank_removed[from] ?? [];
    const force_rank_removed = { ...prev.force_rank_removed };
    delete force_rank_removed[from];
    force_rank_removed[next] = linkedRemoved;
    const linkedLabels = prev.force_rank_labels[from] ?? {};
    const force_rank_labels = { ...prev.force_rank_labels };
    delete force_rank_labels[from];
    force_rank_labels[next] = linkedLabels;
    const linkedLabelsBn = prev.force_rank_labels_bn[from] ?? {};
    const force_rank_labels_bn = { ...prev.force_rank_labels_bn };
    delete force_rank_labels_bn[from];
    force_rank_labels_bn[next] = linkedLabelsBn;
    const linkedSerials = prev.force_rank_serials[from] ?? {};
    const force_rank_serials = { ...prev.force_rank_serials };
    delete force_rank_serials[from];
    force_rank_serials[next] = linkedSerials;
    const force_labels = { ...(prev.force_labels ?? {}) };
    if (force_labels[from]) {
      force_labels[next] = force_labels[from];
      delete force_labels[from];
    }
    const full = normalizeLabel(elaborate ?? "");
    if (full) force_labels[next] = full;
    else if (elaborate !== undefined) delete force_labels[next];
    const force_labels_bn = { ...(prev.force_labels_bn ?? {}) };
    if (force_labels_bn[from]) {
      force_labels_bn[next] = force_labels_bn[from];
      delete force_labels_bn[from];
    }
    if (bangla !== undefined) {
      const bn = normalizeLabel(bangla);
      if (bn) force_labels_bn[next] = bn;
      else delete force_labels_bn[next];
    }
    const force_serials = { ...(prev.force_serials ?? {}) };
    if (force_serials[from] != null) {
      force_serials[next] = force_serials[from];
      delete force_serials[from];
    }
    if (serial !== undefined) {
      if (typeof serial === "number" && Number.isFinite(serial) && serial > 0) {
        force_serials[next] = Math.floor(serial);
      } else {
        delete force_serials[next];
      }
    }
    return {
      ...prev,
      forces: prev.forces.map((f) => (f === from ? next : f)),
      force_labels,
      force_labels_bn,
      force_serials,
      force_ranks,
      force_rank_extras,
      force_rank_removed,
      force_rank_labels,
      force_rank_labels_bn,
      force_rank_serials,
      rank_forces,
      rank_force_wings,
      rank_equivalents,
      users: prev.users.map((u) =>
        u.force === from ? { ...u, force: next } : u,
      ),
    };
  });
  persistAppStateNow();
  return true;
}

export function removeRank(label: string) {
  setState((prev) => {
    const rank_forces = { ...prev.rank_forces };
    const rank_force_wings = { ...prev.rank_force_wings };
    const rank_equivalents = { ...prev.rank_equivalents };
    delete rank_forces[label];
    delete rank_force_wings[label];
    delete rank_equivalents[label];
    const rank_labels = { ...prev.rank_labels };
    delete rank_labels[label];
    const rank_labels_bn = { ...(prev.rank_labels_bn ?? {}) };
    delete rank_labels_bn[label];
    const rank_serials = { ...(prev.rank_serials ?? {}) };
    delete rank_serials[label];
    return {
      ...prev,
      ranks: prev.ranks.filter((r) => r !== label),
      rank_forces,
      rank_force_wings,
      rank_equivalents,
      rank_labels,
      rank_labels_bn,
      rank_serials,
      authorized: prev.authorized.filter(
        (r) => r.label.toLowerCase() !== label.toLowerCase(),
      ),
    };
  });
  persistAppStateNow();
}

export function removeWing(label: string) {
  setState((prev) => {
    const drop = new Set(
      wingSubtree(label, prev.wings, prev.wing_parent).map((w) =>
        w.toLowerCase(),
      ),
    );
    const rank_force_wings: Record<string, Record<string, string[]>> = {};
    for (const [rank, byForce] of Object.entries(prev.rank_force_wings)) {
      const nextByForce: Record<string, string[]> = {};
      for (const [force, list] of Object.entries(byForce)) {
        nextByForce[force] = list.filter((w) => !drop.has(w.toLowerCase()));
      }
      rank_force_wings[rank] = nextByForce;
    }
    const wing_parent: Record<string, string> = {};
    for (const [child, parent] of Object.entries(prev.wing_parent)) {
      if (drop.has(child.toLowerCase()) || drop.has(parent.toLowerCase())) {
        continue;
      }
      wing_parent[child] = parent;
    }
    const wing_labels = { ...prev.wing_labels };
    const wing_labels_bn = { ...(prev.wing_labels_bn ?? {}) };
    const wing_serials = { ...(prev.wing_serials ?? {}) };
    for (const w of drop) {
      for (const key of Object.keys(wing_labels)) {
        if (key.toLowerCase() === w) delete wing_labels[key];
      }
      for (const key of Object.keys(wing_labels_bn)) {
        if (key.toLowerCase() === w) delete wing_labels_bn[key];
      }
      for (const key of Object.keys(wing_serials)) {
        if (key.toLowerCase() === w) delete wing_serials[key];
      }
    }
    const authorized = prev.authorized.map((row) => {
      const wings: Record<string, number> = {};
      for (const [w, n] of Object.entries(row.wings ?? {})) {
        if (drop.has(w.toLowerCase())) continue;
        wings[w] = n;
      }
      return { ...row, wings, count: sumWingAuth(wings) };
    });
    return {
      ...prev,
      wings: prev.wings.filter((w) => !drop.has(w.toLowerCase())),
      wing_parent,
      wing_labels,
      wing_labels_bn,
      wing_serials,
      rank_force_wings,
      authorized,
    };
  });
  persistAppStateNow();
}

export function removeForce(label: string) {
  setState((prev) => {
    const rank_forces: Record<string, string[]> = {};
    const rank_force_wings: Record<string, Record<string, string[]>> = {};
    const rank_equivalents: Record<string, Record<string, string[]>> = {};
    for (const [rank, list] of Object.entries(prev.rank_forces)) {
      rank_forces[rank] = list.filter((f) => f !== label);
    }
    for (const [rank, byForce] of Object.entries(prev.rank_force_wings)) {
      const nextByForce = { ...byForce };
      delete nextByForce[label];
      rank_force_wings[rank] = nextByForce;
    }
    for (const [rank, byForce] of Object.entries(prev.rank_equivalents)) {
      const nextByForce = { ...byForce };
      delete nextByForce[label];
      rank_equivalents[rank] = nextByForce;
    }
    const force_ranks = { ...prev.force_ranks };
    delete force_ranks[label];
    const force_rank_extras = { ...prev.force_rank_extras };
    delete force_rank_extras[label];
    const force_rank_removed = { ...prev.force_rank_removed };
    delete force_rank_removed[label];
    const force_rank_labels = { ...prev.force_rank_labels };
    delete force_rank_labels[label];
    const force_rank_labels_bn = { ...prev.force_rank_labels_bn };
    delete force_rank_labels_bn[label];
    const force_rank_serials = { ...prev.force_rank_serials };
    delete force_rank_serials[label];
    const force_labels = { ...(prev.force_labels ?? {}) };
    delete force_labels[label];
    const force_labels_bn = { ...(prev.force_labels_bn ?? {}) };
    delete force_labels_bn[label];
    const force_serials = { ...(prev.force_serials ?? {}) };
    delete force_serials[label];
    return {
      ...prev,
      forces: prev.forces.filter((f) => f !== label),
      force_labels,
      force_labels_bn,
      force_serials,
      force_ranks,
      force_rank_extras,
      force_rank_removed,
      force_rank_labels,
      force_rank_labels_bn,
      force_rank_serials,
      rank_forces,
      rank_force_wings,
      rank_equivalents,
    };
  });
  persistAppStateNow();
}

/** Toggle service rank under a force. Defaults + user extras allowed. */
export function toggleForceRank(force: string, rank: string) {
  setState((prev) => {
    if (!prev.forces.includes(force)) return prev;
    const ladder =
      FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? [];
    const extras = prev.force_rank_extras[force] ?? [];
    const removed = prev.force_rank_removed[force] ?? [];
    const choices = [
      ...ladder.filter(
        (r) => !removed.some((x) => x.toLowerCase() === r.toLowerCase()),
      ),
      ...extras,
    ];
    const onChoice = choices.some(
      (r) => r.toLowerCase() === rank.toLowerCase(),
    );
    if (!onChoice) return prev;
    const canon =
      choices.find((r) => r.toLowerCase() === rank.toLowerCase()) ?? rank;
    const current = prev.force_ranks[force] ?? [];
    const on = current.some((r) => r.toLowerCase() === canon.toLowerCase());
    return {
      ...prev,
      force_ranks: {
        ...prev.force_ranks,
        [force]: on
          ? current.filter((r) => r.toLowerCase() !== canon.toLowerCase())
          : [...current, canon],
      },
    };
  });
  persistAppStateNow();
}

/** Toggle service-rank equivalent under an SRB rank + force. */
export function toggleRankEquivalent(
  rabRank: string,
  force: string,
  serviceRank: string,
) {
  setState((prev) => {
    if (!prev.ranks.includes(rabRank) || !prev.forces.includes(force)) {
      return prev;
    }
    const ladder =
      FORCE_DEFAULT_RANKS[force as (typeof FORCES)[number]] ?? [];
    const extras = prev.force_rank_extras[force] ?? [];
    const removed = prev.force_rank_removed[force] ?? [];
    const choices = [
      ...ladder.filter(
        (r) => !removed.some((x) => x.toLowerCase() === r.toLowerCase()),
      ),
      ...extras,
    ];
    const canon =
      choices.find((r) => r.toLowerCase() === serviceRank.toLowerCase()) ??
      null;
    if (!canon) return prev;

    const byForce = { ...(prev.rank_equivalents[rabRank] ?? {}) };
    const current = byForce[force] ?? [];
    const on = current.some((r) => r.toLowerCase() === canon.toLowerCase());
    const nextList = on
      ? current.filter((r) => r.toLowerCase() !== canon.toLowerCase())
      : [...current, canon];
    if (nextList.length === 0) delete byForce[force];
    else byForce[force] = nextList;

    const linkedForces = Object.keys(byForce);
    return {
      ...prev,
      rank_equivalents: {
        ...prev.rank_equivalents,
        [rabRank]: byForce,
      },
      rank_forces: {
        ...prev.rank_forces,
        [rabRank]: linkedForces,
      },
    };
  });
}

/** Toggle force under a rank. Unassign also clears nested wings + equivalents. */
export function toggleRankForce(rank: string, force: string) {
  setState((prev) => {
    if (!prev.ranks.includes(rank) || !prev.forces.includes(force)) {
      return prev;
    }
    const current = prev.rank_forces[rank] ?? [];
    const on = current.includes(force);
    const rank_forces = {
      ...prev.rank_forces,
      [rank]: on
        ? current.filter((f) => f !== force)
        : [...current, force],
    };
    const byForce = { ...(prev.rank_force_wings[rank] ?? {}) };
    const byEquiv = { ...(prev.rank_equivalents[rank] ?? {}) };
    if (on) {
      delete byForce[force];
      delete byEquiv[force];
    } else if (!byForce[force]) {
      byForce[force] = [];
    }
    return {
      ...prev,
      rank_forces,
      rank_force_wings: {
        ...prev.rank_force_wings,
        [rank]: byForce,
      },
      rank_equivalents: {
        ...prev.rank_equivalents,
        [rank]: byEquiv,
      },
    };
  });
}

/** Toggle wing under a rank+force. Auto-assigns force if needed. */
export function toggleRankForceWing(
  rank: string,
  force: string,
  wing: string,
) {
  setState((prev) => {
    if (
      !prev.ranks.includes(rank) ||
      !prev.forces.includes(force) ||
      !prev.wings.includes(wing)
    ) {
      return prev;
    }
    const forcesForRank = prev.rank_forces[rank] ?? [];
    const forceOn = forcesForRank.includes(force);
    const nextForces = forceOn ? forcesForRank : [...forcesForRank, force];
    const byForce = { ...(prev.rank_force_wings[rank] ?? {}) };
    const current = byForce[force] ?? [];
    const on = current.includes(wing);
    byForce[force] = on
      ? current.filter((w) => w !== wing)
      : [...current, wing];
    return {
      ...prev,
      rank_forces: {
        ...prev.rank_forces,
        [rank]: nextForces,
      },
      rank_force_wings: {
        ...prev.rank_force_wings,
        [rank]: byForce,
      },
    };
  });
}

export function listMemberBanks(): string[] {
  return getState().member_banks;
}

export function addMemberBank(label: string): string | null {
  const next = normalizeLabel(label);
  if (!next) return null;
  const key = next.toLowerCase();
  if (listMemberBanks().some((b) => b.toLowerCase() === key)) return null;
  setState((prev) => ({
    ...prev,
    member_banks: [...prev.member_banks, next],
  }));
  return next;
}

export function renameMemberBank(from: string, to: string): boolean {
  const next = normalizeLabel(to);
  if (!next) return false;
  const key = next.toLowerCase();
  const banks = listMemberBanks();
  if (!banks.includes(from)) return false;
  if (banks.some((b) => b !== from && b.toLowerCase() === key)) return false;
  setState((prev) => ({
    ...prev,
    member_banks: prev.member_banks.map((b) => (b === from ? next : b)),
    users: prev.users.map((u) =>
      u.bank_name === from ? { ...u, bank_name: next } : u,
    ),
  }));
  return true;
}

export function removeMemberBank(label: string) {
  setState((prev) => ({
    ...prev,
    member_banks: prev.member_banks.filter((b) => b !== label),
  }));
}


function newAuthorizedId() {
  return `auth_${Math.random().toString(36).slice(2, 10)}`;
}

function sumWingAuth(wings: Record<string, number>): number {
  let sum = 0;
  for (const n of Object.values(wings)) sum += n;
  return sum;
}

function cleanWingAuth(raw: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  for (const [wing, count] of Object.entries(raw)) {
    const w = normalizeLabel(wing);
    if (!w || BANNED_WINGS.has(w.toLowerCase())) continue;
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) continue;
    out[w] = Math.floor(n);
  }
  return out;
}

export function listAuthorized() {
  return getState().authorized;
}

export function addAuthorized(label: string, count = 0): string | null {
  const next = normalizeLabel(label);
  if (!next) return null;
  const key = next.toLowerCase();
  if (listAuthorized().some((r) => r.label.toLowerCase() === key)) return null;
  const id = newAuthorizedId();
  setState((prev) => ({
    ...prev,
    authorized: [
      ...prev.authorized,
      // count always from wings; unused arg kept for call-site compat
      { id, label: next, count: 0, wings: {} },
    ],
  }));
  void count;
  return id;
}

export function updateAuthorized(
  id: string,
  patch: { label?: string; count?: number },
): boolean {
  const rows = listAuthorized();
  const current = rows.find((r) => r.id === id);
  if (!current) return false;
  const label =
    patch.label !== undefined ? normalizeLabel(patch.label) : current.label;
  if (!label) return false;
  const key = label.toLowerCase();
  if (rows.some((r) => r.id !== id && r.label.toLowerCase() === key)) return false;
  const wings = cleanWingAuth(current.wings);
  const count = sumWingAuth(wings);
  setState((prev) => ({
    ...prev,
    authorized: prev.authorized.map((r) =>
      r.id === id ? { ...r, label, count, wings } : r,
    ),
  }));
  return true;
}

/** Set প্রাধিকৃত for one wing under a category. Total count = sum of wings. */
export function setAuthorizedWingCount(
  id: string,
  wing: string,
  count: number,
): boolean {
  const wingLabel = normalizeLabel(wing);
  if (!wingLabel || BANNED_WINGS.has(wingLabel.toLowerCase())) return false;
  const rows = listAuthorized();
  if (!rows.some((r) => r.id === id)) return false;
  const safe =
    Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
  const collapseAdmin = isAdminAuthorizedRoot(wingLabel);
  setState((prev) => ({
    ...prev,
    authorized: prev.authorized.map((r) => {
      if (r.id !== id) return r;
      const wings = { ...cleanWingAuth(r.wings) };
      if (collapseAdmin) {
        for (const key of Object.keys(wings)) {
          if (isAdminAuthorizedRoot(key)) delete wings[key];
        }
        if (safe > 0) wings.Admin = safe;
      } else if (safe === 0) {
        delete wings[wingLabel];
      } else {
        wings[wingLabel] = safe;
      }
      return { ...r, wings, count: sumWingAuth(wings) };
    }),
  }));
  return true;
}

/** Set Officer per-wing প্রাপ্ত (held). No-op for non-Officer. */
export function setAuthorizedHeldWingCount(
  id: string,
  wing: string,
  count: number,
): boolean {
  const wingLabel = normalizeLabel(wing);
  if (!wingLabel || BANNED_WINGS.has(wingLabel.toLowerCase())) return false;
  const rows = listAuthorized();
  const row = rows.find((r) => r.id === id);
  if (!row) return false;
  const key = row.label.trim().toLowerCase();
  if (key !== "officer" && !key.startsWith("officer")) return false;
  const safe =
    Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
  const collapseAdmin = isAdminAuthorizedRoot(wingLabel);
  setState((prev) => ({
    ...prev,
    authorized: prev.authorized.map((r) => {
      if (r.id !== id) return r;
      const held_wings = { ...cleanWingAuth(r.held_wings) };
      if (collapseAdmin) {
        for (const k of Object.keys(held_wings)) {
          if (isAdminAuthorizedRoot(k)) delete held_wings[k];
        }
        if (safe > 0) held_wings.Admin = safe;
      } else if (safe === 0) {
        delete held_wings[wingLabel];
      } else {
        held_wings[wingLabel] = safe;
      }
      return { ...r, held_wings };
    }),
  }));
  return true;
}

const ABSENCE_SYNC_FIELDS = [
  "cl",
  "pl",
  "rl",
  "ml",
  "maternity",
  "training",
  "witness",
  "exam",
  "other",
  "hospital",
  "avgPresent",
] as const;

function officerPreferId(
  authorized: { id: string; label: string }[],
): string {
  const officer = authorized.find((c) => {
    const key = c.label.trim().toLowerCase();
    return key === "officer" || key.startsWith("officer");
  });
  return officer?.id ?? authorized[0]?.id ?? "officer";
}

function wingCatMap(
  day: Record<string, Record<string, number>> | undefined,
  wingLabel: string,
): Record<string, number> {
  if (!day) return {};
  if (day[wingLabel]) return { ...day[wingLabel] };
  const key = wingLabel.toLowerCase();
  for (const [k, v] of Object.entries(day)) {
    if (k.toLowerCase() === key) return { ...v };
  }
  return {};
}

function sumRecord(map: Record<string, number> | undefined): number {
  let n = 0;
  for (const v of Object.values(map ?? {})) {
    const num = Number(v);
    if (Number.isFinite(num) && num > 0) n += Math.floor(num);
  }
  return n;
}

function setDayWingMap(
  prev: Record<string, Record<string, Record<string, number>>>,
  date: string,
  wingLabel: string,
  values: Record<string, number>,
): Record<string, Record<string, Record<string, number>>> {
  let next = prev;
  for (const [key, value] of Object.entries(values)) {
    next = setDayWingCat(next, date, wingLabel, key, value);
  }
  return next;
}

function setDayWingCat(
  prev: Record<string, Record<string, Record<string, number>>>,
  date: string,
  wingLabel: string,
  categoryId: string,
  count: number,
): Record<string, Record<string, Record<string, number>>> {
  const day = { ...(prev[date] ?? {}) };
  const collapseAdmin = isAdminAuthorizedRoot(wingLabel);
  const wingKey = collapseAdmin ? "Admin" : wingLabel;
  if (collapseAdmin) {
    for (const k of Object.keys(day)) {
      if (isAdminAuthorizedRoot(k) && k !== "Admin") delete day[k];
    }
  }
  const wing = { ...(day[wingKey] ?? {}) };
  const safe =
    Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
  wing[categoryId] = safe;
  day[wingKey] = wing;
  return { ...prev, [date]: day };
}

/** Form 1 — প্রাপ্ত for one wing + rank on a date. */
export function setManpowerHeld(
  date: string,
  wing: string,
  categoryId: string,
  count: number,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !categoryId.trim()) return false;
  const wingLabel = normalizeLabel(wing);
  if (!wingLabel || BANNED_WINGS.has(wingLabel.toLowerCase())) return false;
  setState((prev) => ({
    ...prev,
    manpower_held: setDayWingCat(
      prev.manpower_held ?? {},
      date,
      wingLabel,
      categoryId,
      count,
    ),
  }));
  return true;
}

/** Form 1 — অনুপস্থিত for one wing + rank on a date. */
export function setManpowerAbsentCount(
  date: string,
  wing: string,
  categoryId: string,
  count: number,
  rankCounts?: Record<string, number>,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !categoryId.trim()) return false;
  const wingLabel = normalizeLabel(wing);
  if (!wingLabel || BANNED_WINGS.has(wingLabel.toLowerCase())) return false;
  setState((prev) => {
    const ranks = { ...(rankCounts ?? {}) };
    ranks[categoryId] = count;
    const manpower_absent = setDayWingMap(
      prev.manpower_absent ?? {},
      date,
      wingLabel,
      ranks,
    );
    const rankTotal = sumRecord(ranks);
    const detail = wingCatMap(prev.manpower_absence_detail?.[date], wingLabel);
    let rest = 0;
    for (const field of ABSENCE_SYNC_FIELDS) {
      if (field === "other") continue;
      rest += Number(detail[field] ?? 0) || 0;
    }
    const manpower_absence_detail = setDayWingCat(
      prev.manpower_absence_detail ?? {},
      date,
      wingLabel,
      "other",
      Math.max(0, rankTotal - rest),
    );
    const officer = prev.authorized.find((c) => {
      const key = c.label.trim().toLowerCase();
      return (
        c.id === categoryId &&
        (key === "officer" || key.startsWith("officer"))
      );
    });
    if (!officer) {
      return { ...prev, manpower_absent, manpower_absence_detail };
    }

    const safe =
      Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
    const collapseAdmin = isAdminAuthorizedRoot(wingLabel);
    const day = { ...(prev.manpower_officer_absent?.[date] ?? {}) };
    if (collapseAdmin) {
      for (const k of Object.keys(day)) {
        if (isAdminAuthorizedRoot(k)) delete day[k];
      }
      if (safe > 0) day.Admin = safe;
      else delete day.Admin;
    } else if (safe === 0) {
      delete day[wingLabel];
    } else {
      day[wingLabel] = safe;
    }
    const manpower_officer_absent = { ...prev.manpower_officer_absent };
    if (Object.keys(day).length === 0) delete manpower_officer_absent[date];
    else manpower_officer_absent[date] = day;
    return {
      ...prev,
      manpower_absent,
      manpower_absence_detail,
      manpower_officer_absent,
    };
  });
  return true;
}

/** Form 1 — উপস্থিত for Air Wg / Training School (one wing + rank on a date). */
export function setManpowerPresentCount(
  date: string,
  wing: string,
  categoryId: string,
  count: number,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !categoryId.trim()) return false;
  const wingLabel = normalizeLabel(wing);
  if (!wingLabel || BANNED_WINGS.has(wingLabel.toLowerCase())) return false;
  setState((prev) => ({
    ...prev,
    manpower_present: setDayWingCat(
      prev.manpower_present ?? {},
      date,
      wingLabel,
      categoryId,
      count,
    ),
  }));
  return true;
}

/** Form 1 — অনুপস্থিতির বিবরণ for Air Wg / Training School. */
export function setManpowerAbsenceDetail(
  date: string,
  wing: string,
  field: string,
  count: number,
  row?: Record<string, number>,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !field.trim()) return false;
  const wingLabel = normalizeLabel(wing);
  if (!wingLabel || BANNED_WINGS.has(wingLabel.toLowerCase())) return false;
  setState((prev) => {
    const nextRow: Record<string, number> = { ...(row ?? {}) };
    nextRow[field] = count;
    const seeded: Record<string, number> = {};
    for (const key of ABSENCE_SYNC_FIELDS) {
      const n = Number(nextRow[key] ?? 0);
      seeded[key] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
    const manpower_absence_detail = setDayWingMap(
      prev.manpower_absence_detail ?? {},
      date,
      wingLabel,
      seeded,
    );
    const detailTotal = sumRecord(seeded);
    const ranks = wingCatMap(prev.manpower_absent?.[date], wingLabel);
    const prefer = officerPreferId(prev.authorized);
    const rankTotal = sumRecord(ranks);
    ranks[prefer] = Math.max(0, (ranks[prefer] ?? 0) + (detailTotal - rankTotal));
    const manpower_absent = setDayWingMap(
      prev.manpower_absent ?? {},
      date,
      wingLabel,
      ranks,
    );
    return { ...prev, manpower_absence_detail, manpower_absent };
  });
  return true;
}

/** Form 1 — Officer অনুপস্থিত for one wing on a date. */
export function setManpowerOfficerAbsent(
  date: string,
  wing: string,
  count: number,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const wingLabel = normalizeLabel(wing);
  if (!wingLabel || BANNED_WINGS.has(wingLabel.toLowerCase())) return false;
  const safe =
    Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
  const collapseAdmin = isAdminAuthorizedRoot(wingLabel);
  setState((prev) => {
    const day = { ...(prev.manpower_officer_absent?.[date] ?? {}) };
    if (collapseAdmin) {
      for (const k of Object.keys(day)) {
        if (isAdminAuthorizedRoot(k)) delete day[k];
      }
      if (safe > 0) day.Admin = safe;
      else delete day.Admin;
    } else if (safe === 0) {
      delete day[wingLabel];
    } else {
      day[wingLabel] = safe;
    }
    const manpower_officer_absent = { ...prev.manpower_officer_absent };
    if (Object.keys(day).length === 0) delete manpower_officer_absent[date];
    else manpower_officer_absent[date] = day;
    return { ...prev, manpower_officer_absent };
  });
  return true;
}

export function setForceRankOfficer(
  date: string,
  field: "held" | "total",
  count: number,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const safe =
    Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
  setState((prev) => {
    const current = prev.force_rank_officer?.[date] ?? { held: 0, total: 0 };
    const next = { ...current, [field]: safe };
    const force_rank_officer = { ...(prev.force_rank_officer ?? {}) };
    if (!next.held && !next.total) delete force_rank_officer[date];
    else force_rank_officer[date] = next;
    return { ...prev, force_rank_officer };
  });
  persistAppStateNow();
  return true;
}

export function removeAuthorized(id: string) {
  setState((prev) => ({
    ...prev,
    authorized: prev.authorized.filter((r) => r.id !== id),
  }));
}

