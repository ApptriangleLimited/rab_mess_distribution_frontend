import { cn } from "@/lib/utils";

export function SectionCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("section-card p-5", className)}>{children}</div>;
}
