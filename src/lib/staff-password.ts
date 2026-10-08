/** Staff password rules. Keep in step with backend `validate_password`. */

export const STAFF_PASSWORD_MIN = 6;

const COMMON_PASSWORDS = new Set([
  "changeme!",
  "changeme",
  "password",
  "password1",
  "password123",
  "admin",
  "admin123",
  "12345678",
  "1234567890",
  "qwerty123",
  "letmein",
  "welcome",
  "mess12345",
]);

export function staffPasswordHasMix(password: string): boolean {
  if (!password) return false;
  if (/^\p{L}+$/u.test(password)) return false;
  if (/^\p{N}+$/u.test(password)) return false;
  return true;
}

export function staffPasswordChecks(password: string) {
  return {
    length: password.length >= STAFF_PASSWORD_MIN,
    mix: staffPasswordHasMix(password),
    uncommon: password.length > 0 && !COMMON_PASSWORDS.has(password.toLowerCase()),
  };
}

export function staffPasswordReady(password: string): boolean {
  const checks = staffPasswordChecks(password);
  return checks.length && checks.mix && checks.uncommon;
}

/** 0 empty, 1 weak, 2 fair, 3 good, 4 strong enough. */
export function staffPasswordLevel(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  const checks = staffPasswordChecks(password);
  if (checks.length && checks.mix && checks.uncommon) return 4;
  if (checks.length && checks.mix) return 3;
  if (checks.length || checks.mix) return 2;
  return 1;
}
