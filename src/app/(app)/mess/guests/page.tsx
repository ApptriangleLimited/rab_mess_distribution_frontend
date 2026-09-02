import { redirect } from "next/navigation";

/** Guest meals live under Meal reports (`?audience=guest`). */
export default function MessGuestsPage() {
  redirect("/mess/reports?audience=guest");
}
