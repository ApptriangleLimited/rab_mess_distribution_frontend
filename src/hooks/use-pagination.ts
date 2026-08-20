"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PAGE_SIZE,
  clampPage,
  pageCount,
  pageRange,
  slicePage,
} from "@/lib/pagination";

/** Client pagination — resets to page 1 when `resetKey` or page size changes. */
export function usePagination<T>(
  items: T[],
  resetKey?: string | number,
  initialPageSize = PAGE_SIZE,
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  function setPageSize(next: number) {
    setPageSizeState(next);
    setPage(1);
  }

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
    setPageSize,
    total,
    totalPages,
    pageItems,
    from: range.from,
    to: range.to,
    showPager: total > pageSize,
  };
}
