import {
  ROLE_HOMES,
  SESSION_COOKIE,
  SESSION_STORAGE_KEY,
} from "@/lib/constants";
import type { Role, Session } from "@/lib/types";

export function parseSessionCookie(value: string | undefined | null): Session | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    const data = JSON.parse(decoded) as Session;
    if (!data?.role || !data?.name) return null;
    return data;
  } catch {
    return null;
  }
}

export function getSessionFromStorage(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  const encoded = encodeURIComponent(JSON.stringify(session));
  document.cookie = `${SESSION_COOKIE}=${encoded}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

export function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function homeForRole(role: Role) {
  return ROLE_HOMES[role];
}

export function isRoleAllowed(role: Role, pathname: string) {
  if (pathname.startsWith("/settings")) return true;
  const map: Record<Role, string> = {
    cc: "/cc",
    daily: "/daily",
    mess: "/mess",
    consume: "/consume",
    ration: "/ration",
  };
  return pathname === "/" || pathname.startsWith(map[role]);
}
