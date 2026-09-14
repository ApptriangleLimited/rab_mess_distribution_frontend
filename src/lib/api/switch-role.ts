import { loginStaff } from "@/lib/api/auth";
import { isApiEnabled } from "@/lib/api/mode";
import { ROLE_KEYS, SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD } from "@/lib/constants";
import { nowISO } from "@/lib/date";
import {
  setAccessToken,
  setRefreshToken,
  setSession,
} from "@/lib/session";
import type { Role, Session } from "@/lib/types";

function isRole(value: string): value is Role {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

/** Demo role jump: log in as `{role}@mess.rab` so the API token matches. */
export async function switchToSeedRole(
  role: Role,
  current?: Session | null,
): Promise<Session> {
  if (isApiEnabled()) {
    const data = await loginStaff(SEED_STAFF_EMAIL(role), SEED_STAFF_PASSWORD);
    if (!isRole(data.staff.role)) {
      throw new Error("Invalid staff role");
    }
    const next: Session = {
      role: data.staff.role,
      name: data.staff.display_name,
      username: data.staff.email,
      loggedInAt: nowISO(),
    };
    setAccessToken(data.access_token);
    if (data.refresh_token) setRefreshToken(data.refresh_token);
    setSession(next);
    return next;
  }
  const seedUser =
    current?.username?.toLowerCase() === SEED_STAFF_EMAIL(current.role)
      ? SEED_STAFF_EMAIL(role)
      : (current?.username ?? SEED_STAFF_EMAIL(role));
  const next: Session = {
    role,
    name: current?.name ?? role,
    username: seedUser,
    loggedInAt: current?.loggedInAt ?? nowISO(),
  };
  setSession(next);
  return next;
}
