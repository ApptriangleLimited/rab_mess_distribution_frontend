import { nowISO } from "@/lib/date";
import { getSessionFromStorage } from "@/lib/session";
import { getState, setState } from "@/lib/store";
import type {
  ManpowerFormId,
  PaperReportKind,
  PaperReportRequest,
  PaperReportStatus,
} from "@/lib/types";

function newId() {
  return `pr_${Math.random().toString(36).slice(2, 10)}`;
}

function actorLabel(fallback = "staff") {
  const session = getSessionFromStorage();
  if (!session) return fallback;
  return `${session.role}:${session.name}`;
}

function listAll(): PaperReportRequest[] {
  return [...(getState().paper_report_requests ?? [])];
}

function write(next: PaperReportRequest[]) {
  setState((prev) => ({ ...prev, paper_report_requests: next }));
}

export function listPaperReports(kind?: PaperReportKind): PaperReportRequest[] {
  const rows = listAll();
  const filtered = kind ? rows.filter((row) => row.kind === kind) : rows;
  return filtered.sort((a, b) => {
    const timeA = a.submitted_at || a.reviewed_at || a.date || a.id;
    const timeB = b.submitted_at || b.reviewed_at || b.date || b.id;
    const byTime = timeB.localeCompare(timeA);
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  });
}

export function pendingPaperReportCount() {
  return listAll().filter(
    (row) => row.status === "submitted" && row.kind !== "pritibhoj",
  ).length;
}

export function getManpowerPaper(
  date: string,
  form: ManpowerFormId,
): PaperReportRequest | null {
  return (
    listAll().find(
      (row) => row.kind === "manpower" && row.ref === date && row.form === form,
    ) ?? null
  );
}

export function getPritibhojPaper(eventId: string): PaperReportRequest | null {
  return (
    listAll().find((row) => row.kind === "pritibhoj" && row.ref === eventId) ??
    null
  );
}

export function isPaperApproved(
  kind: PaperReportKind,
  ref: string,
  form?: ManpowerFormId,
) {
  const row =
    kind === "manpower" && form
      ? getManpowerPaper(ref, form)
      : getPritibhojPaper(ref);
  return row?.status === "approved";
}

/** Admin verified the submitted paper. Stored status stays `approved`. */
export function isPaperVerified(
  kind: PaperReportKind,
  ref: string,
  form?: ManpowerFormId,
) {
  return isPaperApproved(kind, ref, form);
}

/** Daily may print after submit; verified papers also print. */
export function isPaperPrintable(
  kind: PaperReportKind,
  ref: string,
  form?: ManpowerFormId,
) {
  const row =
    kind === "manpower" && form
      ? getManpowerPaper(ref, form)
      : getPritibhojPaper(ref);
  return row?.status === "submitted" || row?.status === "approved";
}

function upsert(
  match: (row: PaperReportRequest) => boolean,
  patch: Omit<PaperReportRequest, "id"> & { id?: string },
): PaperReportRequest {
  const cur = listAll();
  const existing = cur.find(match);
  const row: PaperReportRequest = {
    id: existing?.id ?? patch.id ?? newId(),
    kind: patch.kind,
    ref: patch.ref,
    form: patch.form,
    title: patch.title,
    date: patch.date,
    status: patch.status,
    submitted_at: patch.submitted_at,
    submitted_by: patch.submitted_by,
    reviewed_at: patch.reviewed_at,
    reviewed_by: patch.reviewed_by,
  };
  write(existing ? cur.map((item) => (item.id === existing.id ? row : item)) : [row, ...cur]);
  return row;
}

export function saveManpowerPaper(
  date: string,
  form: ManpowerFormId,
  title: string,
): PaperReportRequest {
  const existing = getManpowerPaper(date, form);
  if (existing?.status === "approved") {
    return existing;
  }
  if (existing?.status === "submitted") {
    return upsert((row) => row.id === existing.id, {
      ...existing,
      title,
      status: "submitted",
    });
  }
  return upsert((row) => row.id === existing?.id, {
    kind: "manpower",
    ref: date,
    form,
    title,
    date,
    status: "draft",
    submitted_at: "",
    submitted_by: "",
    reviewed_at: "",
    reviewed_by: "",
  });
}

export function submitManpowerPaper(
  date: string,
  form: ManpowerFormId,
  title: string,
): PaperReportRequest {
  const existing = getManpowerPaper(date, form);
  if (existing?.status === "approved") return existing;
  return upsert((row) => row.id === existing?.id, {
    kind: "manpower",
    ref: date,
    form,
    title,
    date,
    status: "submitted",
    submitted_at: nowISO(),
    submitted_by: actorLabel("daily"),
    reviewed_at: "",
    reviewed_by: "",
  });
}

export function savePritibhojPaper(input: {
  eventId: string;
  title: string;
  date: string;
}): PaperReportRequest {
  const existing = getPritibhojPaper(input.eventId);
  if (existing?.status === "submitted" || existing?.status === "approved") {
    return existing;
  }
  return upsert((row) => row.id === existing?.id, {
    kind: "pritibhoj",
    ref: input.eventId,
    title: input.title,
    date: input.date,
    status: "draft",
    submitted_at: "",
    submitted_by: "",
    reviewed_at: "",
    reviewed_by: "",
  });
}

export function submitPritibhojPaper(input: {
  eventId: string;
  title: string;
  date: string;
}): PaperReportRequest {
  const existing = getPritibhojPaper(input.eventId);
  if (existing?.status === "approved") return existing;
  return upsert((row) => row.id === existing?.id, {
    kind: "pritibhoj",
    ref: input.eventId,
    title: input.title,
    date: input.date,
    status: "submitted",
    submitted_at: nowISO(),
    submitted_by: actorLabel("mess"),
    reviewed_at: "",
    reviewed_by: "",
  });
}

export function verifyPaperReport(id: string): PaperReportRequest | null {
  return approvePaperReport(id);
}

export function approvePaperReport(id: string): PaperReportRequest | null {
  const cur = listAll();
  const existing = cur.find((row) => row.id === id);
  if (!existing) return null;
  const row: PaperReportRequest = {
    ...existing,
    status: "approved",
    reviewed_at: nowISO(),
    reviewed_by: actorLabel("admin"),
  };
  write(cur.map((item) => (item.id === id ? row : item)));
  return row;
}

export function removePaperReportsForPritibhoj(eventId: string) {
  write(listAll().filter((row) => !(row.kind === "pritibhoj" && row.ref === eventId)));
}

export function paperStatusLabel(
  status: PaperReportStatus,
  labels: Record<PaperReportStatus, string>,
) {
  return labels[status];
}

export const PAPER_STATUS_CLASS: Record<PaperReportStatus, string> = {
  draft:
    "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
  submitted:
    "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200",
  approved:
    "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
};
