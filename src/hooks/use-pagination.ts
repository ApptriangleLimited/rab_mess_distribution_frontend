"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PAGE_SIZE,
  clampPage,
  pageCount,
  pageRange,
  slicePage,
} from "@/lib/pagination";

/** Client pagination — resets to page 1 when `resetKey` changes. */
export function usePagination<T>(
  items: T[],
  resetKey?: string | number,
  pageSize = PAGE_SIZE,
) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const total = items.length;
  const totalPages = pageCount(total, pageSize);
  const safePage = clampPage(page, total, pageSize);

  const pageItems = useMemo(
    () => slicePage(items, safePage, pageSize),
    [items, safePage, pageSize],
  );

  const range = pageRange(safePage, total, pageSize);

  return {
    page: safePage,
    setPage,
    pageSize,
    total,
    totalPages,
    pageItems,
    from: range.from,
    to: range.to,
    showPager: total > pageSize,
  };
}
