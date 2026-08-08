"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { UserForm, type UserFormValues } from "@/components/users/user-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast-provider";
import { createUser, findUserByRabId } from "@/lib/store/users";
import { useT } from "@/i18n/provider";

export default function RegisterPage() {
  const t = useT();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);

  function onSubmit(values: UserFormValues) {
    if (!values.name.trim()) {
      toast(t("cc.nameRequired"), "error");
      return;
    }
    if (!values.rab_id.trim()) {
      toast(t("cc.rabIdRequired"), "error");
      return;
    }
    if (findUserByRabId(values.rab_id)) {
      toast(t("cc.rabIdDuplicate"), "error");
      return;
    }
    createUser({ ...values, status: "0" }, { approval_status: "pending" });
    toast(t("register.success"), "success");
    setDone(true);
  }

  return (
    <div className="min-h-dvh bg-page-canvas">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8 md:px-6 md:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              {t("common.productName")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
              {t("register.title")}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{t("register.subtitle")}</p>
          </div>
          {!done ? (
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <Link href="/login">
                <IconArrowLeft className="h-3.5 w-3.5" />
                {t("register.backToLogin")}
              </Link>
            </Button>
          ) : null}
        </div>

        {done ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-6 py-12 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
              <IconCheck className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {t("register.success")}
            </h2>
            <p className="max-w-md text-sm text-neutral-600 dark:text-neutral-300">
              {t("register.successHint")}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setDone(false)}
              >
                {t("register.another")}
              </Button>
            </div>
          </motion.div>
        ) : (
          <UserForm
            mode="create"
            variant="public"
            onSubmit={onSubmit}
            onCancel={() => {
              window.location.href = "/login";
            }}
          />
        )}
      </div>
    </div>
  );
}
