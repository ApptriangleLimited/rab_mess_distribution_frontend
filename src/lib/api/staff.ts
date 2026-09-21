import { apiJson } from "@/lib/api/client";
import type { Role } from "@/lib/types";

export type StaffAccount = {
  id: string;
  email: string;
  srb_id?: string;
  rab_id?: string;
  display_name: string;
  role: Role;
  active: boolean;
  has_password?: boolean;
  password?: string;
  avatar?: string;
};

export function staffLoginId(row: Pick<StaffAccount, "srb_id" | "rab_id" | "email">) {
  return (row.srb_id || row.rab_id || row.email || "").trim();
}

export function listStaffAccounts() {
  return apiJson<{ items: StaffAccount[] }>("/api/v1/staff");
}

export function createStaffAccount(body: {
  display_name: string;
  srb_id: string;
  rab_id?: string;
  email?: string;
  username?: string;
  password: string;
  role: Role;
}) {
  const srbId = (body.srb_id || body.rab_id || "").trim();
  return apiJson<StaffAccount>("/api/v1/staff", {
    method: "POST",
    body: JSON.stringify({
      display_name: body.display_name,
      srb_id: srbId,
      rab_id: srbId,
      email: body.email ?? srbId,
      username: body.username ?? srbId,
      password: body.password,
      role: body.role,
    }),
  });
}

export function updateStaffAccount(
  id: string,
  body: {
    display_name?: string;
    srb_id?: string;
    rab_id?: string;
    email?: string;
    username?: string;
    password?: string;
    role?: Role;
    active?: boolean;
  },
) {
  const srbId = (body.srb_id ?? body.rab_id ?? body.email ?? body.username)?.trim();
  const payload: Record<string, unknown> = { ...body };
  if (srbId) {
    payload.srb_id = srbId;
    payload.rab_id = srbId;
    payload.email = srbId;
    payload.username = srbId;
  }
  return apiJson<StaffAccount>(`/api/v1/staff/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function revealStaffPassword(id: string) {
  return apiJson<{ password: string }>(
    `/api/v1/staff/${encodeURIComponent(id)}/password`,
  );
}
