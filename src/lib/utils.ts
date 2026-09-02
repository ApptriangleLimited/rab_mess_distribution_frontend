import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Bank account / routing — digits only (no spaces or hyphens). */
export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/** BD mobile: 11 digits, `01[3-9]…`. Strips +880 / spaces. */
export function normalizeBdPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("880")) {
    digits = `0${digits.slice(3)}`;
  }
  return digits.slice(0, 11);
}

export function isValidBdPhone(value: string): boolean {
  const digits = normalizeBdPhone(value);
  if (!digits) return true;
  return /^01[3-9]\d{8}$/.test(digits);
}
