/** Member rows on one consume bill page. The total and signatures stay on the last page. */
export const CONSUME_BILL_ROWS_PER_PAGE = 30;

export function chunkBillRows<T>(rows: readonly T[]): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += CONSUME_BILL_ROWS_PER_PAGE) {
    pages.push(rows.slice(i, i + CONSUME_BILL_ROWS_PER_PAGE));
  }
  return pages.length ? pages : [[]];
}
