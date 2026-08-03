import { redirect } from "next/navigation";
import { previousMonthKey } from "@/lib/date";

export default function ConsumeIndex() {
  redirect(`/consume/monthly/ledger?month=${previousMonthKey()}`);
}
