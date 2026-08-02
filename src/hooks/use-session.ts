"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearSession,
  getSessionFromStorage,
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

  const login = useCallback((role: Role, name: string) => {
    const next: Session = { role, name, loggedInAt: nowISO() };
    persistSession(next);
    setSessionState(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
  }, []);

  return { session, ready, login, logout };
}
