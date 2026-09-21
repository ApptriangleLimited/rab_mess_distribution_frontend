import ExcelJS from "exceljs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "docs", "SRB_Member_Import.xlsx");

const headers = [
  { key: "name", header: "name *", width: 22, required: true },
  { key: "srb_id", header: "srb_id", width: 16 },
  { key: "personal_id", header: "personal_id *", width: 18, required: true },
  { key: "rfid", header: "rfid", width: 14 },
  { key: "rank", header: "rank *", width: 16, required: true },
  { key: "wing", header: "wing *", width: 22, required: true },
  { key: "force", header: "force", width: 14 },
  { key: "force_rank", header: "force_rank", width: 16 },
  { key: "religion", header: "religion", width: 14 },
  { key: "member_type", header: "member_type *", width: 16, required: true },
  { key: "dropdown_no", header: "dropdown_no", width: 14 },
  { key: "phone", header: "phone", width: 16 },
  { key: "blood_group", header: "blood_group", width: 12 },
  { key: "status", header: "status", width: 10 },
  { key: "joining_date", header: "joining_date", width: 14 },
  { key: "out_date", header: "out_date", width: 12 },
  { key: "default_tag", header: "default_tag", width: 12 },
  { key: "bank_name", header: "bank_name", width: 22 },
  { key: "account_name", header: "account_name", width: 22 },
  { key: "account_number", header: "account_number", width: 18 },
  { key: "routing", header: "routing", width: 14 },
  { key: "branch", header: "branch", width: 16 },
  { key: "branch_location", header: "branch_location", width: 18 },
  { key: "emergency_name", header: "emergency_name", width: 18 },
  { key: "emergency_relation", header: "emergency_relation", width: 16 },
  { key: "emergency_phone", header: "emergency_phone", width: 16 },
];

const memberTypes = ["permanent", "new", "attached", "guest", "civilian"];
const religions = ["Islam", "Hinduism", "Buddhism", "Christianity", "Other"];
const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const statuses = ["1", "0"];
const tags = [
  "MS",
  "FR",
  "CL",
  "PL",
  "WR",
  "CD",
  "WIT",
  "MED",
  "ML",
  "TRG",
  "MOL",
  "CMH",
  "RBH",
  "BGH",
  "AWL",
  "OSL",
  "RL",
  "JL",
  "PE",
  "LNK",
  "MFR",
];

const workbook = new ExcelJS.Workbook();
workbook.creator = "SRB Mess";
workbook.created = new Date();

const info = workbook.addWorksheet("Read me", {
  views: [{ showGridLines: false }],
});
info.getColumn(1).width = 92;
info.addRow(["SRB member import — fill Members, then send this file back."]);
info.getRow(1).font = { bold: true, size: 14, color: { argb: "FF064E3B" } };
info.addRow([]);
info.addRow(["How to fill"]);
info.getRow(3).font = { bold: true, size: 12 };
;[
  "1. Open the Members sheet. Keep the header row. Do not rename columns.",
  "2. One member per row. Delete the sample row before you send the file.",
  "3. Yellow columns are required for most members (name, personal_id, rank, wing, member_type).",
  "4. member_type must be one of: permanent / new / attached / guest / civilian.",
  "5. Rank and wing must match Settings (same spelling as the app).",
  "6. Dates: YYYY-MM-DD  example 2026-01-15",
  "7. status: 1 = active, 0 = inactive. Leave blank for active.",
  "8. default_tag: leave blank for now. After import you will assign duty tags/roles.",
  "9. Permanent members should also have bank_name, account_name, account_number, routing, branch, branch_location.",
  "10. Guest: only name is required. Civilian: personal_id is NID.",
  "11. Do not add photos or extra sheets. Extra columns are ignored.",
].forEach((line) => info.addRow([line]));
info.addRow([]);
info.addRow(["After you fill this file"]);
info.getRow(16).font = { bold: true, size: 12 };
info.addRow([
  "Send SRB_Member_Import.xlsx back. Members will be inserted. Then send the duty tag/role list for those members.",
]);

const look = workbook.addWorksheet("Lookups");
look.columns = [
  { header: "member_type", width: 16 },
  { header: "religion", width: 16 },
  { header: "blood_group", width: 14 },
  { header: "status", width: 12 },
  { header: "default_tag", width: 14 },
];
look.getRow(1).font = { bold: true };
const max = Math.max(
  memberTypes.length,
  religions.length,
  bloodGroups.length,
  statuses.length,
  tags.length,
);
for (let i = 0; i < max; i++) {
  look.addRow([
    memberTypes[i] ?? "",
    religions[i] ?? "",
    bloodGroups[i] ?? "",
    statuses[i] ?? "",
    tags[i] ?? "",
  ]);
}

const sheet = workbook.addWorksheet("Members", {
  views: [{ state: "frozen", ySplit: 1 }],
});
sheet.columns = headers.map((col) => ({
  header: col.header,
  key: col.key,
  width: col.width,
}));

const headerRow = sheet.getRow(1);
headerRow.height = 22;
headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
headerRow.alignment = { vertical: "middle", wrapText: true };
headers.forEach((col, i) => {
  const cell = headerRow.getCell(i + 1);
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: col.required ? "FF0F766E" : "FF334155" },
  };
});

sheet.addRow({
  name: "SAMPLE — delete this row",
  srb_id: "SRB-0001",
  personal_id: "1234567890",
  rfid: "",
  rank: "SGT",
  wing: "Admin",
  force: "Army",
  force_rank: "",
  religion: "Islam",
  member_type: "permanent",
  dropdown_no: "",
  phone: "01700000000",
  blood_group: "B+",
  status: "1",
  joining_date: "2026-01-01",
  out_date: "",
  default_tag: "",
  bank_name: "Trust Bank",
  account_name: "Sample Name",
  account_number: "001234567890",
  routing: "180260001",
  branch: "Dhaka",
  branch_location: "Dhaka",
  emergency_name: "",
  emergency_relation: "",
  emergency_phone: "",
});
sheet.getRow(2).font = { italic: true, color: { argb: "FF64748B" } };

function listFormula(colLetter, count) {
  return `Lookups!$${colLetter}$2:$${colLetter}$${count + 1}`;
}

const dropdowns = {
  10: listFormula("A", memberTypes.length),
  9: listFormula("B", religions.length),
  13: listFormula("C", bloodGroups.length),
  14: listFormula("D", statuses.length),
  17: listFormula("E", tags.length),
};

for (let row = 2; row <= 500; row++) {
  for (const [col, formulae] of Object.entries(dropdowns)) {
    sheet.getCell(row, Number(col)).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [formulae],
      showErrorMessage: true,
      errorTitle: "Invalid value",
      error: "Pick a value from the dropdown (see Lookups sheet).",
    };
  }
}

await workbook.xlsx.writeFile(outPath);
console.log(`Wrote ${outPath}`);
