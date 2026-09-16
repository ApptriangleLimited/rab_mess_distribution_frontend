import { RATION_REPORT_META } from "@/lib/constants";
import {
  formatDateLong,
  formatDateOrdinal,
  formatMonthBill,
  formatMonthLong,
} from "@/lib/date";
import { downloadExcelSheets } from "@/lib/excel";
import { amountToWordsEn } from "@/lib/money-words";
import {
  staffSheetToTransferSheet,
  type RationStaffSheet,
  type RationTransferSheet,
} from "@/lib/reports";
import {
  COMMUNITY_BANK_COLUMNS,
  communityBankBody,
  communityBankCells,
  communityBankSubject,
  COMMUNITY_FUEL_COLUMNS,
  communityFuelBody,
  communityFuelCells,
  communityFuelSubject,
  isCommunityBankSheet,
  isCommunityFuelStaffSheet,
} from "@/lib/community-bank-letter";
import {
  SONALI_BANK_COLUMNS,
  SONALI_FUEL_COLUMNS,
  isSonaliBankSheet,
  isSonaliFuelStaffSheet,
  sonaliBankBody,
  sonaliFuelBody,
  sonaliFuelCells,
  sonaliFuelSubject,
  sonaliBankCells,
  sonaliBankSubject,
} from "@/lib/sonali-bank-letter";
import {
  TRUST_BANK_COLUMNS,
  isTrustBankSheet,
  isTrustFuelStaffSheet,
  trustBankBody,
  trustBankCells,
  trustBankMoney,
  trustBankSubject,
} from "@/lib/trust-bank-letter";

function money(n: number) {
  return n.toFixed(2);
}

function sheetLabel(name: string, index: number) {
  const clean = name.replace(/[:\\/?*\[\]]/g, " ").trim();
  return clean || `Sheet ${index + 1}`;
}

function letterHead(sheet: RationTransferSheet, subject: string, body: string) {
  return [
    [RATION_REPORT_META.govLine],
    [RATION_REPORT_META.policeLine],
    [RATION_REPORT_META.orgName],
    [RATION_REPORT_META.station],
    [],
    [
      RATION_REPORT_META.refPrefixPayAllce,
      `Dt. ${formatDateOrdinal(sheet.reportDate)}`,
    ],
    ["To,", "Manager"],
    ["", sheet.sender.bank_name || sheet.sender.label],
    ...(sheet.sender.branch ? [["", sheet.sender.branch]] : []),
    ["SUBJECT", subject],
    ["Dear Sir,", body],
    [],
  ];
}

function trustBankExcelRows(sheet: RationTransferSheet): string[][] {
  return [
    ...letterHead(sheet, trustBankSubject(sheet.month), trustBankBody(sheet.month)),
    [...TRUST_BANK_COLUMNS],
    ...sheet.lines.map((row) => trustBankCells(row)),
    [
      ...Array(9).fill(""),
      "G/Total:",
      trustBankMoney(sheet.total),
      "",
      "",
      "",
      "",
    ],
  ];
}

function communityBankExcelRows(sheet: RationTransferSheet): string[][] {
  return [
    ...letterHead(
      sheet,
      communityBankSubject(sheet.month),
      communityBankBody(sheet.month),
    ),
    [...COMMUNITY_BANK_COLUMNS],
    ...sheet.lines.map((row) => communityBankCells(row)),
    [
      ...Array(8).fill(""),
      "G/Total:",
      trustBankMoney(sheet.total),
      "",
      "",
      "",
      "",
    ],
  ];
}

function sonaliBankExcelRows(sheet: RationTransferSheet): string[][] {
  return [
    ...letterHead(
      sheet,
      sonaliBankSubject(sheet.month),
      sonaliBankBody(sheet.month),
    ),
    [...SONALI_BANK_COLUMNS],
    ...sheet.lines.map((row) => sonaliBankCells(row)),
    [
      ...Array(8).fill(""),
      "G/Total:",
      trustBankMoney(sheet.total),
      "",
      "",
      "",
      "",
    ],
  ];
}

function frTransferExcelRows(sheet: RationTransferSheet): string[][] {
  const monthLabel = formatMonthLong(sheet.month);
  const monthBill = formatMonthBill(sheet.month);
  const memberBank = sheet.lines[0]?.user.bank_name || "—";
  const subject = RATION_REPORT_META.subjectTagBill
    .replace("{monthLabel}", monthLabel)
    .replace("{bank}", memberBank);
  const body = `We would request you to disburse the Fresh Money bill for the following employees for the month of ${monthBill}.`;
  return [
    ...letterHead(sheet, subject, body),
    [
      "Ser",
      "Date",
      "Ref No",
      "Sender A/C",
      "Receiver routing",
      "Sender routing",
      "Type",
      "Customer A/C name",
      "Customer A/C",
      "Amount",
      "Institute",
      "Entry description",
      "Payment info",
      "Currency",
    ],
    ...sheet.lines.map((row) => [
      String(row.ser),
      formatDateLong(row.date),
      row.refNo,
      row.senderAccountNo,
      row.receiverRouting,
      row.senderRouting,
      row.type,
      row.customerAccountName,
      row.customerAccountNo,
      money(row.amount),
      row.institute,
      row.entryDescription,
      row.paymentInfo,
      row.currency,
    ]),
    ["", "", "", "", "", "", "", "", "G/Total:", money(sheet.total), "", "", "", ""],
  ];
}

function transferExcelRows(sheet: RationTransferSheet): string[][] {
  if (isTrustBankSheet(sheet)) return trustBankExcelRows(sheet);
  if (isCommunityBankSheet(sheet)) return communityBankExcelRows(sheet);
  if (isSonaliBankSheet(sheet)) return sonaliBankExcelRows(sheet);
  return frTransferExcelRows(sheet);
}

export function downloadStaffPayoutExcel(
  sheets: RationStaffSheet[],
  filename: string,
) {
  if (!sheets.length) return;

  downloadExcelSheets(
    filename,
    sheets.map((sheet, i) => {
      const monthLabel = formatMonthLong(sheet.month);
      const bank = sheet.memberBank || sheet.sender.bank_name || "Letter";
      if (isSonaliFuelStaffSheet(sheet)) {
        return {
          name: sheetLabel(bank, i),
          rows: [
            [RATION_REPORT_META.govLine],
            [RATION_REPORT_META.policeLine],
            [RATION_REPORT_META.orgName],
            [RATION_REPORT_META.station],
            [],
            [`${RATION_REPORT_META.refPrefix}/${sheet.month}`, `DT: ${monthLabel}`],
            ["To,", "Manager"],
            ["", sheet.sender.bank_name || sheet.sender.label],
            ["SUBJECT", sonaliFuelSubject(sheet.month)],
            ["Dear Sir,", sonaliFuelBody(sheet.month)],
            [],
            [...SONALI_FUEL_COLUMNS],
            ...sheet.lines.map((row) => sonaliFuelCells(row)),
            ["", "", "", "", "", "", "G/Total:", trustBankMoney(sheet.total), ""],
            ["Amount in word:", amountToWordsEn(sheet.total)],
          ],
        };
      }
      if (isCommunityFuelStaffSheet(sheet)) {
        return {
          name: sheetLabel(bank, i),
          rows: [
            [RATION_REPORT_META.govLine],
            [RATION_REPORT_META.policeLine],
            [RATION_REPORT_META.orgName],
            [RATION_REPORT_META.station],
            [],
            [`${RATION_REPORT_META.refPrefix}/${sheet.month}`, `DT: ${monthLabel}`],
            ["To,", "Manager"],
            ["", sheet.sender.bank_name || sheet.sender.label],
            ["SUBJECT", communityFuelSubject(sheet.month)],
            ["Dear Sir,", communityFuelBody(sheet.month)],
            [],
            [...COMMUNITY_FUEL_COLUMNS],
            ...sheet.lines.map((row) => communityFuelCells(row)),
          ],
        };
      }
      if (
        (isTrustBankSheet(sheet) && !isTrustFuelStaffSheet(sheet)) ||
        (isCommunityBankSheet(sheet) && !isCommunityFuelStaffSheet(sheet)) ||
        (isSonaliBankSheet(sheet) && !isSonaliFuelStaffSheet(sheet))
      ) {
        return {
          name: sheetLabel(bank, i),
          rows: transferExcelRows(staffSheetToTransferSheet(sheet)),
        };
      }
      const rows: string[][] = [
        [RATION_REPORT_META.govLine],
        [RATION_REPORT_META.policeLine],
        [RATION_REPORT_META.orgName],
        [RATION_REPORT_META.station],
        [],
        [`${RATION_REPORT_META.refPrefix}/${sheet.month}`, `DT: ${monthLabel}`],
        ["To: Manager", sheet.sender.bank_name || sheet.sender.label],
        [
          "SUBJECT",
          sheet.memberBank
            ? RATION_REPORT_META.subjectTagBill
                .replace("{monthLabel}", monthLabel)
                .replace("{bank}", sheet.memberBank)
            : RATION_REPORT_META.subjectFreshMoney.replace(
                "{month}",
                monthLabel,
              ),
        ],
        [
          "Dear Sir,",
          `We would request you to disburse of payment Fresh Money bills for the following employees for the month of ${monthLabel}.`,
        ],
        [],
        [
          "Ser",
          "Pers No",
          "Rank",
          "Name",
          "Acct No",
          "Routing",
          "Bank",
          "Amount",
          "Remarks",
        ],
        ...sheet.lines.map((row) => [
          String(row.ser),
          row.user.personal_id || "—",
          row.user.rank || "",
          row.user.name,
          row.user.account_number || "—",
          row.user.routing || "—",
          row.user.bank_name || "—",
          money(row.amount),
          row.remarks || (row.missingBank ? "Missing bank details" : ""),
        ]),
        ["", "", "", "", "", "", "Total", money(sheet.total), ""],
      ];
      return { name: sheetLabel(bank, i), rows };
    }),
  );
}

export function downloadFrTransferExcel(
  sheets: RationTransferSheet[],
  filename: string,
) {
  if (!sheets.length) return;

  downloadExcelSheets(
    filename,
    sheets.map((sheet, i) => {
      const bank =
        sheet.lines[0]?.user.bank_name || sheet.sender.bank_name || "FR";
      return { name: sheetLabel(bank, i), rows: transferExcelRows(sheet) };
    }),
  );
}
