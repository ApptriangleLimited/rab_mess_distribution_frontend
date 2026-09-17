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
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type Props = {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  triggerClassName?: string;
  getOptionLabel?: (value: string) => string;
  /** When set, adds a row that clears value to `""`. */
  clearLabel?: string;
  disabled?: boolean;
  contentClassName?: string;
  ariaLabel?: string;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  triggerClassName,
  getOptionLabel,
  clearLabel,
  disabled = false,
  contentClassName,
  ariaLabel,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const label = (opt: string) => getOptionLabel?.(opt) ?? opt;

  const allOptions = useMemo(() => {
    const trimmed = value.trim();
    if (trimmed && !options.some((opt) => opt === trimmed)) {
      return [trimmed, ...options];
    }
    return [...options];
  }, [options, value]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return allOptions;
    return allOptions.filter((opt) => {
      const hay = label(opt).toLowerCase();
      return hay.includes(query) || opt.toLowerCase().includes(query);
    });
  }, [allOptions, q, getOptionLabel]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (next) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "h-9 w-full justify-between rounded-lg px-3 text-sm font-normal shadow-none",
            triggerClassName,
          )}
        >
          <span
            className={cn(
              "truncate text-left",
              !value && "text-neutral-400",
            )}
          >
            {value ? label(value) : placeholder}
          </span>
          <IconChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "z-[300] w-[var(--radix-popover-trigger-width)] p-2",
          contentClassName,
        )}
        align="start"
        collisionPadding={8}
      >
        <div className="relative mb-2">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder || t("common.search")}
            className="h-9 rounded-lg pl-8"
            autoFocus
          />
        </div>
        <ul className="max-h-56 overflow-auto custom-scrollbar">
          {clearLabel ? (
            <li>
              <button
                type="button"
                className={cn(
                  "flex w-full whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800",
                  !value && "bg-neutral-100 dark:bg-neutral-800",
                )}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQ("");
                }}
              >
                {clearLabel}
              </button>
            </li>
          ) : null}
          {filtered.length === 0 ? (
            <li className="px-2 py-3 text-center text-xs text-neutral-500">
              {emptyLabel || t("common.noResults")}
            </li>
          ) : (
            filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800",
                    value === opt && "bg-neutral-100 dark:bg-neutral-800",
                  )}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  {label(opt)}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
