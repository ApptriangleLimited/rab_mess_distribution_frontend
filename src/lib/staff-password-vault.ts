const KEY = "mess_staff_password_vault_v1";

function readVault(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function rememberStaffPassword(id: string, password: string) {
  if (typeof window === "undefined" || !id || !password) return;
  const next = { ...readVault(), [id]: password };
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function recalledStaffPassword(id: string): string | null {
  const value = readVault()[id];
  return value?.trim() ? value : null;
}
