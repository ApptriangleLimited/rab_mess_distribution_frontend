"use client";

import { useMemo, useState } from "react";
import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { User } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  users: User[];
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
};

export function MemberSearchSelect({
  users,
  value,
  onChange,
  placeholder,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = users.find((u) => u.id === value);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) =>
      [u.name, u.rab_id, u.rank, u.wing]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [users, q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-between rounded-lg px-3 font-normal"
        >
          <span className="truncate text-left">
            {selected
              ? `${selected.rab_id} — ${selected.name}`
              : placeholder || t("ration.selectMember")}
          </span>
          <IconChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[300] w-[var(--radix-popover-trigger-width)] p-2"
        align="start"
      >
        <div className="relative mb-2">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("common.search")}
            className="h-9 rounded-lg pl-8"
            autoFocus
          />
        </div>
        <ul className="max-h-56 overflow-auto">
          {filtered.length === 0 ? (
            <li className="px-2 py-3 text-center text-xs text-neutral-500">
              {t("ration.noMembersForTag")}
            </li>
          ) : (
            filtered.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800",
                    value === u.id && "bg-neutral-100 dark:bg-neutral-800",
                  )}
                  onClick={() => {
                    onChange(u.id);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span className="font-medium">{u.name}</span>
                  <span className="text-[11px] text-neutral-500">
                    {u.rab_id}
                    {u.rank ? ` · ${u.rank}` : ""}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
