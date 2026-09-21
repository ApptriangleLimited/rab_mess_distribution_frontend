import { apiJson } from "@/lib/api/client";

export type StaffPublic = {
  id: string;
  email: string;
  srb_id?: string;
  rab_id?: string;
  display_name: string;
  role: string;
  avatar?: string;
};

export type LoginData = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  staff: StaffPublic;
};

export function staffSrbId(staff: Pick<StaffPublic, "srb_id" | "rab_id" | "email">) {
  return (staff.srb_id || staff.rab_id || staff.email || "").trim();
}

export function loginStaff(srbId: string, password: string, otp?: string) {
  return apiJson<LoginData>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ srb_id: srbId, rab_id: srbId, email: srbId, password, otp: otp || "" }),
  });
}

export function changePasswordAtLogin(
  srbId: string,
  currentPassword: string,
  newPassword: string,
) {
  return apiJson<void>("/api/v1/auth/login-change-password", {
    method: "POST",
    body: JSON.stringify({
      srb_id: srbId,
      rab_id: srbId,
      email: srbId,
      current_password: currentPassword,
      new_password: newPassword,
    }),
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
  srb_id?: string;
  rab_id?: string;
  password?: string;
  avatar?: string | null;
}) {
  return apiJson<StaffPublic>("/api/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify({
      display_name: body.display_name,
      password: body.password,
      avatar: body.avatar,
    }),
  });
}
