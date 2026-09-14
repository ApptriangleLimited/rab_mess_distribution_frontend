"use client";

import { ToastProvider } from "@/components/shared/toast-provider";
import { I18nProvider } from "@/i18n/provider";
import "@/lib/api/app-sync";
import { hydrateStore } from "@/lib/store";
import { useEffect } from "react";

function StoreHydrator({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    hydrateStore();
  }, []);
  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>
        <StoreHydrator>{children}</StoreHydrator>
      </ToastProvider>
    </I18nProvider>
  );
}
