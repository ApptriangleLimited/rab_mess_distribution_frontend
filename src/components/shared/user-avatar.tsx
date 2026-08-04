import { cn, initials } from "@/lib/utils";

const sizeClass = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
} as const;

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
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizeClass[size],
        muted
          ? "bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-300"
          : "bg-nav-accent/15 text-nav-accent",
        className,
      )}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}
