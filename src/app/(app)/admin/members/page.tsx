"use client";

import { AdminTabs } from "@/components/layout/ration-tabs";
import { MembersWorkspace } from "@/components/users/members-workspace";

export default function AdminMembersPage() {
  return <MembersWorkspace tabs={<AdminTabs />} />;
}
