"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconBuildingBank,
  IconCloudUpload,
  IconFile,
  IconFileUpload,
  IconId,
  IconPhoneCall,
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
import { DatePicker } from "@/components/shared/date-picker";
import { TagSelector } from "@/components/daily/tag-selector";
import { MEMBER_TYPES, RELIGIONS, BRANCH_DISTRICTS, wingDisplayLabel } from "@/lib/constants";
import { SearchableSelect } from "@/components/shared/searchable-select";
import type { DailyTag, DocumentMeta, MemberType, User, UserStatus } from "@/lib/types";
import {
  emptyEmergencyContact,
  missingUserFormRequired,
  prepareUserFormSubmit,
  clampMemberBank,
  type UserInput,
} from "@/lib/store/users";
import { useToast } from "@/components/shared/toast-provider";
import { listRanks, listWings } from "@/lib/store/org-options";
import { useStore } from "@/hooks/use-store";
import { useT } from "@/i18n/provider";
import { cn, digitsOnly, isValidBdPhone, normalizeBdPhone } from "@/lib/utils";

export type UserFormValues = UserInput;

export type UserFormSubmitPayload = UserFormValues & {
  /** Today's duty tag — set when Daily creates a member. */
  today_tag?: DailyTag;
};

const emptyValues = (): UserFormValues => ({
  name: "",
  personal_id: "",
  rab_id: "",
  rfid: "",
  rank: listRanks()[0] ?? "",
  wing: listWings()[0] ?? "",
  force: "",
  religion: "",
  member_type: "permanent",
  dropdown_no: "",
  phone: "",
  documents: [],
  documents_verified: false,
  status: "1",
  bank_name: "",
  account_name: "",
  account_number: "",
  routing: "",
  branch: "",
  branch_location: "",
  joining_date: "",
  out_date: "",
  default_tag: "MS",
  emergency_contacts: [emptyEmergencyContact()],
});

export function userToFormValues(user: User): UserFormValues {
  const contacts =
    user.emergency_contacts?.length > 0
      ? user.emergency_contacts.map((c) => ({ ...c }))
      : [emptyEmergencyContact()];
  return {
    name: user.name,
    personal_id: user.personal_id ?? "",
    rab_id: user.rab_id,
    rfid: user.rfid,
    rank: user.rank,
    wing: user.wing,
    force: user.force ?? "",
    religion: user.religion ?? "",
    member_type: user.member_type ?? "permanent",
    dropdown_no: user.dropdown_no,
    phone: user.phone,
    documents: user.documents,
    documents_verified: Boolean(user.documents_verified),
    status: user.status,
    bank_name: clampMemberBank(user.bank_name),
    account_name: user.account_name,
    account_number: user.account_number,
    routing: user.routing,
    branch: user.branch,
    branch_location: user.branch_location ?? "",
    joining_date: user.joining_date ?? "",
    out_date: user.out_date ?? "",
    default_tag: user.default_tag || "MS",
    emergency_contacts: contacts,
  };
}

const inputClass =
  "h-9 rounded-lg border-neutral-200 bg-neutral-50/80 px-3 text-sm shadow-none transition focus-visible:ring-primary dark:border-neutral-600 dark:bg-neutral-900/80";

const selectTriggerClass =
  "h-9 rounded-lg border-neutral-200 bg-neutral-50/80 text-sm shadow-none focus:ring-primary dark:border-neutral-600 dark:bg-neutral-900/80";

function resolveWingParts(
  wing: string,
  wingParent: Record<string, string>,
): { parent: string; sub: string } {
  const parent = wingParent[wing];
  if (parent) return { parent, sub: wing };
  return { parent: wing, sub: "" };
}

function rootWings(wings: string[], wingParent: Record<string, string>) {
  return wings.filter((w) => !wingParent[w]);
}

function subWingsFor(
  parent: string,
  wings: string[],
  wingParent: Record<string, string>,
) {
  return wings.filter((w) => wingParent[w] === parent);
}

function formatDocSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UserForm({
  initial,
  mode,
  onSubmit,
  onCancel,
  variant = "cc",
  initialTag = "MS",
  busy = false,
}: {
  initial?: UserFormValues;
  mode: "create" | "edit";
  onSubmit: (values: UserFormSubmitPayload) => void | Promise<void>;
  onCancel: () => void;
  /** CC/public create pending; Daily creates accepted + picks today's tag. */
  variant?: "cc" | "daily" | "public";
  initialTag?: DailyTag;
  busy?: boolean;
}) {
  const t = useT();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const { ranks, wings, wing_labels, wing_parent, member_banks, forces } =
    useStore();
  const [values, setValues] = useState<UserFormValues>(
    initial ?? emptyValues(),
  );
  const [todayTag, setTodayTag] = useState<DailyTag>(initialTag);
  const [dragOver, setDragOver] = useState(false);
  const wingParts = resolveWingParts(values.wing, wing_parent);
  const parentWingOptions = rootWings(wings, wing_parent);
  const subWingOptions = subWingsFor(wingParts.parent, wings, wing_parent);
  const isCivilian = values.member_type === "civilian";
  const isGuest = values.member_type === "guest";
  const wingLabel = (w: string) => wingDisplayLabel(w, wing_labels);

  const rankField = (
    <Field label={t("cc.fields.rank")} required>
      <SearchableSelect
        options={ranks}
        value={values.rank}
        onChange={(v) => patch("rank", v)}
        placeholder={t("cc.selectRank")}
        triggerClassName={selectTriggerClass}
      />
    </Field>
  );

  const wingField = (
    <Field label={t("cc.fields.wing")} required>
      <SearchableSelect
        options={parentWingOptions}
        value={wingParts.parent}
        onChange={setParentWing}
        getOptionLabel={wingLabel}
        placeholder={t("cc.selectWing")}
        triggerClassName={selectTriggerClass}
      />
    </Field>
  );

  const subWingField =
    subWingOptions.length > 0 ? (
      <Field label={t("cc.fields.subWing")}>
        <SearchableSelect
          options={subWingOptions}
          value={wingParts.sub}
          onChange={setSubWing}
          getOptionLabel={wingLabel}
          clearLabel="—"
          placeholder={t("cc.selectSubWing")}
          triggerClassName={selectTriggerClass}
        />
      </Field>
    ) : null;

  const memberTypeField = (
    <Field label={t("cc.fields.memberType")}>
      <Select
        value={values.member_type}
        onValueChange={(v) => setMemberType(v as MemberType)}
      >
        <SelectTrigger className={selectTriggerClass}>
          <SelectValue placeholder={t("cc.selectMemberType")} />
        </SelectTrigger>
        <SelectContent>
          {MEMBER_TYPES.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {t(m.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  function setParentWing(parent: string) {
    setValues((prev) => ({ ...prev, wing: parent }));
  }

  function setSubWing(sub: string) {
    setValues((prev) => {
      const { parent } = resolveWingParts(prev.wing, wing_parent);
      return { ...prev, wing: sub || parent };
    });
  }

  function patch<K extends keyof UserFormValues>(
    key: K,
    value: UserFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setMemberType(next: MemberType) {
    setValues((prev) => {
      if (next === "new") {
        return {
          ...prev,
          member_type: next,
          documents_verified: false,
        };
      }
      if (next === "guest") {
        return {
          ...prev,
          member_type: next,
          personal_id: "",
          rank: "",
          wing: "",
          force: "",
          religion: "",
          joining_date: "",
          out_date: "",
          bank_name: "",
          account_name: "",
          account_number: "",
          routing: "",
          branch: "",
          branch_location: "",
          documents: [],
          documents_verified: false,
          emergency_contacts: [emptyEmergencyContact()],
        };
      }
      return {
        ...prev,
        member_type: next,
        rank: prev.rank || ranks[0] || "",
        wing: prev.wing || wings[0] || "",
        documents_verified:
          next === "civilian" ? prev.documents_verified : false,
      };
    });
    if (next === "new" && variant === "daily" && mode === "create") {
      setTodayTag("TRG");
    }
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

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onFiles(e.target.files);
    e.target.value = "";
  }

  function removeDoc(index: number) {
    setValues((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }));
  }

  function patchEmergency(
    index: number,
    key: "name" | "relation" | "phone",
    value: string,
  ) {
    setValues((prev) => ({
      ...prev,
      emergency_contacts: prev.emergency_contacts.map((c, i) =>
        i === index ? { ...c, [key]: value } : c,
      ),
    }));
  }

  function addEmergency() {
    setValues((prev) => ({
      ...prev,
      emergency_contacts: [
        ...prev.emergency_contacts,
        emptyEmergencyContact(),
      ],
    }));
  }

  function removeEmergency(index: number) {
    setValues((prev) => {
      const next = prev.emergency_contacts.filter((_, i) => i !== index);
      return {
        ...prev,
        emergency_contacts:
          next.length > 0 ? next : [emptyEmergencyContact()],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const missing = missingUserFormRequired(values);
    if (missing) {
      const messageKey = {
        personal_no: "cc.personalNoRequired",
        card_number: "cc.cardNumberRequired",
        nid: "cc.nidRequired",
        name: "cc.nameRequired",
        rank: "cc.rankRequired",
        wing: "cc.wingRequired",
        documents: "cc.documentsRequired",
      }[missing] as "cc.personalNoRequired";
      toast(t(messageKey), "error");
      return;
    }
    if (!isValidBdPhone(values.phone)) {
      toast(t("cc.phoneInvalid"), "error");
      return;
    }
    if (
      values.emergency_contacts.some(
        (c) => c.phone.trim() && !isValidBdPhone(c.phone),
      )
    ) {
      toast(t("cc.phoneInvalid"), "error");
      return;
    }
    const payload = prepareUserFormSubmit(values);
    if (variant === "daily" && mode === "create") {
      await onSubmit({
        ...payload,
        today_tag: todayTag,
        default_tag: todayTag,
      });
      return;
    }
    await onSubmit(payload);
  }

  const fade = reduceMotion
    ? undefined
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {mode === "create" && variant === "public" ? (
        <motion.div
          {...fade}
          className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 dark:bg-primary/10"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <IconUserPlus className="h-3.5 w-3.5" />
          </span>
          <p className="min-w-0 text-xs text-neutral-600 dark:text-neutral-300">
            <span className="font-semibold text-neutral-900 dark:text-white">
              {t("register.bannerTitle")}.{" "}
            </span>
            {t("register.bannerNote")}
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
        <div
          className={cn(
            "grid grid-cols-1 gap-3 sm:grid-cols-2",
            variant === "cc" ? "lg:grid-cols-4" : "xl:grid-cols-4",
          )}
        >
          {isCivilian ? (
            <>
              {memberTypeField}
              <Field label={t("cc.fields.cardNumber")} required>
                <Input
                  value={values.dropdown_no}
                  onChange={(e) => patch("dropdown_no", e.target.value)}
                  required
                  className={inputClass}
                  placeholder={t("cc.placeholders.cardNumber")}
                />
              </Field>
              {rankField}
              <Field label={t("cc.fields.name")} required>
                <Input
                  value={values.name}
                  onChange={(e) => patch("name", e.target.value)}
                  required
                  className={inputClass}
                  placeholder={t("cc.placeholders.name")}
                />
              </Field>
              {wingField}
              {subWingField}
              <Field label={t("cc.fields.phone")}>
                <Input
                  value={values.phone}
                  onChange={(e) =>
                    patch("phone", normalizeBdPhone(e.target.value))
                  }
                  inputMode="numeric"
                  className={inputClass}
                  placeholder={t("cc.placeholders.phone")}
                />
              </Field>
              <Field label={t("cc.fields.nid")} required>
                <Input
                  value={values.personal_id}
                  onChange={(e) => patch("personal_id", e.target.value)}
                  required
                  className={inputClass}
                  placeholder={t("cc.placeholders.nid")}
                />
              </Field>
              <Field label={t("cc.fields.joiningDate")}>
                <DatePicker
                  value={values.joining_date}
                  onChange={(iso) => {
                    setValues((prev) => ({
                      ...prev,
                      joining_date: iso,
                      out_date:
                        prev.out_date && iso && prev.out_date < iso
                          ? ""
                          : prev.out_date,
                    }));
                  }}
                  label={t("cc.fields.joiningDate")}
                  triggerClassName={inputClass}
                />
              </Field>
              <Field label={t("cc.fields.outDate")}>
                <DatePicker
                  value={values.out_date}
                  onChange={(iso) => patch("out_date", iso)}
                  min={values.joining_date || undefined}
                  label={t("cc.fields.outDate")}
                  triggerClassName={inputClass}
                />
              </Field>
            </>
          ) : isGuest ? (
            <>
              {memberTypeField}
              <Field label={t("cc.fields.rabId")}>
                <Input
                  value={values.rab_id}
                  onChange={(e) => patch("rab_id", e.target.value)}
                  required
                  className={inputClass}
                  placeholder={t("cc.placeholders.rabId")}
                />
              </Field>
              <Field label={t("cc.fields.name")} required>
                <Input
                  value={values.name}
                  onChange={(e) => patch("name", e.target.value)}
                  required
                  className={inputClass}
                  placeholder={t("cc.placeholders.name")}
                />
              </Field>
              <Field label={t("cc.fields.phone")}>
                <Input
                  value={values.phone}
                  onChange={(e) =>
                    patch("phone", normalizeBdPhone(e.target.value))
                  }
                  inputMode="numeric"
                  className={inputClass}
                  placeholder={t("cc.placeholders.phone")}
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
              {variant !== "cc" && (mode === "edit" || variant === "daily") ? (
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
              {variant === "daily" ? (
                <Field label={t("daily.defaultTag")}>
                  <TagSelector
                    value={mode === "create" ? todayTag : values.default_tag}
                    onChange={(tag) => {
                      if (!tag) return;
                      if (mode === "create") setTodayTag(tag);
                      else patch("default_tag", tag);
                    }}
                    className={selectTriggerClass}
                  />
                </Field>
              ) : null}
            </>
          ) : (
            <>
              {memberTypeField}
              <Field label={t("cc.fields.personalNo")} required>
                <Input
                  value={values.personal_id}
                  onChange={(e) => patch("personal_id", e.target.value)}
                  required
                  className={inputClass}
                  placeholder={t("cc.placeholders.personalId")}
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
              {rankField}
              <Field label={t("cc.fields.name")} required>
                <Input
                  value={values.name}
                  onChange={(e) => patch("name", e.target.value)}
                  required
                  className={inputClass}
                  placeholder={t("cc.placeholders.name")}
                />
              </Field>
              {wingField}
              {subWingField}
              <Field label={t("cc.fields.phone")}>
                <Input
                  value={values.phone}
                  onChange={(e) =>
                    patch("phone", normalizeBdPhone(e.target.value))
                  }
                  inputMode="numeric"
                  className={inputClass}
                  placeholder={t("cc.placeholders.phone")}
                />
              </Field>
              <Field label={t("cc.fields.force")}>
                <Select
                  value={values.force || "__none__"}
                  onValueChange={(v) => patch("force", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder={t("cc.selectForce")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {forces.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("cc.fields.religion")}>
                <Select
                  value={values.religion || "__none__"}
                  onValueChange={(v) =>
                    patch("religion", v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder={t("cc.selectReligion")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {RELIGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("cc.fields.joiningDate")}>
                <DatePicker
                  value={values.joining_date}
                  onChange={(iso) => {
                    setValues((prev) => ({
                      ...prev,
                      joining_date: iso,
                      out_date:
                        prev.out_date && iso && prev.out_date < iso
                          ? ""
                          : prev.out_date,
                    }));
                  }}
                  label={t("cc.fields.joiningDate")}
                  triggerClassName={inputClass}
                />
              </Field>
              <Field label={t("cc.fields.outDate")}>
                <DatePicker
                  value={values.out_date}
                  onChange={(iso) => patch("out_date", iso)}
                  min={values.joining_date || undefined}
                  label={t("cc.fields.outDate")}
                  triggerClassName={inputClass}
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
              {variant !== "cc" && (mode === "edit" || variant === "daily") ? (
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
              {variant === "daily" ? (
                <Field label={t("daily.defaultTag")}>
                  <TagSelector
                    value={mode === "create" ? todayTag : values.default_tag}
                    onChange={(tag) => {
                      if (!tag) return;
                      if (mode === "create") setTodayTag(tag);
                      else patch("default_tag", tag);
                    }}
                    className={selectTriggerClass}
                  />
                </Field>
              ) : null}
            </>
          )}
        </div>
      </FormSection>

      {!isGuest ? (
        <FormSection
          step="02"
          icon={IconPhoneCall}
          title={t("cc.sectionEmergency")}
          hint={t("cc.sectionEmergencyHint")}
          delay={0.04}
          reduceMotion={!!reduceMotion}
        >
        <div className="flex flex-col gap-3">
          {values.emergency_contacts.map((contact, index) => (
            <div
              key={index}
              className="rounded-xl border border-neutral-200/90 bg-white/60 p-3 dark:border-neutral-700 dark:bg-neutral-950/40"
            >
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  {t("cc.emergencyContactN", { n: String(index + 1) })}
                </p>
                {values.emergency_contacts.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-neutral-400 hover:text-red-600"
                    onClick={() => removeEmergency(index)}
                    aria-label={t("cc.removeEmergency")}
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Field label={t("cc.fields.emergencyName")}>
                  <Input
                    value={contact.name}
                    onChange={(e) =>
                      patchEmergency(index, "name", e.target.value)
                    }
                    className={inputClass}
                    placeholder={t("cc.placeholders.emergencyName")}
                  />
                </Field>
                <Field label={t("cc.fields.emergencyRelation")}>
                  <Input
                    value={contact.relation}
                    onChange={(e) =>
                      patchEmergency(index, "relation", e.target.value)
                    }
                    className={inputClass}
                    placeholder={t("cc.placeholders.emergencyRelation")}
                  />
                </Field>
                <Field label={t("cc.fields.emergencyPhone")}>
                  <Input
                    value={contact.phone}
                    onChange={(e) =>
                      patchEmergency(
                        index,
                        "phone",
                        normalizeBdPhone(e.target.value),
                      )
                    }
                    inputMode="numeric"
                    className={inputClass}
                    placeholder={t("cc.placeholders.emergencyPhone")}
                  />
                </Field>
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={addEmergency}
            >
              <IconPlus className="h-3.5 w-3.5" />
              {t("cc.addEmergency")}
            </Button>
          </div>
          </div>
        </FormSection>
      ) : null}

      {!isGuest ? (
        <FormSection
          step="03"
          icon={IconBuildingBank}
          title={t("cc.sectionBank")}
          hint={t("cc.sectionBankHint")}
          delay={0.05}
          reduceMotion={!!reduceMotion}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Field label={t("cc.fields.bankName")}>
              <Select
                value={values.bank_name || undefined}
                onValueChange={(v) => patch("bank_name", v)}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder={t("cc.selectBankName")} />
                </SelectTrigger>
                <SelectContent>
                  {member_banks.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("cc.fields.accountName")}>
              <Input
                value={values.account_name}
                onChange={(e) => patch("account_name", e.target.value)}
                className={inputClass}
                placeholder={t("cc.placeholders.accountName")}
              />
            </Field>
            <Field label={t("cc.fields.accountNumber")}>
              <Input
                value={values.account_number}
                onChange={(e) =>
                  patch("account_number", digitsOnly(e.target.value))
                }
                inputMode="numeric"
                className={inputClass}
              />
            </Field>
            <Field label={t("cc.fields.routing")}>
              <Input
                value={values.routing}
                onChange={(e) => patch("routing", digitsOnly(e.target.value))}
                inputMode="numeric"
                className={inputClass}
              />
            </Field>
            <Field label={t("cc.fields.branch")}>
              <SearchableSelect
                options={BRANCH_DISTRICTS}
                value={values.branch}
                onChange={(v) => patch("branch", v)}
                placeholder={t("cc.selectBranchDistrict")}
                triggerClassName={selectTriggerClass}
              />
            </Field>
            <Field label={t("cc.fields.branchLocation")}>
              <Input
                value={values.branch_location}
                onChange={(e) => patch("branch_location", e.target.value)}
                className={inputClass}
                placeholder={t("cc.placeholders.branchLocation")}
              />
            </Field>
          </div>
        </FormSection>
      ) : null}

      {!isGuest ? (
        <FormSection
          step="04"
          icon={IconFileUpload}
          title={t("cc.sectionDocs")}
          hint={t("cc.docsHint")}
          required
          delay={0.07}
          reduceMotion={!!reduceMotion}
        >
        <div className="space-y-3 p-3.5 md:p-4">
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
              "group relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-all duration-200",
              dragOver
                ? "scale-[1.01] border-primary bg-primary/5 shadow-lg shadow-primary/10"
                : "border-neutral-200/90 bg-gradient-to-b from-neutral-50/90 via-white to-white hover:border-primary/45 hover:bg-primary/[0.02] dark:border-neutral-700 dark:from-neutral-900/60 dark:via-neutral-950/40 dark:to-neutral-950/20 dark:hover:border-primary/40",
            )}
          >
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl ring-1 transition-transform duration-200 group-hover:scale-105",
                dragOver
                  ? "bg-primary text-white ring-primary/30"
                  : "bg-primary/10 text-primary ring-primary/15 dark:bg-primary/15",
              )}
            >
              <IconCloudUpload className="h-7 w-7" stroke={1.75} />
            </span>
            <div className="max-w-sm space-y-1">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {isCivilian ? t("cc.dropDocsCivilian") : t("cc.dropDocs")}
              </p>
              <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {t("cc.addDocuments")}
              </p>
            </div>
            <span className="rounded-full border border-neutral-200/80 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-400">
              {t("cc.docsFormats")}
            </span>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf"
              className="hidden"
              onChange={onFileInputChange}
            />
          </label>

          {isCivilian ? (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-neutral-200/90 bg-white/80 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900/70">
              <input
                type="checkbox"
                checked={values.documents_verified}
                onChange={(e) =>
                  patch("documents_verified", e.target.checked)
                }
                className="h-4 w-4 rounded border-neutral-300 text-primary accent-primary"
              />
              <span className="font-medium text-neutral-800 dark:text-neutral-100">
                {t("cc.verifyDocuments")}
              </span>
            </label>
          ) : null}

          {values.documents.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  {t("cc.fields.documents")}
                </p>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-primary">
                  {values.documents.length}
                </span>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {values.documents.map((doc, i) => (
                  <li
                    key={`${doc.name}-${i}`}
                    className="group/doc flex items-center gap-3 rounded-xl border border-neutral-200/90 bg-white/80 p-2.5 shadow-sm transition hover:border-primary/25 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900/70"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200/80 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700">
                      <IconFile className="h-5 w-5" stroke={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {doc.name}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                        {formatDocSize(doc.size)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-lg text-neutral-400 opacity-70 transition hover:bg-red-50 hover:text-red-600 group-hover/doc:opacity-100 dark:hover:bg-red-950/40"
                      onClick={() => removeDoc(i)}
                      aria-label={t("cc.removeDoc")}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </FormSection>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg"
          onClick={onCancel}
          disabled={busy}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="cta" size="sm" className="rounded-lg" disabled={busy}>
          {mode === "create" ? (
            <>
              <IconPlus className="h-3.5 w-3.5" />
              {variant === "public"
                ? t("register.submit")
                : t("cc.createUser")}
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
  required,
  children,
  delay,
  reduceMotion,
  headerActions,
}: {
  step: string;
  icon: Icon;
  title: string;
  hint: string;
  required?: boolean;
  children: React.ReactNode;
  delay: number;
  reduceMotion: boolean;
  headerActions?: React.ReactNode;
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
                {required ? (
                  <span className="text-primary" aria-hidden>
                    {" "}
                    *
                  </span>
                ) : null}
              </h2>
              <span className="truncate text-[11px] text-neutral-400">{hint}</span>
            </div>
          </div>
          {headerActions ? (
            <div className="shrink-0">{headerActions}</div>
          ) : null}
        </div>
        <div className="px-3.5 py-3 md:px-4 md:py-3.5">{children}</div>
      </SectionCard>
    </motion.div>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        {label}
        {required ? (
          <span className="text-primary" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}
