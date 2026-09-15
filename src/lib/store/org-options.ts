import {
  FORCE_DEFAULT_RANKS,
  FORCES,
  LEGACY_FORM1_WINGS,
  LEGACY_WINGS,
  WINGS,
  authorizedIdForLabel,
} from "@/lib/constants";
import { getState, setState } from "@/lib/store";

const BANNED_WINGS = new Set(
  [...LEGACY_WINGS, ...LEGACY_FORM1_WINGS].map((w) => w.toLowerCase()),
);

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function listRanks(): string[] {
  return getState().ranks;
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
    return live.filter((w) => !wingParent[w]);
  }
  const parents = (Array.isArray(parent) ? parent : [parent]).map((p) =>
    p.trim().toLowerCase(),
  );
  return live.filter((w) => parents.includes((wingParent[w] ?? "").trim().toLowerCase()));
}

export function listWingChildren(parent: string | null): string[] {
  const { wings, wing_parent } = getState();
  return listWingChildrenFrom(wings, wing_parent, parent);
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
 * Fixed short wing ladder for Settings → Authorized only.
 * Same order as Form 1 / official daily sheet; Admin stands for Admin family.
 */
const AUTHORIZED_ROOT_WINGS = WINGS;

/**
 * Root wings for Settings → Authorized wing প্রাধিকৃত.
 * Short fixed list (not full Wings catalog). Other tabs unchanged.
 */
export function listAuthorizedRootWingsFrom(wings: string[]): string[] {
  const live = new Set(
    wings
      .filter((w) => !BANNED_WINGS.has(w.toLowerCase()))
      .map((w) => w.toLowerCase()),
  );
  // Admin always offered when any Admin* root exists or Admin in catalog.
  const hasAdmin = [...live].some((k) => ADMIN_AUTH_ROOTS.has(k));
  const out: string[] = [];
  for (const w of AUTHORIZED_ROOT_WINGS) {
    if (w === "Admin") {
      if (hasAdmin || live.has("admin")) out.push("Admin");
      continue;
    }
    if (live.has(w.toLowerCase())) out.push(w);
  }
  return out;
}

export function listAuthorizedRootWings(): string[] {
  return listAuthorizedRootWingsFrom(listWings());
}

/** Count for Authorized UI row (Admin = sum of Admin family keys). */
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
  return map[wing] ?? 0;
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
  return getState().forces;
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

export function addRank(label: string, elaborate?: string): string | null {
  const next = normalizeLabel(label);
  if (!next) return null;
  const key = next.toLowerCase();
  if (listRanks().some((r) => r.toLowerCase() === key)) return null;
  const full = normalizeLabel(elaborate ?? "");
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
        : prev.rank_labels,
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
  return next;
}

/** Add service rank under a force (short + optional full name). */
export function addForceRank(
  force: string,
  short: string,
  elaborate?: string,
): string | null {
  const next = normalizeLabel(short);
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
    };
  });
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
): boolean {
  const next = normalizeLabel(to);
  if (!next || !from) return false;
  const fromKey = from.toLowerCase();
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
        nextRemoved = [...nextRemoved, from];
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
    const oldLabel = labels[from];
    delete labels[from];
    const full = normalizeLabel(elaborate ?? "");
    if (full) labels[next] = full;
    else if (oldLabel && toKey === fromKey) labels[next] = oldLabel;
    else if (oldLabel && toKey !== fromKey) labels[next] = oldLabel;

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
  return choices.some((r) => r.toLowerCase() === toKey);
}

/** Delete service rank under a force (extras gone; defaults hidden). */
export function removeForceRank(force: string, rank: string) {
  const key = normalizeLabel(rank).toLowerCase();
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
}

export function addWing(
  label: string,
  parent?: string | null,
  elaborate?: string,
): string | null {
  const next = normalizeLabel(label);
  if (!next) return null;
  const key = next.toLowerCase();
  if (BANNED_WINGS.has(key)) return null;
  if (listWings().some((w) => w.toLowerCase() === key)) return null;
  const parentLabel = parent ? normalizeLabel(parent) : "";
  const full = normalizeLabel(elaborate ?? "");
  setState((prev) => {
    if (parentLabel && !prev.wings.includes(parentLabel)) return prev;
    const wing_parent = { ...prev.wing_parent };
    if (parentLabel) wing_parent[next] = parentLabel;
    return {
      ...prev,
      wings: [...prev.wings, next],
      wing_parent,
      wing_labels: full
        ? { ...prev.wing_labels, [next]: full }
        : prev.wing_labels,
    };
  });
  return getState().wings.some((w) => w.toLowerCase() === key) ? next : null;
}

export function addForce(label: string): string | null {
  const next = normalizeLabel(label);
  if (!next) return null;
  const key = next.toLowerCase();
  if (listForces().some((f) => f.toLowerCase() === key)) return null;
  setState((prev) => ({
    ...prev,
    forces: [...prev.forces, next],
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
  }));
  return next;
}

export function renameRank(from: string, to: string): boolean {
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
    const rank_labels = { ...prev.rank_labels };
    if (rank_labels[from]) {
      rank_labels[next] = rank_labels[from];
      delete rank_labels[from];
    }
    return {
      ...prev,
      ranks: prev.ranks.map((r) => (r === from ? next : r)),
      rank_forces,
      rank_force_wings,
      rank_equivalents,
      rank_labels,
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
  return true;
}

export function renameWing(
  from: string,
  to: string,
  elaborate?: string,
): boolean {
  const next = normalizeLabel(to);
  if (!next) return false;
  const key = next.toLowerCase();
  if (BANNED_WINGS.has(key)) return false;
  const wings = listWings();
  if (!wings.includes(from)) return false;
  if (wings.some((w) => w !== from && w.toLowerCase() === key)) return false;
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
      rank_force_wings,
      authorized,
      manpower_officer_absent,
      manpower_held: renameDayWingCat(prev.manpower_held ?? {}),
      manpower_absent: renameDayWingCat(prev.manpower_absent ?? {}),
      users: prev.users.map((u) =>
        u.wing === from ? { ...u, wing: next } : u,
      ),
    };
  });
  return true;
}

export function renameForce(from: string, to: string): boolean {
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
    return {
      ...prev,
      forces: prev.forces.map((f) => (f === from ? next : f)),
      force_ranks,
      force_rank_extras,
      force_rank_removed,
      force_rank_labels,
      rank_forces,
      rank_force_wings,
      rank_equivalents,
    };
  });
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
    return {
      ...prev,
      ranks: prev.ranks.filter((r) => r !== label),
      rank_forces,
      rank_force_wings,
      rank_equivalents,
      rank_labels,
      authorized: prev.authorized.filter(
        (r) => r.label.toLowerCase() !== label.toLowerCase(),
      ),
    };
  });
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
    for (const w of drop) {
      for (const key of Object.keys(wing_labels)) {
        if (key.toLowerCase() === w) delete wing_labels[key];
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
      rank_force_wings,
      authorized,
    };
  });
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
    return {
      ...prev,
      forces: prev.forces.filter((f) => f !== label),
      force_ranks,
      force_rank_extras,
      force_rank_removed,
      force_rank_labels,
      rank_forces,
      rank_force_wings,
      rank_equivalents,
    };
  });
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
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !categoryId.trim()) return false;
  const wingLabel = normalizeLabel(wing);
  if (!wingLabel || BANNED_WINGS.has(wingLabel.toLowerCase())) return false;
  setState((prev) => {
    const manpower_absent = setDayWingCat(
      prev.manpower_absent ?? {},
      date,
      wingLabel,
      categoryId,
      count,
    );
    const officer = prev.authorized.find((c) => {
      const key = c.label.trim().toLowerCase();
      return (
        c.id === categoryId &&
        (key === "officer" || key.startsWith("officer"))
      );
    });
    if (!officer) return { ...prev, manpower_absent };

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
    return { ...prev, manpower_absent, manpower_officer_absent };
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

export function removeAuthorized(id: string) {
  setState((prev) => ({
    ...prev,
    authorized: prev.authorized.filter((r) => r.id !== id),
  }));
}

