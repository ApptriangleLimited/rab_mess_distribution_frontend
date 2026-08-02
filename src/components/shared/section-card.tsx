import { cn } from "@/lib/utils";

export function SectionCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("section-card", className)}>{children}</div>;
}
