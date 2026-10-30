import type {
  PritibhojBucket,
  PritibhojCellRoster,
  PritibhojColumn,
  PritibhojRoster,
  PritibhojSheetId,
} from "@/lib/types";

const BUCKETS: PritibhojBucket[] = [
  "officer",
  "dad",
  "azadHall",
  "others",
  "civilian",
  "nonMuslim",
  "azadHallDist",
];

const MANUAL: ReadonlySet<PritibhojBucket> = new Set([
  "officer",
  "azadHall",
  "azadHallDist",
]);

export function pritibhojRosterKey(sheet: PritibhojSheetId, wing: string) {
  return `${sheet}:${wing.trim()}`;
}

export function blankPritibhojCell(): PritibhojCellRoster {
  return { removed: [], added: [], edits: {} };
}

function idList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const id = String(item ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function normalizePritibhojRoster(raw: unknown): PritibhojRoster {
  if (!raw || typeof raw !== "object") return {};
  const out: PritibhojRoster = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const cells: Partial<Record<PritibhojBucket, PritibhojCellRoster>> = {};
    for (const bucket of BUCKETS) {
      const cell = (value as Record<string, unknown>)[bucket];
      if (!cell || typeof cell !== "object") continue;
      const row = cell as Record<string, unknown>;
      const edits: PritibhojCellRoster["edits"] = {};
      if (row.edits && typeof row.edits === "object") {
        for (const [id, edit] of Object.entries(
          row.edits as Record<string, unknown>,
        )) {
          if (!id.trim() || !edit || typeof edit !== "object") continue;
          const fields = edit as Record<string, unknown>;
          const name = String(fields.name ?? "").trim();
          const phone = String(fields.phone ?? "").trim();
          if (!name && !phone) continue;
          edits[id] = {
            ...(name ? { name } : {}),
            ...(phone ? { phone } : {}),
          };
        }
      }
      cells[bucket] = {
        removed: idList(row.removed),
        added: idList(row.added),
        edits,
        ...(row.managed === true ? { managed: true } : {}),
      };
    }
    if (Object.keys(cells).length > 0) out[key] = cells;
  }
  return out;
}

export function readPritibhojCell(
  roster: PritibhojRoster | undefined,
  sheet: PritibhojSheetId,
  wing: string,
  bucket: PritibhojBucket,
): PritibhojCellRoster {
  return (
    roster?.[pritibhojRosterKey(sheet, wing)]?.[bucket] ?? blankPritibhojCell()
  );
}

export function writePritibhojCell(
  roster: PritibhojRoster | undefined,
  sheet: PritibhojSheetId,
  wing: string,
  bucket: PritibhojBucket,
  cell: PritibhojCellRoster,
): PritibhojRoster {
  const key = pritibhojRosterKey(sheet, wing);
  return {
    ...(roster ?? {}),
    [key]: {
      ...(roster?.[key] ?? {}),
      [bucket]: cell,
    },
  };
}

export function excludePritibhojMember(
  roster: PritibhojRoster | undefined,
  sheet: PritibhojSheetId,
  wing: string,
  bucket: PritibhojBucket,
  memberId: string,
): PritibhojRoster {
  const cell = readPritibhojCell(roster, sheet, wing, bucket);
  return writePritibhojCell(roster, sheet, wing, bucket, {
    ...cell,
    added: cell.added.filter((id) => id !== memberId),
    removed: cell.removed.includes(memberId)
      ? cell.removed
      : [...cell.removed, memberId],
    ...(MANUAL.has(bucket) ? { managed: true } : {}),
  });
}

export function addPritibhojMember(
  roster: PritibhojRoster | undefined,
  sheet: PritibhojSheetId,
  wing: string,
  bucket: PritibhojBucket,
  memberId: string,
): PritibhojRoster {
  const cell = readPritibhojCell(roster, sheet, wing, bucket);
  return writePritibhojCell(roster, sheet, wing, bucket, {
    ...cell,
    removed: cell.removed.filter((id) => id !== memberId),
    added: cell.added.includes(memberId)
      ? cell.added
      : [...cell.added, memberId],
    ...(MANUAL.has(bucket) ? { managed: true } : {}),
  });
}

export function editPritibhojMember(
  roster: PritibhojRoster | undefined,
  sheet: PritibhojSheetId,
  wing: string,
  bucket: PritibhojBucket,
  memberId: string,
  edit: { name?: string; phone?: string },
): PritibhojRoster {
  const cell = readPritibhojCell(roster, sheet, wing, bucket);
  const name = edit.name?.trim() ?? "";
  const phone = edit.phone?.trim() ?? "";
  const edits = { ...cell.edits };
  if (!name && !phone) delete edits[memberId];
  else {
    edits[memberId] = {
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
    };
  }
  return writePritibhojCell(roster, sheet, wing, bucket, { ...cell, edits });
}

export function pritibhojAddBuckets(column: PritibhojColumn): PritibhojBucket[] {
  switch (column) {
    case "distribution":
      return ["dad"];
    case "total":
    case "distribution2":
      return ["others", "civilian", "nonMuslim"];
    case "totalDistribution":
      return ["dad", "others", "civilian", "nonMuslim"];
    default:
      return [column];
  }
}

export function isManualPritibhojColumn(column: PritibhojColumn) {
  return (
    column === "officer" || column === "azadHall" || column === "azadHallDist"
  );
}

export function isFormulaPritibhojColumn(column: PritibhojColumn) {
  return (
    column === "distribution" ||
    column === "total" ||
    column === "distribution2" ||
    column === "totalDistribution"
  );
}
