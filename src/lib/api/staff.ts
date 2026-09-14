import { apiJson } from "@/lib/api/client";
import type { Role } from "@/lib/types";

export type StaffAccount = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  active: boolean;
};

export function listStaffAccounts() {
  return apiJson<{ items: StaffAccount[] }>("/api/v1/staff");
}

export function createStaffAccount(body: {
  display_name: string;
  username: string;
  password: string;
  role: Role;
}) {
  return apiJson<StaffAccount>("/api/v1/staff", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateStaffAccount(
  id: string,
  body: {
    display_name?: string;
    username?: string;
    password?: string;
    role?: Role;
    active?: boolean;
  },
) {
  return apiJson<StaffAccount>(`/api/v1/staff/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
