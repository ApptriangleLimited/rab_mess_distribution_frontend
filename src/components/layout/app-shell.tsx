"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HeaderBar } from "@/components/layout/header-bar";
import { MobileDrawer, Sidebar } from "@/components/layout/sidebar";
import { useSession } from "@/hooks/use-session";
import { hydrateStore } from "@/lib/store";
import { useT } from "@/i18n/provider";

const SIDEBAR_KEY = "mess_sidebar_collapsed_v1";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, ready, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const t = useT();

  useEffect(() => {
    hydrateStore();
  }, []);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace("/login");
    }
  }, [ready, session, router]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        {t("common.loadingShell")}
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar role={session.role} collapsed={collapsed} />
      <MobileDrawer
        role={session.role}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative z-40 shrink-0">
          <HeaderBar
            session={session}
            sidebarCollapsed={collapsed}
            onToggleSidebar={toggleCollapsed}
            onMenu={() => setMobileOpen(true)}
            onLogout={() => {
              logout();
              router.replace("/login");
            }}
          />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto custom-scrollbar" key={pathname}>
          {children}
        </main>
      </div>
    </div>
  );
}
