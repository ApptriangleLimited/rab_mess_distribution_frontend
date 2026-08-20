/** `NEXT_PUBLIC_USE_API=true` → FastAPI. Anything else → localStorage demo, no API. */
export function isApiEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_USE_API?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}
