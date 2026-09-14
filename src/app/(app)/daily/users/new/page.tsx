import { redirect } from "next/navigation";

/** Daily cannot create members — CC does that. */
export default function DailyNewUserPage() {
  redirect("/daily/roster");
}
