export const WR_CODES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "S",
] as const;

export type WrCode = (typeof WR_CODES)[number];

export function isWrTag(tag: string | null | undefined): boolean {
  return (tag || "").toUpperCase() === "WR";
}

export function isWrCode(value: string | null | undefined): value is WrCode {
  const raw = (value || "").trim().toUpperCase();
  if (raw === "S") return true;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 15;
}

export function normalizeWrCode(
  tag: string | null | undefined,
  raw?: string | null,
): WrCode | undefined {
  if (!isWrTag(tag) || !isWrCode(raw)) return undefined;
  const value = raw.trim().toUpperCase();
  if (value === "S") return "S";
  return String(Number(value)) as WrCode;
}

export function wrHoverLabel(code?: WrCode): string {
  return code ? `WR ${code}` : "";
}
