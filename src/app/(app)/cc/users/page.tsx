"use client";

import { CcTabs } from "@/components/layout/cc-tabs";
import { MembersWorkspace } from "@/components/users/members-workspace";

export default function CcUsersPage() {
  return <MembersWorkspace tabs={<CcTabs />} />;
}
