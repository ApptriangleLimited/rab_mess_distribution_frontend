import { redirect } from "next/navigation";
import { monthKey } from "@/lib/date";

export default function ConsumeIndex() {
  redirect(`/consume/monthly/ledger?month=${monthKey()}`);
}
