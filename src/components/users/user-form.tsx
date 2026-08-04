"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconBuildingBank,
  IconFileUpload,
  IconId,
  IconPlus,
  IconTrash,
  IconUserPlus,
  type Icon,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/components/shared/section-card";
import { TagSelector } from "@/components/daily/tag-selector";
import { RANKS, WINGS } from "@/lib/constants";
import type { DailyTag, DocumentMeta, User, UserStatus } from "@/lib/types";
import type { UserInput } from "@/lib/store/users";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type UserFormValues = UserInput;

export type UserFormSubmitPayload = UserFormValues & {
  /** Today's duty tag — set when Daily creates a member. */
  today_tag?: DailyTag;
};

const emptyValues = (): UserFormValues => ({
  name: "",
  rab_id: "",
  rfid: "",
  rank: RANKS[0] ?? "",
  wing: WINGS[0] ?? "",
  dropdown_no: "",
  phone: "",
  documents: [],
  status: "1",
  bank_name: "",
  account_name: "",
  account_number: "",
  routing: "",
  branch: "",
});

export function userToFormValues(user: User): UserFormValues {
  return {
    name: user.name,
    rab_id: user.rab_id,
    rfid: user.rfid,
    rank: user.rank,
    wing: user.wing,
    dropdown_no: user.dropdown_no,
    phone: user.phone,
    documents: user.documents,
    status: user.status,
    bank_name: user.bank_name,
    account_name: user.account_name,
    account_number: user.account_number,
    routing: user.routing,
    branch: user.branch,
  };
}

const inputClass =
  "h-9 rounded-lg border-neutral-200 bg-neutral-50/80 px-3 text-sm shadow-none transition focus-visible:ring-primary dark:border-neutral-600 dark:bg-neutral-900/80";

const selectTriggerClass =
  "h-9 rounded-lg border-neutral-200 bg-neutral-50/80 text-sm shadow-none focus:ring-primary dark:border-neutral-600 dark:bg-neutral-900/80";

export function UserForm({
  initial,
  mode,
  onSubmit,
  onCancel,
  variant = "cc",
  initialTag = "MS",
}: {
  initial?: UserFormValues;
  mode: "create" | "edit";
  onSubmit: (values: UserFormSubmitPayload) => void;
  onCancel: () => void;
  /** CC creates pending; Daily creates approved + picks today's tag. */
  variant?: "cc" | "daily";
  initialTag?: DailyTag;
}) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [values, setValues] = useState<UserFormValues>(
    initial ?? emptyValues(),
  );
  const [todayTag, setTodayTag] = useState<DailyTag>(initialTag);
  const [dragOver, setDragOver] = useState(false);

  function patch<K extends keyof UserFormValues>(
    key: K,
    value: UserFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const docs: DocumentMeta[] = Array.from(files).map((f) => ({
      name: f.name,
      size: f.size,
    }));
    setValues((prev) => ({
      ...prev,
      documents: [...prev.documents, ...docs],
    }));
  }

  function removeDoc(index: number) {
    setValues((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (variant === "daily" && mode === "create") {
      onSubmit({ ...values, today_tag: todayTag });
      return;
    }
    onSubmit(values);
  }

  const fade = reduceMotion
    ? undefined
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {mode === "create" ? (
        <motion.div
          {...fade}
          className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 dark:bg-primary/10"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <IconUserPlus className="h-3.5 w-3.5" />
          </span>
          <p className="min-w-0 text-xs text-neutral-600 dark:text-neutral-300">
            <span className="font-semibold text-neutral-900 dark:text-white">
              {variant === "daily"
                ? t("cc.dailyCreateTitle")
                : t("cc.pendingCreateTitle")}
              .{" "}
            </span>
            {variant === "daily"
              ? t("cc.dailyCreateNote")
              : t("cc.pendingCreateNote")}
          </p>
        </motion.div>
      ) : null}

      <FormSection
        step="01"
        icon={IconId}
        title={t("cc.sectionPersonal")}
        hint={t("cc.sectionPersonalHint")}
        delay={0.03}
        reduceMotion={!!reduceMotion}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t("cc.fields.name")} className="sm:col-span-2">
            <Input
              value={values.name}
              onChange={(e) => patch("name", e.target.value)}
              required
              className={inputClass}
              placeholder={t("cc.placeholders.name")}
            />
          </Field>
          <Field label={t("cc.fields.rabId")}>
            <Input
              value={values.rab_id}
              onChange={(e) => patch("rab_id", e.target.value)}
              required
              className={inputClass}
              placeholder={t("cc.placeholders.rabId")}
            />
          </Field>
          <Field label={t("cc.fields.rfid")}>
            <Input
              value={values.rfid}
              onChange={(e) => patch("rfid", e.target.value)}
              className={inputClass}
              placeholder={t("cc.placeholders.rfid")}
            />
          </Field>
          <Field label={t("cc.fields.rank")}>
            <Select value={values.rank} onValueChange={(v) => patch("rank", v)}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder={t("cc.selectRank")} />
              </SelectTrigger>
              <SelectContent>
                {RANKS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("cc.fields.wing")}>
            <Select value={values.wing} onValueChange={(v) => patch("wing", v)}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder={t("cc.selectWing")} />
              </SelectTrigger>
              <SelectContent>
                {WINGS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("cc.fields.phone")}>
            <Input
              value={values.phone}
              onChange={(e) => patch("phone", e.target.value)}
              className={inputClass}
              placeholder={t("cc.placeholders.phone")}
            />
          </Field>
          {mode === "edit" || variant === "daily" ? (
            <Field label={t("cc.fields.status")}>
              <Select
                value={values.status}
                onValueChange={(v) => patch("status", v as UserStatus)}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("cc.statusActive")}</SelectItem>
                  <SelectItem value="0">{t("cc.statusInactive")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {variant === "daily" && mode === "create" ? (
            <Field label={t("daily.defaultTag")}>
              <TagSelector
                value={todayTag}
                onChange={(tag) => {
                  if (tag) setTodayTag(tag);
                }}
                className={selectTriggerClass}
              />
            </Field>
          ) : null}
        </div>
      </FormSection>

      <FormSection
        step="02"
        icon={IconBuildingBank}
        title={t("cc.sectionBank")}
        hint={t("cc.sectionBankHint")}
        delay={0.05}
        reduceMotion={!!reduceMotion}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t("cc.fields.bankName")} className="sm:col-span-2">
            <Input
              value={values.bank_name}
              onChange={(e) => patch("bank_name", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t("cc.fields.accountName")} className="sm:col-span-2">
            <Input
              value={values.account_name}
              onChange={(e) => patch("account_name", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t("cc.fields.accountNumber")} className="sm:col-span-2">
            <Input
              value={values.account_number}
              onChange={(e) => patch("account_number", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t("cc.fields.routing")}>
            <Input
              value={values.routing}
              onChange={(e) => patch("routing", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t("cc.fields.branch")}>
            <Input
              value={values.branch}
              onChange={(e) => patch("branch", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        step="03"
        icon={IconFileUpload}
        title={t("cc.sectionDocs")}
        hint={t("cc.docsHint")}
        delay={0.07}
        reduceMotion={!!reduceMotion}
      >
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          className={cn(
            "group flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 transition sm:px-4",
            dragOver
              ? "border-primary bg-primary/[0.06]"
              : "border-neutral-200 bg-neutral-50/50 hover:border-primary/40 dark:border-neutral-600 dark:bg-neutral-900/40",
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
            <IconPlus className="h-4 w-4 text-primary" />
          </span>
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
              {t("cc.dropDocs")}
            </p>
            <p className="text-[11px] text-neutral-500">{t("cc.addDocuments")}</p>
          </div>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>

        {values.documents.length > 0 ? (
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {values.documents.map((doc, i) => (
              <li
                key={`${doc.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-neutral-800 dark:text-neutral-100">
                    {doc.name}
                  </span>{" "}
                  <span className="text-neutral-400">
                    ({Math.round(doc.size / 1024)} KB)
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-neutral-400 hover:text-red-600"
                  onClick={() => removeDoc(i)}
                  aria-label={t("cc.removeDoc")}
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </FormSection>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="cta" size="sm" className="rounded-lg">
          {mode === "create" ? (
            <>
              <IconPlus className="h-3.5 w-3.5" />
              {t("cc.createUser")}
            </>
          ) : (
            t("cc.saveUser")
          )}
        </Button>
      </div>
    </form>
  );
}

function FormSection({
  step,
  icon: Icon,
  title,
  hint,
  children,
  delay,
  reduceMotion,
}: {
  step: string;
  icon: Icon;
  title: string;
  hint: string;
  children: React.ReactNode;
  delay: number;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: reduceMotion ? 0 : delay }}
    >
      <SectionCard className="overflow-hidden rounded-xl border-neutral-200/90 p-0 shadow-sm dark:border-neutral-700">
        <div className="flex items-center gap-2.5 border-b border-neutral-100 px-3.5 py-2.5 dark:border-neutral-700/80 md:px-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <span className="font-mono text-[10px] font-semibold tracking-wider text-primary">
                {step}
              </span>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {title}
              </h2>
              <span className="truncate text-[11px] text-neutral-400">{hint}</span>
            </div>
          </div>
        </div>
        <div className="px-3.5 py-3 md:px-4 md:py-3.5">{children}</div>
      </SectionCard>
    </motion.div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </Label>
      {children}
    </div>
  );
}
