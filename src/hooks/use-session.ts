"use client";

import { useCallback, useEffect, useState } from "react";
import { logoutStaff } from "@/lib/api/auth";
import { isCcApiEnabled } from "@/lib/api/mode";
import { isSuperAdminLogin } from "@/lib/constants";
import {
  clearSession,
  getAccessToken,
  getProfileAvatar,
  getSessionFromStorage,
  sessionMsRemaining,
  setAccessToken,
  setRefreshToken,
  setProfileAvatar,
  setSession as persistSession,
} from "@/lib/session";
import type { Role, Session } from "@/lib/types";
import { nowISO } from "@/lib/date";

export function useSession() {
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = getSessionFromStorage();
    // Cookie is host-wide on localhost. Docker :3000 often has the cookie
    // from :3001 but no JWT in this origin's localStorage → blank redirect loop.
    if (next && isCcApiEnabled() && !getAccessToken()) {
      clearSession();
      setSessionState(null);
    } else {
      setSessionState(next);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!session) return;
    const remaining = sessionMsRemaining(session);
    if (remaining <= 0) {
      if (getAccessToken()) void logoutStaff();
      clearSession();
      setSessionState(null);
      return;
    }
    const timer = window.setTimeout(() => {
      if (getAccessToken()) void logoutStaff();
      clearSession();
      setSessionState(null);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [session]);

  const login = useCallback(
    (
      role: Role,
      name: string,
      accessToken?: string,
      remember = true,
      refreshToken?: string,
      username?: string,
      avatarUrl?: string | null,
    ) => {
      if (avatarUrl) setProfileAvatar(role, avatarUrl, username);
      const next: Session = {
        role,
        name,
        username,
        loggedInAt: nowISO(),
        avatarUrl: avatarUrl || getProfileAvatar(role, username) || undefined,
        roleSwitcher: isSuperAdminLogin(username),
      };
      persistSession(next, remember);
      if (accessToken) setAccessToken(accessToken, remember);
      if (refreshToken) setRefreshToken(refreshToken, remember);
      setSessionState(next);
      return next;
    },
    [],
  );

  const logout = useCallback(() => {
    if (getAccessToken()) void logoutStaff();
    clearSession();
    setSessionState(null);
  }, []);

  const updateProfile = useCallback(
    (name: string, avatarUrl: string | null, username?: string) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          name,
          username: username ?? prev.username,
          avatarUrl: avatarUrl || undefined,
        };
        persistSession(next);
        return next;
      });
    },
    [],
  );

  return { session, ready, login, logout, updateProfile };
}
