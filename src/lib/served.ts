const SERVED_KEY = "mess_served_v1";

type ServedMap = Record<string, string[]>; // date -> user ids

function read(): ServedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SERVED_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ServedMap;
  } catch {
    return {};
  }
}

function write(map: ServedMap) {
  localStorage.setItem(SERVED_KEY, JSON.stringify(map));
}

export function getServedIds(date: string): Set<string> {
  return new Set(read()[date] ?? []);
}

export function setServed(date: string, userId: string, served: boolean) {
  const map = read();
  const set = new Set(map[date] ?? []);
  if (served) set.add(userId);
  else set.delete(userId);
  map[date] = [...set];
  write(map);
  return set;
}

export function toggleServed(date: string, userId: string) {
  const current = getServedIds(date);
  const next = !current.has(userId);
  return setServed(date, userId, next);
}
