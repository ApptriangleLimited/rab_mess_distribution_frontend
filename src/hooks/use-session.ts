"use client";

import { useCallback, useEffect, useState } from "react";
import { logoutStaff } from "@/lib/api/auth";
import { isCcApiEnabled } from "@/lib/api/mode";
import {
  clearSession,
  getAccessToken,
  getSessionFromStorage,
  setAccessToken,
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

  const login = useCallback(
    (role: Role, name: string, accessToken?: string, remember = true) => {
      const next: Session = { role, name, loggedInAt: nowISO() };
      persistSession(next, remember);
      if (accessToken) setAccessToken(accessToken, remember);
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

  return { session, ready, login, logout };
}
