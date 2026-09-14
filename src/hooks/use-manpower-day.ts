"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import {
  listAssignments,
  type AssignmentCell,
} from "@/lib/api/assignments";
import {
  fetchManpowerDay,
  manpowerMemberToUser,
  type ManpowerDayData,
} from "@/lib/api/manpower";
import { isApiEnabled } from "@/lib/api/mode";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import { cockpitTagForMember } from "@/lib/manpower-report";
import type { DailyTag } from "@/lib/types";
import type { ManpowerSnapshot } from "@/lib/manpower-report";

export function useManpowerDay(date: string) {
  const apiOn = isApiEnabled();
  const { toast } = useToast();
  const assignments = useStore().assignments;
  const [data, setData] = useState<ManpowerDayData | null>(null);
  const [cells, setCells] = useState<AssignmentCell[]>([]);
  const [loading, setLoading] = useState(apiOn);

  useEffect(() => {
    if (!apiOn) {
      setData(null);
      setCells([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchManpowerDay(date),
      listAssignments({ from: date, to: date }).catch(() => ({ items: [] })),
    ])
      .then(([row, assignRes]) => {
        if (cancelled) return;
        setData(row);
        setCells(
          assignRes.items.filter((cell) => cell.date === date),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setCells([]);
        toast(
          err instanceof ApiClientError
            ? err.detail
            : "Could not load manpower from API.",
          "error",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOn, date, toast, assignments]);

  const snapshot: ManpowerSnapshot | undefined = useMemo(() => {
    if (!apiOn || !data) return undefined;
    const cellByMember = new Map(
      cells.map((cell) => [cell.member_id, cell]),
    );
    const tags = new Map<string, DailyTag | "">();
    for (const row of data.members) {
      tags.set(
        row.id,
        cockpitTagForMember(
          cellByMember.get(row.id),
          row.default_tag,
          row.tag,
          row.source,
        ),
      );
    }
    return {
      users: data.members.map(manpowerMemberToUser),
      tagFor: (userId) => tags.get(userId) ?? "",
      wingParent: data.wing_parent,
      authorized: data.authorized,
      officerAbsent: data.officer_absent,
      extraWings: data.members.map((row) => row.wing).filter(Boolean),
      wings: data.wings,
      prefiltered: true,
    };
  }, [apiOn, data, cells]);

  return { apiOn, loading: apiOn && loading, snapshot, data };
}
