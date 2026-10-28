import { RATION_REPORT_META } from "@/lib/constants";
import {
  formatDateLong,
  formatDateOrdinal,
  formatMonthLong,
} from "@/lib/date";
import {
  downloadExcelSheets,
  type ExcelSheetSpec,
  type ExcelTitleLine,
} from "@/lib/excel";
import { amountToWordsEn } from "@/lib/money-words";
import {
  staffSheetToTransferSheet,
  type RationStaffSheet,
  type RationTransferSheet,
} from "@/lib/reports";
import {
  COMMUNITY_BANK_COLUMNS,
  COMMUNITY_FUEL_COLUMNS,
  communityBankBody,
  communityBankCells,
  communityBankSubject,
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
  freshMoneyBeftnBody,
  freshMoneyBeftnSubject,
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

function letterTitles(): ExcelTitleLine[] {
  return [
    { text: RATION_REPORT_META.govLine, role: "title" },
    { text: RATION_REPORT_META.policeLine, role: "meta" },
    { text: RATION_REPORT_META.orgName, role: "title" },
    { text: RATION_REPORT_META.station, role: "org" },
  ];
}

function letterCity(sender: {
  branch_location?: string;
}) {
  return (
    sender.branch_location?.trim() ||
    RATION_REPORT_META.station.split(",")[1]?.trim() ||
    "Dhaka"
  );
}

function letterPreamble(
  sheet: {
    reportDate?: string;
    month: string;
    sender: {
      bank_name?: string;
      label?: string;
      branch?: string;
      branch_location?: string;
    };
  },
  subject: string,
  body: string,
  dateRight?: string,
): string[][] {
  const date =
    dateRight ??
    (sheet.reportDate
      ? `Dt. ${formatDateOrdinal(sheet.reportDate)}`
      : `DT: ${formatMonthLong(sheet.month)}`);
  return [
    ["", date],
    ["To,"],
    ["Manager"],
    [sheet.sender.bank_name || sheet.sender.label || ""],
    ...(sheet.sender.branch ? [[sheet.sender.branch]] : []),
    [letterCity(sheet.sender)],
    [`SUBJECT: ${subject}`],
    ["Dear Sir,"],
    [body],
  ];
}

function amountInWordLine(total: number) {
  return [`Amount in word: ${amountToWordsEn(total)}`];
}

function fuelCloseRows(headers: readonly string[], total: number): string[][] {
  return [
    amountTotalRow(headers, trustBankMoney(total)),
    [],
    amountInWordLine(total),
  ];
}

function transferCloseRows(
  headers: readonly string[],
  total: number,
  accountNo?: string,
  pageNo = "page no : 1",
): string[][] {
  return [
    amountTotalRow(headers, trustBankMoney(total)),
    [],
    amountInWordLine(total),
    [
      `Please, the above amount will be debited today from our current account No. ${accountNo?.trim() || "—"} maintained in your branch.`,
    ],
    [],
    ["Thanking You"],
    ["Sincerely Yours,"],
    [],
    ["", pageNo],
  ];
}

function amountTotalRow(
  headers: readonly string[],
  amount: string,
  label = "G/Total:",
) {
  const idx = headers.findIndex((h) => /amount/i.test(h));
  const col = idx >= 0 ? idx : Math.max(headers.length - 1, 0);
  const row = Array.from({ length: headers.length }, () => "");
  if (col > 0) row[col - 1] = label;
  else row[0] = label;
  row[col] = amount;
  return row;
}

function templatedSheet(
  name: string,
  headers: readonly string[],
  bodyRows: string[][],
  extras: {
    subject: string;
    body: string;
    sheet: Parameters<typeof letterPreamble>[0];
    dateRight?: string;
    afterRows?: string[][];
  },
): ExcelSheetSpec {
  return {
    name,
    titles: letterTitles(),
    preamble: letterPreamble(
      extras.sheet,
      extras.subject,
      extras.body,
      extras.dateRight,
    ),
    headers: [...headers],
    rows: [...bodyRows, ...(extras.afterRows ?? [])],
  };
}

function transferExcelSheet(
  sheet: RationTransferSheet,
  name: string,
): ExcelSheetSpec {
  if (isTrustBankSheet(sheet)) {
    return templatedSheet(
      name,
      TRUST_BANK_COLUMNS,
      sheet.lines.map((row) => trustBankCells(row)),
      {
        sheet,
        subject: trustBankSubject(sheet.month),
        body: trustBankBody(sheet.month),
        afterRows: transferCloseRows(
          TRUST_BANK_COLUMNS,
          sheet.total,
          sheet.sender.account_number,
        ),
      },
    );
  }
  if (isCommunityBankSheet(sheet)) {
    return templatedSheet(
      name,
      COMMUNITY_BANK_COLUMNS,
      sheet.lines.map((row) => communityBankCells(row)),
      {
        sheet,
        subject: communityBankSubject(sheet.month),
        body: communityBankBody(sheet.month),
        afterRows: transferCloseRows(
          COMMUNITY_BANK_COLUMNS,
          sheet.total,
          sheet.sender.account_number,
        ),
      },
    );
  }
  if (isSonaliBankSheet(sheet)) {
    return templatedSheet(
      name,
      SONALI_BANK_COLUMNS,
      sheet.lines.map((row) => sonaliBankCells(row)),
      {
        sheet,
        subject: sonaliBankSubject(sheet.month),
        body: sonaliBankBody(sheet.month),
        afterRows: transferCloseRows(
          SONALI_BANK_COLUMNS,
          sheet.total,
          sheet.sender.account_number,
        ),
      },
    );
  }
  const memberBank = sheet.lines[0]?.user.bank_name || "—";
  const headers = [
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
  ] as const;
  return templatedSheet(
    name,
    headers,
    sheet.lines.map((row) => [
      String(row.ser),
      formatDateLong(row.date),
      row.refNo,
      row.senderAccountNo,
      row.receiverRouting,
      row.senderRouting,
      row.type,
      row.customerAccountName,
      row.user.account_number?.trim() || row.customerAccountNo || "—",
      money(row.amount),
      row.institute,
      row.entryDescription,
      row.paymentInfo,
      row.currency,
    ]),
    {
      sheet,
      subject: freshMoneyBeftnSubject(sheet.month, memberBank),
      body: freshMoneyBeftnBody(sheet.month),
      afterRows: transferCloseRows(
        headers,
        sheet.total,
        sheet.sender.account_number,
      ),
    },
  );
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
      const name = sheetLabel(bank, i);
      const dateRight = `DT: ${monthLabel}`;
      const letterSheet = {
        month: sheet.month,
        sender: sheet.sender,
      };

      if (isSonaliFuelStaffSheet(sheet)) {
        return templatedSheet(
          name,
          SONALI_FUEL_COLUMNS,
          sheet.lines.map((row) => sonaliFuelCells(row)),
          {
            sheet: letterSheet,
            subject: sonaliFuelSubject(sheet.month),
            body: sonaliFuelBody(sheet.month),
            dateRight,
            afterRows: fuelCloseRows(SONALI_FUEL_COLUMNS, sheet.total),
          },
        );
      }
      if (isCommunityFuelStaffSheet(sheet)) {
        return templatedSheet(
          name,
          COMMUNITY_FUEL_COLUMNS,
          sheet.lines.map((row) => communityFuelCells(row)),
          {
            sheet: letterSheet,
            subject: communityFuelSubject(sheet.month),
            body: communityFuelBody(sheet.month),
            dateRight,
            afterRows: fuelCloseRows(COMMUNITY_FUEL_COLUMNS, sheet.total),
          },
        );
      }
      if (
        (isTrustBankSheet(sheet) && !isTrustFuelStaffSheet(sheet)) ||
        (isCommunityBankSheet(sheet) && !isCommunityFuelStaffSheet(sheet)) ||
        (isSonaliBankSheet(sheet) && !isSonaliFuelStaffSheet(sheet))
      ) {
        return transferExcelSheet(staffSheetToTransferSheet(sheet), name);
      }

      const headers = [
        "Ser",
        "Pers No",
        "Rank",
        "Name",
        "Acct No",
        "Routing",
        "Bank",
        "Amount",
        "Remarks",
      ] as const;
      return templatedSheet(
        name,
        headers,
        sheet.lines.map((row) => [
          String(row.ser),
          row.user.personal_id || "—",
          row.user.rank || "",
          row.user.name,
          row.user.account_number?.trim() || "—",
          row.user.routing || "—",
          row.user.bank_name || "—",
          money(row.amount),
          "",
        ]),
        {
          sheet: letterSheet,
          subject: freshMoneyBeftnSubject(
            sheet.month,
            sheet.memberBank || sheet.sender.bank_name || "Trust Bank",
          ),
          body: freshMoneyBeftnBody(sheet.month),
          dateRight,
          afterRows: isTrustFuelStaffSheet(sheet)
            ? fuelCloseRows(headers, sheet.total)
            : undefined,
        },
      );
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
      return transferExcelSheet(sheet, sheetLabel(bank, i));
    }),
  );
}
