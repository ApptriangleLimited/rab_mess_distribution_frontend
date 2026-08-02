import { cn } from "@/lib/utils";

export function PagePane({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("page-pane", className)}>{children}</div>;
}
