"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { IconPlus } from "@tabler/icons-react";
import { PageHeader } from "@/components/shared/page-header";
import { PagePane } from "@/components/shared/page-pane";
import { Button } from "@/components/ui/button";
import { UserFiltersBar } from "@/components/users/user-filters";
import { UserTable } from "@/components/users/user-table";
import { useStore } from "@/hooks/use-store";
import { filterUsers, type UserFilters } from "@/lib/store/users";
import { useT } from "@/i18n/provider";

export default function CcUsersPage() {
  const t = useT();
  const state = useStore();
  const [filters, setFilters] = useState<UserFilters>({
    q: "",
    status: "all",
    approval: "all",
    wing: "all",
    rank: "all",
    date_from: "",
    date_to: "",
  });

  const users = useMemo(
    () => filterUsers(state.users, filters),
    [state.users, filters],
  );

  return (
    <PagePane>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6"
      >
        <PageHeader
          title={t("pages.ccUsers.title")}
          subtitle={t("pages.ccUsers.subtitle", { count: users.length })}
          actions={
            <Button asChild variant="cta" size="sm" className="rounded-xl">
              <Link href="/cc/users/new">
                <IconPlus className="h-3.5 w-3.5" />
                {t("cc.newUser")}
              </Link>
            </Button>
          }
        />
        <UserFiltersBar value={filters} onChange={setFilters} />
        <UserTable users={users} />
      </motion.div>
    </PagePane>
  );
}
