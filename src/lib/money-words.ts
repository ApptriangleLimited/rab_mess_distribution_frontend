const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function underThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = `${ONES[h]} Hundred`;
  return rest ? `${head} ${underThousand(rest)}` : head;
}

/** Indian numbering: crore / lakh / thousand (common for BDT wording). */
function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(`${underThousand(crore)} Crore`);
  if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
  if (n) parts.push(underThousand(n));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Convert BDT amount to English words.
 * Examples: 0 → "Zero Taka Only"; 2740.44 → "Two Thousand Seven Hundred Forty Taka and Forty Four Paisa Only"
 */
export function amountToWordsEn(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) {
    return "Zero Taka Only";
  }
  const rounded = Math.round(amount * 100) / 100;
  const taka = Math.floor(rounded + 1e-9);
  const paisa = Math.round((rounded - taka) * 100);

  if (taka === 0 && paisa === 0) return "Zero Taka Only";

  const takaPart =
    taka === 0
      ? ""
      : `${integerToWords(taka)} Taka`;
  const paisaPart =
    paisa === 0
      ? ""
      : `${integerToWords(paisa)} Paisa`;

  if (takaPart && paisaPart) {
    return `${takaPart} and ${paisaPart} Only`;
  }
  if (takaPart) return `${takaPart} Only`;
  return `${paisaPart} Only`;
}
