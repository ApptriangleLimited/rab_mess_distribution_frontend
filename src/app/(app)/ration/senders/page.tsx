"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Bank accounts live on Settings now. */
export default function SendersPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings");
  }, [router]);
  return null;
}
