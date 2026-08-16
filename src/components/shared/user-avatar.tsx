import { cn, initials } from "@/lib/utils";

const sizeClass = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
} as const;

/** Soft brand-adjacent tones (no purple). */
const AVATAR_TONES = [
  "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/60",
  "bg-sky-100 text-sky-800 ring-1 ring-sky-200/80 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800/60",
  "bg-teal-100 text-teal-800 ring-1 ring-teal-200/80 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-800/60",
  "bg-cyan-100 text-cyan-900 ring-1 ring-cyan-200/80 dark:bg-cyan-950/50 dark:text-cyan-200 dark:ring-cyan-800/60",
  "bg-lime-100 text-lime-900 ring-1 ring-lime-200/80 dark:bg-lime-950/40 dark:text-lime-200 dark:ring-lime-800/50",
  "bg-[color-mix(in_srgb,var(--nav-accent)_14%,white)] text-nav-accent ring-1 ring-nav-accent/20 dark:bg-nav-accent/20 dark:text-sky-200 dark:ring-nav-accent/30",
] as const;

function toneFromName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  }
  return AVATAR_TONES[h]!;
}

export function UserAvatar({
  name,
  size = "md",
  muted,
  className,
}: {
  name: string;
  size?: keyof typeof sizeClass;
  /** Inactive / muted look */
  muted?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight",
        sizeClass[size],
        muted
          ? "bg-neutral-200 text-neutral-500 ring-1 ring-neutral-300/80 dark:bg-neutral-700 dark:text-neutral-300 dark:ring-neutral-600"
          : toneFromName(name),
        className,
      )}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}
