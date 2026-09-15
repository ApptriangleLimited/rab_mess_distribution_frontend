import { Badge } from "@/components/ui/badge";
import { PAPER_STATUS_CLASS } from "@/lib/store/paper-reports";
import type { PaperReportStatus } from "@/lib/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function PaperStatusBadge({ status }: { status: PaperReportStatus }) {
  const t = useT();
  const label =
    status === "approved"
      ? t("paperReports.approved")
      : status === "submitted"
        ? t("paperReports.submitted")
        : t("paperReports.draft");
  return (
    <Badge className={cn("border font-semibold", PAPER_STATUS_CLASS[status])}>
      {label}
    </Badge>
  );
}
