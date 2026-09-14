import { apiJson } from "@/lib/api/client";
import type { UserFormValues } from "@/components/users/user-form";
import { normalizeBdPhone } from "@/lib/utils";

export type MemberPublic = {
  id: string;
  name: string;
  rab_id: string;
  approval_status: string;
  status: string;
};

function emptyToNull(value: string): string | null {
  const s = value.trim();
  return s ? s : null;
}

/** Map form values → `POST /api/v1/public/register` body. */
export function toMemberEntryBody(values: UserFormValues) {
  return {
    name: values.name.trim(),
    rab_id: values.rab_id.trim(),
    personal_id: values.personal_id.trim(),
    rfid: values.rfid.trim(),
    rank: values.rank.trim(),
    wing: values.wing.trim(),
    force: values.force.trim(),
    religion: values.religion.trim(),
    member_type: values.member_type,
    documents_verified: Boolean(values.documents_verified),
    dropdown_no: values.dropdown_no.trim(),
    phone: normalizeBdPhone(values.phone),
    blood_group: values.blood_group.trim(),
    bank_name: values.bank_name.trim(),
    account_name: values.account_name.trim(),
    account_number: values.account_number.trim(),
    routing: values.routing.trim(),
    branch: values.branch.trim(),
    branch_location: values.branch_location.trim(),
    joining_date: emptyToNull(values.joining_date),
    out_date: emptyToNull(values.out_date),
    default_tag: (values.default_tag || "MS").trim().toUpperCase() || "MS",
    documents: (values.documents ?? []).map((d) => ({
      name: d.name,
      size: d.size,
      url: d.url ?? null,
      id: d.id ?? null,
    })),
    emergency_contacts: (values.emergency_contacts ?? []).map((c) => ({
      name: c.name.trim(),
      relation: c.relation.trim(),
      phone: normalizeBdPhone(c.phone.trim()),
    })),
  };
}

export function publicRegisterMember(values: UserFormValues) {
  return apiJson<MemberPublic>("/api/v1/public/register", {
    method: "POST",
    body: JSON.stringify(toMemberEntryBody(values)),
  });
}
