"use client";

import { useCallback, useEffect, useState } from "react";
import { logoutStaff } from "@/lib/api/auth";
import { isApiEnabled } from "@/lib/api/mode";
import {
  clearSession,
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
    setSessionState(getSessionFromStorage());
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
    if (isApiEnabled()) void logoutStaff();
    clearSession();
    setSessionState(null);
  }, []);

  return { session, ready, login, logout };
}
