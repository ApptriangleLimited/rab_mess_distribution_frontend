"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { IconArrowLeft } from "@tabler/icons-react";
import { PritibhojForm } from "@/components/mess/pritibhoj-form";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { MessTabs } from "@/components/layout/mess-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/toast-provider";
import { useStore } from "@/hooks/use-store";
import { todayISO } from "@/lib/date";
import {
  createPritibhojEvent,
  defaultPritibhojAdminRows,
  defaultPritibhojMainRows,
  updatePritibhojEvent,
  type PritibhojInput,
} from "@/lib/store/pritibhoj";
import type { PritibhojEvent } from "@/lib/types";
import { useT } from "@/i18n/provider";

export function emptyPritibhojInput(org: string): PritibhojInput {
  return {
    title: "",
    occasion: "",
    date: todayISO(),
    org,
    main_rows: defaultPritibhojMainRows(),
    admin_rows: defaultPritibhojAdminRows(),
  };
}

export function eventToInput(event: PritibhojEvent): PritibhojInput {
  return {
    title: event.title,
    occasion: event.occasion,
    date: event.date,
    org: event.org,
    main_rows: event.main_rows,
    admin_rows: event.admin_rows,
  };
}

export default function MessPritibhojEditorClient({
  event,
}: {
  event?: PritibhojEvent | null;
}) {
  const t = useT();
  const router = useRouter();
  const state = useStore();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState<PritibhojInput | null>(
    event ? eventToInput(event) : null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (value) return;
    if (event) {
      setValue(eventToInput(event));
      return;
    }
    if (state.wings.length === 0) return;
    setValue(emptyPritibhojInput(t("mess.pritibhoj.defaultOrg")));
  }, [event, state.wings, state.wing_parent, t, value]);

  const isEdit = Boolean(event);

  function validate(): string | null {
    if (!value) return t("common.loading");
    if (!value.title.trim()) return t("mess.pritibhoj.titleRequired");
    if (!value.date.trim()) return t("mess.pritibhoj.dateRequired");
    if (!value.main_rows.some((row) => row.wing.trim())) {
      return t("mess.pritibhoj.rowRequired");
    }
    return null;
  }

  function onSave() {
    if (!value) return;
    const error = validate();
    if (error) {
      toast(error, "error");
      return;
    }
    setSaving(true);
    try {
      const saved = event
        ? updatePritibhojEvent(event.id, value)
        : createPritibhojEvent(value);
      if (!saved) {
        toast(t("mess.pritibhoj.missing"), "error");
        return;
      }
      toast(t("mess.pritibhoj.saved"), "success");
      router.push(`/mess/pritibhoj/${saved.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PagePane className="gap-5">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-5"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-amber-50/50 to-orange-50/40 p-4 shadow-[0_10px_40px_-24px_rgba(180,83,9,0.35)] sm:p-5 dark:border-primary/25 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 dark:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl dark:bg-amber-500/10"
            aria-hidden
          />
          <div className="relative">
            <PageHeader
              title={
                isEdit
                  ? t("pages.messPritibhojEdit.title")
                  : t("pages.messPritibhojNew.title")
              }
              subtitle={
                isEdit
                  ? t("pages.messPritibhojEdit.subtitle")
                  : t("pages.messPritibhojNew.subtitle")
              }
              leading={
                <Button asChild variant="outline" size="sm" className="rounded-xl">
                  <Link href={event ? `/mess/pritibhoj/${event.id}` : "/mess/pritibhoj"}>
                    <IconArrowLeft className="h-4 w-4" />
                    {t("common.back")}
                  </Link>
                </Button>
              }
              center={<MessTabs />}
              actions={
                <Button
                  type="button"
                  variant="cta"
                  size="sm"
                  className="h-10 rounded-xl shadow-sm shadow-primary/20"
                  disabled={saving || !value}
                  onClick={onSave}
                >
                  {saving ? t("common.loading") : t("mess.pritibhoj.savePreview")}
                </Button>
              }
            />
          </div>
        </div>

        {value ? (
          <PritibhojForm value={value} onChange={setValue} />
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
      </motion.div>
    </PagePane>
  );
}
