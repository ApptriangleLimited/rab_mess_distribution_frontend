import { redirect } from "next/navigation";

/** Approvals live in Members table now. */
export default function ApprovalsRedirectPage() {
  redirect("/daily/roster");
}
