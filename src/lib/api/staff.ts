import { apiJson } from "@/lib/api/client";
import type { Role } from "@/lib/types";

export type StaffAccount = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  active: boolean;
  has_password?: boolean;
};

export function listStaffAccounts() {
  return apiJson<{ items: StaffAccount[] }>("/api/v1/staff");
}

export function createStaffAccount(body: {
  display_name: string;
  email: string;
  username?: string;
  password: string;
  role: Role;
}) {
  return apiJson<StaffAccount>("/api/v1/staff", {
    method: "POST",
    body: JSON.stringify({
      display_name: body.display_name,
      email: body.email,
      username: body.username ?? body.email,
      password: body.password,
      role: body.role,
    }),
  });
}

export function updateStaffAccount(
  id: string,
  body: {
    display_name?: string;
    email?: string;
    username?: string;
    password?: string;
    role?: Role;
    active?: boolean;
  },
) {
  return apiJson<StaffAccount>(`/api/v1/staff/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...body,
      username: body.username ?? body.email,
    }),
  });
}

export function revealStaffPassword(id: string) {
  return apiJson<{ password: string }>(
    `/api/v1/staff/${encodeURIComponent(id)}/password`,
  );
}
