export const PAGE_SIZE = 25;

/** Common page-size choices for list tables. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function pageCount(total: number, pageSize = PAGE_SIZE) {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

export function clampPage(page: number, total: number, pageSize = PAGE_SIZE) {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

export function slicePage<T>(
  items: T[],
  page: number,
  pageSize = PAGE_SIZE,
): T[] {
  const safe = clampPage(page, items.length, pageSize);
  const start = (safe - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function pageRange(
  page: number,
  total: number,
  pageSize = PAGE_SIZE,
): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const safe = clampPage(page, total, pageSize);
  const from = (safe - 1) * pageSize + 1;
  const to = Math.min(total, safe * pageSize);
  return { from, to };
}
