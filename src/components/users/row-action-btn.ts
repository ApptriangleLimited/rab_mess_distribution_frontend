import { cn } from "@/lib/utils";

const base =
  "h-8 w-8 rounded-[10px] shadow-[0_1px_2px_rgba(15,23,42,0.07),0_6px_14px_-8px_rgba(15,23,42,0.28)] ring-1 ring-inset transition-all hover:-translate-y-px hover:shadow-md disabled:translate-y-0 disabled:shadow-none disabled:opacity-40";

const tone = {
  view: "bg-white text-slate-700 ring-slate-200/90 hover:bg-slate-50 dark:bg-neutral-900 dark:text-slate-200 dark:ring-neutral-700 dark:hover:bg-neutral-800",
  edit: "bg-sky-50 text-sky-700 ring-sky-200/80 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800/60 dark:hover:bg-sky-950",
  approve:
    "bg-emerald-50 text-emerald-700 ring-emerald-200/80 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/60 dark:hover:bg-emerald-950",
  reject:
    "bg-rose-50 text-rose-600 ring-rose-200/80 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-800/60 dark:hover:bg-rose-950",
  request:
    "bg-neutral-950 text-white ring-neutral-800 hover:bg-green-800 dark:bg-white dark:text-neutral-900 dark:ring-white/20 dark:hover:bg-emerald-200",
  requestPending:
    "bg-amber-50 text-amber-800 ring-amber-200/80 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800/60 dark:hover:bg-amber-950",
  print:
    "bg-violet-50 text-violet-700 ring-violet-200/80 hover:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-800/60 dark:hover:bg-violet-950",
  download:
    "bg-teal-50 text-teal-700 ring-teal-200/80 hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-800/60 dark:hover:bg-teal-950",
  delete:
    "bg-rose-50 text-rose-600 ring-rose-200/80 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-800/60 dark:hover:bg-rose-950",
} as const;

export type RowActionTone = keyof typeof tone;

export function rowActionClass(kind: RowActionTone, className?: string) {
  return cn(base, tone[kind], className);
}
