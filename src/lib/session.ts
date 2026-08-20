import {
  ACCESS_TOKEN_KEY,
  ROLE_HOMES,
  SESSION_COOKIE,
  SESSION_STORAGE_KEY,
} from "@/lib/constants";
import type { Role, Session } from "@/lib/types";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function readJsonSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Session;
    if (!data?.role || !data?.name) return null;
    return data;
  } catch {
    return null;
  }
}

function shouldPersist(remember?: boolean): boolean {
  if (remember != null) return remember;
  return Boolean(localStorage.getItem(SESSION_STORAGE_KEY));
}

export function parseSessionCookie(value: string | undefined | null): Session | null {
  if (!value) return null;
  try {
    return readJsonSession(decodeURIComponent(value));
  } catch {
    return null;
  }
}

export function getSessionFromStorage(): Session | null {
  if (typeof window === "undefined") return null;
  return (
    readJsonSession(localStorage.getItem(SESSION_STORAGE_KEY)) ??
    readJsonSession(sessionStorage.getItem(SESSION_STORAGE_KEY))
  );
}

export function setSession(session: Session, remember?: boolean) {
  const persist = shouldPersist(remember);
  const payload = JSON.stringify(session);
  const encoded = encodeURIComponent(payload);
  if (persist) {
    localStorage.setItem(SESSION_STORAGE_KEY, payload);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    document.cookie = `${SESSION_COOKIE}=${encoded}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } else {
    sessionStorage.setItem(SESSION_STORAGE_KEY, payload);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    document.cookie = `${SESSION_COOKIE}=${encoded}; path=/; SameSite=Lax`;
  }
}

export function setAccessToken(token: string, remember?: boolean) {
  const persist = shouldPersist(remember);
  if (persist) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } else {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function homeForRole(role: Role) {
  return ROLE_HOMES[role];
}

export function isRoleAllowed(role: Role, pathname: string) {
  if (pathname.startsWith("/settings")) return true;
  const map: Record<Role, string | string[]> = {
    cc: "/cc",
    daily: "/daily",
    mess: "/mess",
    consume: "/consume",
    /** Ration also uses Consume panels (ledger / bills / summary). */
    ration: ["/ration", "/consume"],
    /** Admin = ration panels + /admin dashboard + meal planning/reports. */
    admin: [
      "/admin",
      "/ration",
      "/consume",
      "/mess/planning",
      "/mess/reports",
      "/mess/guests",
    ],
  };
  const allowed = map[role];
  const prefixes = Array.isArray(allowed) ? allowed : [allowed];
  return (
    pathname === "/" ||
    prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}
