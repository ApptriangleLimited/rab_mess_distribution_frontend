"use client";

import * as React from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Toast = {
  id: string;
  title: string;
  variant?: "default" | "success" | "error";
};

type ToastContextValue = {
  toast: (title: string, variant?: Toast["variant"]) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((title: string, variant: Toast["variant"] = "default") => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, title, variant }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-80 flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg",
              item.variant === "success" && "border-primary/30 bg-white text-primary",
              item.variant === "error" && "border-red-200 bg-white text-red-700",
              item.variant === "default" && "border-neutral-200 bg-white text-neutral-800",
            )}
          >
            {item.title}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
