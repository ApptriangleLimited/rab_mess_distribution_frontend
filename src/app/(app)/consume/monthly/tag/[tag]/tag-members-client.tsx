"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { monthKey } from "@/lib/date";
import { isKnownTag } from "@/lib/store/rates";
import type { DailyTag } from "@/lib/types";

function parseTag(raw: string | string[] | undefined): DailyTag | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  return isKnownTag(value) ? (value as DailyTag) : null;
}

/** Old `/tag/[tag]` URLs → monthly with `?tag=` (inline panel). */
export default function ConsumeTagRedirect() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tag = parseTag(params.tag);
  const month = searchParams.get("month") || monthKey();

  useEffect(() => {
    const q = new URLSearchParams();
    q.set("month", month);
    if (tag) q.set("tag", tag);
    router.replace(`/consume/monthly?${q.toString()}`);
  }, [tag, month, router]);

  return null;
}
