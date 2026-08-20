import { apiJson } from "@/lib/api/client";

export type StaffPublic = {
  id: string;
  email: string;
  display_name: string;
  role: string;
};

export type LoginData = {
  access_token: string;
  token_type: string;
  expires_in: number;
  staff: StaffPublic;
};

export function loginStaff(email: string, password: string) {
  return apiJson<LoginData>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logoutStaff() {
  try {
    await apiJson<void>("/api/v1/auth/logout", { method: "POST" });
  } catch {
    /* local session still clears */
  }
}
