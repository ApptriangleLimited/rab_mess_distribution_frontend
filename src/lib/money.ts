/** BDT money helpers — paisa precision (2 dp), not whole taka only. */

/** Round to nearest paisa (0.01 BDT). */
export function roundPaisa(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
}

/** Parse user/input amount → non-negative BDT with paisa. */
export function parseMoney(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return 0;
  const n =
    typeof raw === "number"
      ? raw
      : Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return roundPaisa(n);
}

/** Numeric BDT with always 2 fraction digits (paisa). */
export function formatBdtAmount(amount: number): string {
  return roundPaisa(amount).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** `৳1,234.56` */
export function formatBdt(amount: number): string {
  return `৳${formatBdtAmount(amount)}`;
}
