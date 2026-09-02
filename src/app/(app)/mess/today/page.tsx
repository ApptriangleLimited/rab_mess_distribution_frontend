import { redirect } from "next/navigation";

export default function MessTodayRedirect() {
  redirect("/mess/reports?view=missing");
}
