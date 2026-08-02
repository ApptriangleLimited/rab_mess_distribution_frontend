"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/lib/types";
import { useT } from "@/i18n/provider";

export function ApprovalCard({
  user,
  onApprove,
  onReject,
  onEnd,
}: {
  user: User;
  onApprove: () => void;
  onReject: () => void;
  onEnd: () => void;
}) {
  const t = useT();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
            {user.name}
          </h3>
          <p className="mt-1 font-mono text-xs text-neutral-500">{user.rab_id}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600">
            <span>{user.rank}</span>
            <span>·</span>
            <span>{user.wing}</span>
            <span>·</span>
            <span>{user.phone || "—"}</span>
          </div>
        </div>
        <Badge className="bg-amber-50 text-amber-800">
          {t("cc.approvalPending")}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="cta" size="sm" onClick={onApprove}>
          {t("daily.approve")}
        </Button>
        <Button variant="outline" size="sm" onClick={onReject}>
          {t("daily.reject")}
        </Button>
        <Button variant="danger" size="sm" onClick={onEnd}>
          {t("daily.endEntry")}
        </Button>
      </div>
    </motion.div>
  );
}
