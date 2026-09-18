import {
  ACCESS_TOKEN_KEY,
  PROFILE_AVATAR_KEY,
  REFRESH_TOKEN_KEY,
  ROLE_HOMES,
  SEED_STAFF_EMAIL,
  SESSION_COOKIE,
  SESSION_STORAGE_KEY,
  SESSION_TTL_SECONDS,
} from "@/lib/constants";
import type { Role, Session } from "@/lib/types";

const COOKIE_MAX_AGE = SESSION_TTL_SECONDS;

export function isSessionExpired(session: Session | null): boolean {
  if (!session?.loggedInAt) return true;
  const started = Date.parse(session.loggedInAt);
  if (Number.isNaN(started)) return true;
  return Date.now() - started >= SESSION_TTL_SECONDS * 1000;
}

export function sessionMsRemaining(session: Session | null): number {
  if (!session?.loggedInAt) return 0;
  const started = Date.parse(session.loggedInAt);
  if (Number.isNaN(started)) return 0;
  return Math.max(0, SESSION_TTL_SECONDS * 1000 - (Date.now() - started));
}

function peekJsonSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Session;
    if (!data?.role || !data?.name) return null;
    return data;
  } catch {
    return null;
  }
}

function readJsonSession(raw: string | null): Session | null {
  const data = peekJsonSession(raw);
  if (!data || isSessionExpired(data)) return null;
  return data;
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

export function getSessionFromCookie(): Session | null {
  if (typeof document === "undefined") return null;
  const prefix = `${SESSION_COOKIE}=`;
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix));
  return parseSessionCookie(raw ? raw.slice(prefix.length) : null);
}

export function getSessionFromStorage(): Session | null {
  if (typeof window === "undefined") return null;
  const next =
    readJsonSession(localStorage.getItem(SESSION_STORAGE_KEY)) ??
    readJsonSession(sessionStorage.getItem(SESSION_STORAGE_KEY)) ??
    getSessionFromCookie();
  if (next) {
    const username = next.username || SEED_STAFF_EMAIL(next.role);
    return {
      ...next,
      username,
      avatarUrl: getProfileAvatar(next.role, username) ?? undefined,
    };
  }
  const leftover =
    peekJsonSession(localStorage.getItem(SESSION_STORAGE_KEY)) ??
    peekJsonSession(sessionStorage.getItem(SESSION_STORAGE_KEY));
  if (leftover && isSessionExpired(leftover)) clearSession();
  return null;
}

export function setSession(session: Session, remember?: boolean) {
  const persist = shouldPersist(remember);
  const payload = JSON.stringify({
    role: session.role,
    name: session.name,
    username: session.username || "",
    loggedInAt: session.loggedInAt,
  });
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

export function setRefreshToken(token: string, remember?: boolean) {
  const persist = shouldPersist(remember);
  if (persist) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } else {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function profileAvatarKey(role: Role, username?: string | null) {
  const user = (username || "").trim().toLowerCase();
  return user || role;
}

export function getProfileAvatar(role: Role, username?: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_AVATAR_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    const key = profileAvatarKey(role, username);
    return map[key] || map[role] || null;
  } catch {
    return null;
  }
}

export function setProfileAvatar(
  role: Role,
  dataUrl: string | null,
  username?: string | null,
) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PROFILE_AVATAR_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const key = profileAvatarKey(role, username);
    if (dataUrl) map[key] = dataUrl;
    else delete map[key];
    localStorage.setItem(PROFILE_AVATAR_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function homeForRole(role: Role) {
  return ROLE_HOMES[role];
}

export function isRoleAllowed(role: Role, pathname: string) {
  if (pathname.startsWith("/settings")) return true;
  if (role === "admin" && pathname.startsWith("/admin/state-reports")) {
    return false;
  }
  const map: Record<Role, string | string[]> = {
    cc: "/cc",
    daily: "/daily",
    mess: ["/mess/ledger", "/mess/pritibhoj"],
    consume: "/consume",
    /** Ration also uses Consume panels (ledger / bills / summary). */
    ration: ["/ration", "/consume"],
    /** Admin = ration panels + /admin dashboard. */
    admin: ["/admin", "/ration", "/consume"],
  };
  const allowed = map[role];
  const prefixes = Array.isArray(allowed) ? allowed : [allowed];
  return (
    pathname === "/" ||
    prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}
