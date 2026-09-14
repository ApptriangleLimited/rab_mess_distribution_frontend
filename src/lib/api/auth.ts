import { apiJson } from "@/lib/api/client";

export type StaffPublic = {
  id: string;
  email: string;
  display_name: string;
  role: string;
};

export type LoginData = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  staff: StaffPublic;
};

export function loginStaff(email: string, password: string, otp?: string) {
  return apiJson<LoginData>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, otp: otp || "" }),
  });
}

export function refreshStaff(refreshToken: string) {
  return apiJson<LoginData>("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function logoutStaff() {
  try {
    await apiJson<void>("/api/v1/auth/logout", { method: "POST" });
  } catch {
    /* local session still clears */
  }
}

export function getStaffMe() {
  return apiJson<StaffPublic>("/api/v1/auth/me");
}

export function updateStaffProfile(body: {
  display_name: string;
  username?: string;
  password?: string;
}) {
  return apiJson<StaffPublic>("/api/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
