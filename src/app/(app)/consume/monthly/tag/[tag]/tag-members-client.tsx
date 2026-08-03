"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DAILY_TAGS } from "@/lib/constants";
import { previousMonthKey } from "@/lib/date";
import type { DailyTag } from "@/lib/types";

function parseTag(raw: string | string[] | undefined): DailyTag | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  return DAILY_TAGS.some((item) => item.code === value)
    ? (value as DailyTag)
    : null;
}

/** Old `/tag/[tag]` URLs → monthly with `?tag=` (inline panel). */
export default function ConsumeTagRedirect() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tag = parseTag(params.tag);
  const month = searchParams.get("month") || previousMonthKey();

  useEffect(() => {
    const q = new URLSearchParams();
    q.set("month", month);
    if (tag) q.set("tag", tag);
    router.replace(`/consume/monthly?${q.toString()}`);
  }, [tag, month, router]);

  return null;
}
