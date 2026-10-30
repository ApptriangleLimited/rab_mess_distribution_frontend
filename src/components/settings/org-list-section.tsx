"use client";

import { useState } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconPencil,
  IconPlus,
  IconTrash,
  type Icon,
} from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/shared/toast-provider";
import { ApiClientError } from "@/lib/api/client";
import { persistAppStateNow } from "@/lib/api/app-sync";
import { useStore } from "@/hooks/use-store";
import { useT } from "@/i18n/provider";
import type { MessageKey } from "@/i18n";
import {
  addForce,
  addForceRank,
  listForces,
  listRanks,
  removeForceRank,
  renameForceRank,
  addRank,
  addWing,
  removeForce,
  removeRank,
  removeWing,
  renameForce,
  renameRank,
  renameWing,
  toggleForceRank,
  toggleRankEquivalent,
} from "@/lib/store/org-options";
import {
  FORCE_LABELS,
  FORCE_RANK_LABELS,
  RANK_LABELS,
  canonicalForceServiceRank,
  forceLabelBn,
  forceOfficialName,
  forceOfficialSerial,
  forceRankChoices,
  forceRankLabelBn,
  forceRankOfficialSerial,
  rankDisplayLabel,
  rankLabelBn,
  rankOfficialName,
  rankOfficialSerial,
  suggestForceRankShort,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { WingTreeList } from "@/components/settings/wing-tree-list";

type Kind = "rank" | "wing" | "force";

type KindCopy = {
  title: MessageKey;
  hint: MessageKey;
  add: MessageKey;
  addTitle: MessageKey;
  editTitle: MessageKey;
  addBody: MessageKey;
  name: MessageKey;
  placeholder: MessageKey;
  added: MessageKey;
  delete: MessageKey;
  deleteTitle: MessageKey;
  deleteBody: MessageKey;
  deleted: MessageKey;
};

const COPY: Record<Kind, KindCopy> = {
  rank: {
    title: "settings.ranks",
    hint: "settings.ranksHint",
    add: "settings.addRank",
    addTitle: "settings.addRankTitle",
    editTitle: "settings.editRankTitle",
    addBody: "settings.addRankBody",
    name: "settings.rankName",
    placeholder: "settings.rankPlaceholder",
    added: "settings.rankAdded",
    delete: "settings.deleteRank",
    deleteTitle: "settings.deleteRankTitle",
    deleteBody: "settings.deleteRankBody",
    deleted: "settings.rankDeleted",
  },
  wing: {
    title: "settings.wings",
    hint: "settings.wingsHint",
    add: "settings.addWing",
    addTitle: "settings.addWingTitle",
    editTitle: "settings.editWingTitle",
    addBody: "settings.addWingBody",
    name: "settings.wingName",
    placeholder: "settings.wingPlaceholder",
    added: "settings.wingAdded",
    delete: "settings.deleteWing",
    deleteTitle: "settings.deleteWingTitle",
    deleteBody: "settings.deleteWingBody",
    deleted: "settings.wingDeleted",
  },
  force: {
    title: "settings.forces",
    hint: "settings.forcesHint",
    add: "settings.addForce",
    addTitle: "settings.addForceTitle",
    editTitle: "settings.editForceTitle",
    addBody: "settings.addForceBody",
    name: "settings.forceName",
    placeholder: "settings.forcePlaceholder",
    added: "settings.forceAdded",
    delete: "settings.deleteForce",
    deleteTitle: "settings.deleteForceTitle",
    deleteBody: "settings.deleteForceBody",
    deleted: "settings.forceDeleted",
  },
};

export function OrgListSection({
  kind,
  icon: Icon,
}: {
  kind: Kind;
  icon: Icon;
}) {
  const t = useT();
  const { toast } = useToast();
  const state = useStore();
  const copy = COPY[kind];
  const [formOpen, setFormOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [formValue, setFormValue] = useState("");
  const [formElaborate, setFormElaborate] = useState("");
  const [formBangla, setFormBangla] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [deleteLabel, setDeleteLabel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedRankForces, setExpandedRankForces] = useState<
    Record<string, boolean>
  >({});
  const [forceRankForce, setForceRankForce] = useState<string | null>(null);
  const [editingForceRank, setEditingForceRank] = useState<string | null>(null);
  const [forceRankShort, setForceRankShort] = useState("");
  const [forceRankFull, setForceRankFull] = useState("");
  const [forceRankBangla, setForceRankBangla] = useState("");
  const [forceRankSerial, setForceRankSerial] = useState("");
  const [forceRankShortManual, setForceRankShortManual] = useState(false);
  const [deleteForceRank, setDeleteForceRank] = useState<{
    force: string;
    rank: string;
  } | null>(null);

  if (kind === "wing") {
    return (
      <CollapsibleSection
        id="org-wing"
        className="scroll-mt-6"
        icon={Icon}
        title={t("settings.wings")}
        hint={t("settings.wingsHint")}
        static
        badge={
          <span className="rounded-md bg-neutral-900/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-neutral-500 dark:bg-white/10">
            {state.wings.length}
          </span>
        }
      >
        <WingTreeList />
      </CollapsibleSection>
    );
  }

  const forces = listForces();
  const ranks = listRanks();
  const items = kind === "rank" ? ranks : forces;
  const expandable = kind === "rank" || kind === "force";

  function parsedSerial() {
    const raw = formSerial.trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }

  function nextForceSerial() {
    const used = listForces()
      .map((force) => forceOfficialSerial(force, state.force_serials))
      .filter((n): n is number => n != null);
    return String(used.length ? Math.max(...used) + 1 : 1);
  }

  function nextRankSerial() {
    const used = listRanks()
      .map((rank) => rankOfficialSerial(rank, state.rank_serials))
      .filter((n): n is number => n != null);
    return String(used.length ? Math.max(...used) + 1 : 1);
  }

  function rankForceKey(rank: string, force: string) {
    return `${rank}::${force}`;
  }

  function toggleRankForceExpand(rank: string, force: string) {
    const key = rankForceKey(rank, force);
    setExpandedRankForces((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function startCreate() {
    setEditingLabel(null);
    setFormValue("");
    setFormElaborate("");
    setFormBangla("");
    setFormSerial(
      kind === "force"
        ? nextForceSerial()
        : kind === "rank"
          ? nextRankSerial()
          : "",
    );
    setFormOpen(true);
  }

  function startEdit(label: string) {
    setEditingLabel(label);
    setFormValue(label);
    if (kind === "force") {
      setFormElaborate(
        state.force_labels[label] ?? FORCE_LABELS[label] ?? "",
      );
      setFormBangla(state.force_labels_bn[label] ?? forceLabelBn(label));
      const serial = forceOfficialSerial(label, state.force_serials);
      setFormSerial(serial != null ? String(serial) : "");
    } else if (kind === "rank") {
      setFormElaborate(
        state.rank_labels[label] ?? RANK_LABELS[label] ?? "",
      );
      setFormBangla(state.rank_labels_bn[label] ?? rankLabelBn(label));
      const serial = rankOfficialSerial(label, state.rank_serials);
      setFormSerial(serial != null ? String(serial) : "");
    } else {
      setFormElaborate("");
      setFormBangla("");
      setFormSerial("");
    }
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingLabel(null);
    setFormValue("");
    setFormElaborate("");
    setFormBangla("");
    setFormSerial("");
  }

  function nextForceRankSerial(force: string) {
    const used = forceRankChoices(
      force,
      ranks,
      state.force_rank_extras[force] ?? [],
      state.force_rank_removed[force] ?? [],
    )
      .map((rank) =>
        forceRankOfficialSerial(force, rank, state.force_rank_serials),
      )
      .filter((n): n is number => n != null);
    return String(used.length ? Math.max(...used) + 1 : 1);
  }

  function startAddForceRank(force: string) {
    setForceRankForce(force);
    setEditingForceRank(null);
    setForceRankShort("");
    setForceRankFull("");
    setForceRankBangla("");
    setForceRankSerial(nextForceRankSerial(force));
    setForceRankShortManual(false);
  }

  function startEditForceRank(force: string, rank: string) {
    setForceRankForce(force);
    setEditingForceRank(rank);
    setForceRankShort(rank);
    setForceRankFull(
      state.force_rank_labels[force]?.[rank] ??
        FORCE_RANK_LABELS[force as keyof typeof FORCE_RANK_LABELS]?.[rank] ??
        "",
    );
    setForceRankBangla(
      state.force_rank_labels_bn[force]?.[rank] ??
        forceRankLabelBn(force, rank),
    );
    const serial = forceRankOfficialSerial(
      force,
      rank,
      state.force_rank_serials,
    );
    setForceRankSerial(serial != null ? String(serial) : "");
    setForceRankShortManual(true);
  }

  function closeForceRankForm() {
    setForceRankForce(null);
    setEditingForceRank(null);
    setForceRankShort("");
    setForceRankFull("");
    setForceRankBangla("");
    setForceRankSerial("");
    setForceRankShortManual(false);
  }

  function displayRank(short: string, force?: string) {
    const overrides = force
      ? state.force_rank_labels[force]
      : state.rank_labels;
    return rankDisplayLabel(short, force, overrides);
  }

  async function finishSave(message: string) {
    try {
      await persistAppStateNow();
    } catch (err) {
      toast(
        err instanceof ApiClientError
          ? err.detail
          : "Could not save. Try again.",
        "error",
      );
      return;
    }
    toast(message, "success");
  }

  async function onSaveForceRank() {
    if (!forceRankForce) return;
    const short =
      canonicalForceServiceRank(forceRankShort.trim()) ||
      suggestForceRankShort(forceRankFull.trim());
    if (!short) {
      toast(t("settings.orgLabelRequired"), "error");
      return;
    }
    const bangla = forceRankBangla.trim();
    const serialRaw = forceRankSerial.trim();
    const serialN = Number(serialRaw);
    const serial =
      serialRaw && Number.isFinite(serialN) && serialN > 0
        ? Math.floor(serialN)
        : null;
    if (editingForceRank) {
      const ok = renameForceRank(
        forceRankForce,
        editingForceRank,
        short,
        forceRankFull.trim() || undefined,
        bangla,
        serial,
      );
      if (!ok) {
        toast(t("settings.orgLabelDuplicate"), "error");
        return;
      }
      closeForceRankForm();
      await finishSave(t("settings.forceRankSaved"));
      return;
    }
    const created = addForceRank(
      forceRankForce,
      short,
      forceRankFull.trim() || undefined,
      bangla,
      serial,
    );
    if (!created) {
      toast(t("settings.orgLabelDuplicate"), "error");
      return;
    }
    closeForceRankForm();
    await finishSave(t("settings.forceRankAdded"));
  }

  async function onDeleteForceRank() {
    if (!deleteForceRank) return;
    removeForceRank(deleteForceRank.force, deleteForceRank.rank);
    setDeleteForceRank(null);
    await finishSave(t("settings.forceRankDeleted"));
  }

  async function onSave() {
    const label = formValue.trim();
    const full = formElaborate.trim();
    const bangla = formBangla.trim();
    const serial = parsedSerial();
    if (!label) {
      toast(t("settings.orgLabelRequired"), "error");
      return;
    }
    if (editingLabel) {
      if (kind === "force") {
        if (
          label === editingLabel &&
          full ===
            (state.force_labels[editingLabel] ??
              FORCE_LABELS[editingLabel] ??
              "") &&
          bangla ===
            (state.force_labels_bn[editingLabel] ??
              forceLabelBn(editingLabel)) &&
          serial === forceOfficialSerial(editingLabel, state.force_serials)
        ) {
          closeForm();
          return;
        }
        if (
          !renameForce(
            editingLabel,
            label,
            full || undefined,
            bangla,
            serial,
          )
        ) {
          toast(t("settings.orgLabelDuplicate"), "error");
          return;
        }
      } else if (kind === "rank") {
        if (
          label === editingLabel &&
          full ===
            (state.rank_labels[editingLabel] ??
              RANK_LABELS[editingLabel] ??
              "") &&
          bangla ===
            (state.rank_labels_bn[editingLabel] ??
              rankLabelBn(editingLabel)) &&
          serial === rankOfficialSerial(editingLabel, state.rank_serials)
        ) {
          closeForm();
          return;
        }
        if (
          !renameRank(
            editingLabel,
            label,
            full || undefined,
            bangla,
            serial,
          )
        ) {
          toast(t("settings.orgLabelDuplicate"), "error");
          return;
        }
      } else {
        if (label === editingLabel) {
          closeForm();
          return;
        }
        if (!renameWing(editingLabel, label)) {
          toast(t("settings.orgLabelDuplicate"), "error");
          return;
        }
      }
      if (kind === "rank" || kind === "force") {
        setExpanded((prev) => {
          const next = { ...prev };
          if (prev[editingLabel]) {
            delete next[editingLabel];
            next[label] = true;
          }
          return next;
        });
      }
      closeForm();
      await finishSave(t("settings.orgLabelSaved"));
      return;
    }
    const created =
      kind === "rank"
        ? addRank(label, full || undefined, bangla, serial)
        : kind === "wing"
          ? addWing(label)
          : addForce(label, full || undefined, bangla, serial);
    if (!created) {
      toast(t("settings.orgLabelDuplicate"), "error");
      return;
    }
    closeForm();
    await finishSave(t(copy.added));
  }

  async function onDelete() {
    if (!deleteLabel) return;
    if (kind === "rank") {
      removeRank(deleteLabel);
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[deleteLabel];
        return next;
      });
    } else if (kind === "wing") removeWing(deleteLabel);
    else {
      removeForce(deleteLabel);
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[deleteLabel];
        return next;
      });
    }
    setDeleteLabel(null);
    await finishSave(t(copy.deleted));
  }

  function toggleExpand(label: string) {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <>
      <CollapsibleSection
        id={`org-${kind}`}
        className="scroll-mt-6"
        icon={Icon}
        title={t(copy.title)}
        hint={t(copy.hint)}
        static
        badge={
          <span className="rounded-md bg-neutral-900/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-neutral-500 dark:bg-white/10">
            {items.length}
          </span>
        }
        headerActions={
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="shrink-0 rounded-lg"
            onClick={startCreate}
          >
            <IconPlus className="h-3.5 w-3.5" />
            {t(copy.add)}
          </Button>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
                <Icon className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {t("settings.orgListEmpty")}
              </p>
              <Button
                type="button"
                variant="cta"
                size="sm"
                className="rounded-lg"
                onClick={startCreate}
              >
                <IconPlus className="h-3.5 w-3.5" />
                {t(copy.add)}
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {items.map((label) => {
                const open = expandable && Boolean(expanded[label]);
                const forceAssignedRanks =
                  kind === "force" ? (state.force_ranks[label] ?? []) : [];
                const forceRanks =
                  kind === "force"
                  ? forceRankChoices(
                      label,
                      ranks,
                      state.force_rank_extras[label] ?? [],
                      state.force_rank_removed[label] ?? [],
                    )
                  : [];
                const rankAssignedForces =
                  kind === "rank"
                    ? Object.keys(state.rank_equivalents[label] ?? {})
                    : [];
                const equivCount =
                  kind === "rank"
                    ? Object.values(
                        state.rank_equivalents[label] ?? {},
                      ).reduce((n, list) => n + list.length, 0)
                    : 0;
                const badgeLabel =
                  kind === "force"
                    ? t(
                        forceAssignedRanks.length === 1
                          ? "settings.forceRankBadge"
                          : "settings.forceRankBadgePlural",
                        { count: String(forceAssignedRanks.length) },
                      )
                    : kind === "rank"
                      ? t(
                          equivCount === 1
                            ? "settings.rankMatchBadge"
                            : "settings.rankMatchBadgePlural",
                          { count: String(equivCount) },
                        )
                      : "";
                const rankMatchLines =
                  kind === "rank"
                    ? Object.entries(
                        state.rank_equivalents[label] ?? {},
                      ).map(([force, list]) =>
                        t("settings.rankMatchSummary", {
                          force,
                          ranks: list
                            .map((r) => displayRank(r, force))
                            .join(", "),
                        }),
                      )
                    : [];
                const rowTitle =
                  kind === "rank" ? displayRank(label) : label;
                const catalogSerial =
                  kind === "force"
                    ? forceOfficialSerial(label, state.force_serials)
                    : kind === "rank"
                      ? rankOfficialSerial(label, state.rank_serials)
                      : null;
                const catalogOfficial =
                  kind === "force"
                    ? forceOfficialName(label, state.force_labels)
                    : kind === "rank"
                      ? label
                      : "";
                const catalogFull =
                  kind === "rank"
                    ? rankOfficialName(label, state.rank_labels)
                    : "";
                const catalogBn =
                  kind === "force"
                    ? forceLabelBn(label, state.force_labels_bn)
                    : kind === "rank"
                      ? rankLabelBn(label, state.rank_labels_bn)
                      : "";
                const showCatalogBn =
                  (kind === "force" || kind === "rank") &&
                  Boolean(catalogBn) &&
                  catalogBn.toLowerCase() !== catalogOfficial.toLowerCase() &&
                  catalogBn.toLowerCase() !== label.toLowerCase();
                const showCatalogShort =
                  kind === "rank"
                    ? Boolean(catalogFull) &&
                      catalogFull.trim().toLowerCase() !==
                        label.trim().toLowerCase()
                    : kind === "force" &&
                      label.trim().toLowerCase() !==
                        catalogOfficial.trim().toLowerCase();
                const catalogSub =
                  kind === "rank" ? catalogFull : label;
                return (
                  <li
                    key={label}
                    className="group transition hover:bg-primary/[0.03] dark:hover:bg-primary/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        {expandable ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                            aria-expanded={open}
                            aria-label={open ? "Collapse" : "Expand"}
                            onClick={() => toggleExpand(label)}
                          >
                            <IconChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                open && "rotate-180",
                              )}
                            />
                          </button>
                        ) : null}
                        {kind === "force" || kind === "rank" ? (
                          catalogSerial != null ? (
                            <span
                              className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-neutral-900/10 px-1.5 font-mono text-[11px] font-semibold tabular-nums text-neutral-600 dark:bg-white/10 dark:text-neutral-300"
                              title={t("settings.wingSerial")}
                            >
                              {catalogSerial}
                            </span>
                          ) : (
                            <span className="inline-flex h-7 w-7 shrink-0" aria-hidden />
                          )
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            className={cn(
                              "block w-full truncate text-left text-sm font-semibold text-neutral-900 dark:text-white",
                              expandable && "hover:text-primary",
                            )}
                            onClick={
                              expandable
                                ? () => toggleExpand(label)
                                : undefined
                            }
                            title={
                              kind === "force" || kind === "rank"
                                ? `${catalogOfficial}${showCatalogBn ? ` (${catalogBn})` : ""}${showCatalogShort ? ` · ${label}` : ""}`
                                : undefined
                            }
                          >
                            {kind === "force" || kind === "rank" ? (
                              <>
                                {catalogOfficial}
                                {showCatalogBn ? (
                                  <span className="font-medium text-neutral-500">
                                    {" "}
                                    ({catalogBn})
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              rowTitle
                            )}
                          </button>
                          {showCatalogShort ? (
                            <p className="mt-0.5 truncate text-[11px] font-medium text-neutral-500">
                              {catalogSub}
                            </p>
                          ) : null}
                          {kind === "rank" &&
                          !open &&
                          rankMatchLines.length > 0 ? (
                            <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                              {rankMatchLines.join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        {expandable ? (
                          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                            {badgeLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-1 opacity-80 transition group-hover:opacity-100">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 rounded-lg p-0"
                          aria-label={t("common.edit")}
                          onClick={() => startEdit(label)}
                        >
                          <IconPencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          className="h-8 w-8 rounded-lg p-0"
                          aria-label={t(copy.delete)}
                          onClick={() => setDeleteLabel(label)}
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {kind === "rank" && open ? (
                      <div className="border-t border-neutral-100 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-900/40">
                        <p className="px-3 pt-2.5 text-[11px] font-medium text-neutral-500">
                          {t("settings.rankEquivalents")}
                          <span className="ml-1 font-normal text-neutral-400">
                            — {t("settings.rankEquivalentsHint")}
                          </span>
                        </p>
                        {forces.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-neutral-500">
                            {t("settings.rankForcesEmpty")}
                          </p>
                        ) : (
                          <ul className="mt-1.5 divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
                            {forces.map((force) => {
                              const forceOpen = Boolean(
                                expandedRankForces[
                                  rankForceKey(label, force)
                                ],
                              );
                              const equivs =
                                state.rank_equivalents[label]?.[force] ??
                                [];
                              const ladder = forceRankChoices(
                                force,
                                ranks,
                                state.force_rank_extras[force] ?? [],
                                state.force_rank_removed[force] ?? [],
                              );
                              return (
                                <li key={force}>
                                  <div className="flex items-center gap-1 px-2 py-1.5">
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                                      aria-expanded={forceOpen}
                                      aria-label={
                                        forceOpen ? "Collapse" : "Expand"
                                      }
                                      onClick={() =>
                                        toggleRankForceExpand(label, force)
                                      }
                                    >
                                      <IconChevronDown
                                        className={cn(
                                          "h-4 w-4 transition-transform",
                                          forceOpen && "rotate-180",
                                        )}
                                      />
                                    </button>
                                    <div className="min-w-0 flex-1">
                                      <button
                                        type="button"
                                        className={cn(
                                          "block w-full truncate text-left text-sm font-medium",
                                          equivs.length > 0
                                            ? "text-primary"
                                            : "text-neutral-700 dark:text-neutral-200",
                                        )}
                                        onClick={() =>
                                          toggleRankForceExpand(label, force)
                                        }
                                      >
                                        {force}
                                      </button>
                                      {!forceOpen && equivs.length > 0 ? (
                                        <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                                          {equivs
                                            .map((r) =>
                                              displayRank(r, force),
                                            )
                                            .join(", ")}
                                        </p>
                                      ) : null}
                                    </div>
                                    {equivs.length > 0 ? (
                                      <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                                        {t(
                                          equivs.length === 1
                                            ? "settings.rankMatchBadge"
                                            : "settings.rankMatchBadgePlural",
                                          { count: String(equivs.length) },
                                        )}
                                      </span>
                                    ) : (
                                      <span className="shrink-0 text-[10px] text-neutral-400">
                                        {t("settings.rankForceTap")}
                                      </span>
                                    )}
                                  </div>
                                  {forceOpen ? (
                                    <div className="border-t border-neutral-100 bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/50">
                                      <p className="px-3 pt-2 text-[11px] font-medium text-neutral-500">
                                        {t("settings.rankForceLadder")}
                                        <span className="ml-1 font-normal text-neutral-400">
                                          — {t("settings.rankForceLadderHint")}
                                        </span>
                                      </p>
                                      {ladder.length === 0 ? (
                                        <p className="px-3 py-3 text-xs text-neutral-500">
                                          {t("settings.forceRanksEmpty")}
                                        </p>
                                      ) : (
                                        <ul className="mt-1 divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
                                          {ladder.map((serviceRank) => {
                                            const on = equivs.some(
                                              (r) =>
                                                r.toLowerCase() ===
                                                serviceRank.toLowerCase(),
                                            );
                                            return (
                                              <li key={serviceRank}>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    toggleRankEquivalent(
                                                      label,
                                                      force,
                                                      serviceRank,
                                                    )
                                                  }
                                                  aria-pressed={on}
                                                  className={cn(
                                                    "flex w-full items-center gap-3 px-3 py-2 pl-12 text-left transition",
                                                    on
                                                      ? "bg-primary/[0.06] hover:bg-primary/[0.1]"
                                                      : "hover:bg-neutral-50 dark:hover:bg-neutral-900",
                                                  )}
                                                >
                                                  <span
                                                    className={cn(
                                                      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                                                      on
                                                        ? "border-primary bg-primary text-white"
                                                        : "border-neutral-300 text-transparent dark:border-neutral-600",
                                                    )}
                                                    aria-hidden
                                                  >
                                                    <IconCheck className="h-3 w-3" />
                                                  </span>
                                                  <span
                                                    className={cn(
                                                      "min-w-0 truncate text-sm font-medium",
                                                      on
                                                        ? "text-primary"
                                                        : "text-neutral-700 dark:text-neutral-200",
                                                    )}
                                                  >
                                                    {displayRank(
                                                      serviceRank,
                                                      force,
                                                    )}
                                                  </span>
                                                </button>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                      {ladder.length > 0 &&
                                      equivs.length === 0 ? (
                                        <p className="border-t border-neutral-100 px-3 py-2 pl-12 text-[11px] text-neutral-400 dark:border-neutral-800">
                                          {t("settings.rankEquivalentsNone")}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {forces.length > 0 && equivCount === 0 ? (
                          <p className="border-t border-neutral-100 px-3 py-2 text-[11px] text-neutral-400 dark:border-neutral-800">
                            {t("settings.rankEquivalentsNone")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {kind === "force" && open ? (
                      <div className="border-t border-neutral-100 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-900/40">
                        <p className="px-3 pt-2.5 text-[11px] font-medium text-neutral-500">
                          {t("settings.forceRanks")}
                          <span className="ml-1 font-normal text-neutral-400">
                            — {t("settings.forceRanksHint")}
                          </span>
                        </p>
                        {forceRanks.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-neutral-500">
                            {t("settings.forceRanksEmpty")}
                          </p>
                        ) : (
                          <ul className="mt-1.5 divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
                            {forceRanks.map((rank) => {
                              const on = forceAssignedRanks.includes(rank);
                              const rankSerial = forceRankOfficialSerial(
                                label,
                                rank,
                                state.force_rank_serials,
                              );
                              const rankBn = forceRankLabelBn(
                                label,
                                rank,
                                state.force_rank_labels_bn,
                              );
                              const rankFull =
                                state.force_rank_labels[label]?.[rank] ??
                                FORCE_RANK_LABELS[
                                  label as keyof typeof FORCE_RANK_LABELS
                                ]?.[rank] ??
                                rank;
                              const showRankBn =
                                Boolean(rankBn) &&
                                rankBn.toLowerCase() !== rank.toLowerCase() &&
                                rankBn.toLowerCase() !== rankFull.toLowerCase();
                              const showRankShort =
                                rank.toLowerCase() !== rankFull.toLowerCase();
                              return (
                                <li key={rank}>
                                  <div
                                    className={cn(
                                      "flex items-center gap-1 px-3 py-1.5 pl-10 transition",
                                      on
                                        ? "bg-primary/[0.06]"
                                        : "hover:bg-white/80 dark:hover:bg-neutral-900/80",
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleForceRank(label, rank)
                                      }
                                      aria-pressed={on}
                                      aria-label={
                                        on
                                          ? `Unassign ${displayRank(rank, label)}`
                                          : `Assign ${displayRank(rank, label)}`
                                      }
                                      className="flex min-w-0 flex-1 items-center gap-3 py-0.5 text-left"
                                    >
                                      <span
                                        className={cn(
                                          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                                          on
                                            ? "border-primary bg-primary text-white"
                                            : "border-neutral-300 text-transparent dark:border-neutral-600",
                                        )}
                                        aria-hidden
                                      >
                                        <IconCheck className="h-3 w-3" />
                                      </span>
                                      {rankSerial != null ? (
                                        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-neutral-900/10 px-1 font-mono text-[10px] font-semibold tabular-nums text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                                          {rankSerial}
                                        </span>
                                      ) : null}
                                      <span className="min-w-0 truncate">
                                        <span
                                          className={cn(
                                            "block truncate text-sm font-medium",
                                            on
                                              ? "text-primary"
                                              : "text-neutral-700 dark:text-neutral-200",
                                          )}
                                        >
                                          {rankFull}
                                          {showRankBn ? (
                                            <span className="font-normal text-neutral-500">
                                              {" "}
                                              ({rankBn})
                                            </span>
                                          ) : null}
                                        </span>
                                        {showRankShort ? (
                                          <span className="block truncate text-[11px] font-medium text-neutral-500">
                                            {rank}
                                          </span>
                                        ) : null}
                                      </span>
                                    </button>
                                    <div className="flex shrink-0 gap-0.5 opacity-70 transition group-hover:opacity-100">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 w-7 rounded-md p-0"
                                        aria-label={t("common.edit")}
                                        onClick={() =>
                                          startEditForceRank(label, rank)
                                        }
                                      >
                                        <IconPencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="danger"
                                        className="h-7 w-7 rounded-md p-0"
                                        aria-label={t("common.delete")}
                                        onClick={() =>
                                          setDeleteForceRank({
                                            force: label,
                                            rank,
                                          })
                                        }
                                      >
                                        <IconTrash className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div className="border-t border-neutral-100 px-3 py-2 pl-10 dark:border-neutral-800">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            onClick={() => startAddForceRank(label)}
                          >
                            <IconPlus className="h-3.5 w-3.5" />
                            {t("settings.addForceRank")}
                          </Button>
                        </div>
                        {forceRanks.length > 0 &&
                        forceAssignedRanks.length === 0 ? (
                          <p className="border-t border-neutral-100 px-3 py-2 pl-10 text-[11px] text-neutral-400 dark:border-neutral-800">
                            {t("settings.forceRanksNone")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CollapsibleSection>

      <ConfirmDialog
        open={formOpen}
        title={editingLabel ? t(copy.editTitle) : t(copy.addTitle)}
        body={t(copy.addBody)}
        confirmLabel={editingLabel ? t("common.save") : t(copy.add)}
        onCancel={closeForm}
        onConfirm={onSave}
      >
        <div className="space-y-3">
          {kind === "force" || kind === "rank" ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-neutral-500">
                  {t("settings.wingSerialField")}
                </Label>
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={formSerial}
                  onChange={(e) => setFormSerial(e.target.value)}
                  placeholder={t("settings.wingSerialPlaceholder")}
                  autoFocus
                  className="h-9 rounded-lg text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSave();
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-neutral-500">
                  {t("settings.wingFullName")}
                </Label>
                <Input
                  value={formElaborate}
                  onChange={(e) => setFormElaborate(e.target.value)}
                  placeholder={t("settings.wingFullPlaceholder")}
                  className="h-9 rounded-lg text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSave();
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-neutral-500">
                  {t("settings.wingBanglaName")}
                </Label>
                <Input
                  value={formBangla}
                  onChange={(e) => setFormBangla(e.target.value)}
                  placeholder={t("settings.wingBanglaPlaceholder")}
                  className="h-9 rounded-lg text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSave();
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-neutral-500">
                  {t("settings.wingShortName")}
                </Label>
                <Input
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder={t(copy.placeholder)}
                  className="h-9 rounded-lg text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSave();
                    }
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-neutral-500">{t(copy.name)}</Label>
                <Input
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder={t(copy.placeholder)}
                  autoFocus
                  className="h-9 rounded-lg text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSave();
                    }
                  }}
                />
              </div>
            </>
          )}
        </div>
      </ConfirmDialog>


      <ConfirmDialog
        open={Boolean(forceRankForce)}
        title={t(
          editingForceRank
            ? "settings.editForceRankTitle"
            : "settings.addForceRankTitle",
        )}
        body={t(
          editingForceRank
            ? "settings.editForceRankBody"
            : "settings.addForceRankBody",
        )}
        confirmLabel={
          editingForceRank ? t("common.save") : t("settings.addForceRank")
        }
        onCancel={closeForceRankForm}
        onConfirm={onSaveForceRank}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-neutral-500">
              {t("settings.wingSerialField")}
            </Label>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={forceRankSerial}
              onChange={(e) => setForceRankSerial(e.target.value)}
              placeholder={t("settings.wingSerialPlaceholder")}
              autoFocus
              className="h-9 rounded-lg text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSaveForceRank();
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-neutral-500">
              {t("settings.forceRankFull")}
            </Label>
            <Input
              value={forceRankFull}
              onChange={(e) => {
                const next = e.target.value;
                setForceRankFull(next);
                if (!forceRankShortManual) {
                  const suggested = suggestForceRankShort(next);
                  if (suggested) setForceRankShort(suggested);
                }
              }}
              placeholder={t("settings.forceRankFullPlaceholder")}
              className="h-9 rounded-lg text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSaveForceRank();
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-neutral-500">
              {t("settings.wingBanglaName")}
            </Label>
            <Input
              value={forceRankBangla}
              onChange={(e) => setForceRankBangla(e.target.value)}
              placeholder={t("settings.wingBanglaPlaceholder")}
              className="h-9 rounded-lg text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSaveForceRank();
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-neutral-500">
              {t("settings.wingShortName")}
            </Label>
            <Input
              value={forceRankShort}
              onChange={(e) => {
                setForceRankShortManual(true);
                setForceRankShort(e.target.value);
              }}
              onBlur={() => {
                const canon = canonicalForceServiceRank(forceRankShort);
                if (canon) setForceRankShort(canon);
              }}
              placeholder={t("settings.forceRankShortPlaceholder")}
              className="h-9 rounded-lg text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSaveForceRank();
                }
              }}
            />
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleteForceRank)}
        title={t("settings.deleteForceRankTitle")}
        body={t("settings.deleteForceRankBody", {
          name: deleteForceRank
            ? displayRank(deleteForceRank.rank, deleteForceRank.force)
            : "",
        })}
        confirmLabel={t("common.delete")}
        danger
        onCancel={() => setDeleteForceRank(null)}
        onConfirm={onDeleteForceRank}
      />

      <ConfirmDialog
        open={Boolean(deleteLabel)}
        title={t(copy.deleteTitle)}
        body={t(copy.deleteBody)}
        confirmLabel={t(copy.delete)}
        danger
        onCancel={() => setDeleteLabel(null)}
        onConfirm={onDelete}
      />
    </>
  );
}
