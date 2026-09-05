import { redirect } from "next/navigation";

/** Legacy demo print URL — sheets now live on each saved event. */
export default function MessPritibhojLegacyPrintPage() {
  redirect("/mess/pritibhoj");
}
