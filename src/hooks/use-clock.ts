"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/date";

export function useClock() {
  const [clock, setClock] = useState(() => formatClock());

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatClock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return clock;
}
