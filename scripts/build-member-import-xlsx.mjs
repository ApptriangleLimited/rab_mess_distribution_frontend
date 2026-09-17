import ExcelJS from "exceljs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const TITLE = "Special Response Battalion (SRB) — Member Data Collection";

const MEMBER_TYPES = [
  "new",
  "attached",
  "permanent",
  "guest",
  "civilian",
];

const WINGS = [
  "Admin",
  "Ops Wg",
  "Int Wg",
  "Comm & MIS Wg",
  "Trg Wg",
  "L & M Wg",
  "Inv Wg",
  "Air Wg",
  "R & D Cell",
  "Training School",
];

const ADMIN_SUB_WINGS = [
  "DG Office",
  "ADG (Ops) Office",
  "ADG (Admin) Office",
  "Dir Office",
  "Sup Br",
  "Per Br",
  "Gen Br",
  "Med Br",
  "Rec Br",
  "Fin Br",
  "Proc Br",
  "Proj Br",
  "Dev Br",
  "Wksp Br",
  "HQ Br",
];

const HQ_SUB_WINGS = [
  "HQ Office",
  "SY Br",
  "Forces Mess",
  "Fd Mess",
  "MT Br",
  "New Temp Att",
];

const RANKS = [
  "DAD",
  "RT",
  "SI",
  "ASI",
  "Naik",
  "Constable",
  "Cook",
  "NCE",
  "Civil",
];

const FORCES = [
  "Army",
  "Navy",
  "Air Force",
  "Police",
  "BGB",
  "Ansar",
  "Coast Guard",
  "Civilian",
];

const FORCE_CIVIL_TAIL = [
  "CK",
  "Msg",
  "MW",
  "Msl",
  "Mali",
  "LA",
  "WB",
  "Civ",
];

const BGB_CIVIL_TAIL = [
  "CK",
  "MLSS",
  "MW",
  "Msl",
  "Mali",
  "LA",
  "WB",
  "Civ",
];

const NAVY_CIVIL_TAIL = [
  "OD",
  "LCK/CK",
  "NCE/Top",
  "Msg",
  "L/Std",
  "Msl",
  "Mali",
  "LA",
  "WB",
  "Civ",
];

const FORCE_RANKS = {
  Army: [
    "MWO",
    "SWO",
    "WO",
    "RT",
    "Sgt",
    "Cpl",
    "L/Cpl",
    "Sainik",
    ...FORCE_CIVIL_TAIL,
  ],
  Navy: [
    "MCPO",
    "SCPO",
    "CPO",
    "RT",
    "PO",
    "LS",
    "AB",
    "Seaman",
    ...NAVY_CIVIL_TAIL,
  ],
  "Air Force": [
    "MWO",
    "SWO",
    "WO",
    "RT",
    "Sgt",
    "Cpl",
    "LAC",
    "AC",
    ...FORCE_CIVIL_TAIL,
  ],
  Police: [
    "ASP",
    "Inspector",
    "RT",
    "SI",
    "ASI",
    "Naik",
    "Constable",
    ...FORCE_CIVIL_TAIL,
  ],
  BGB: [
    "SM",
    "Sub",
    "Nb Sub",
    "RT",
    "Havildar",
    "Naik",
    "Lance Naik",
    "Sepoy",
    ...BGB_CIVIL_TAIL,
  ],
  Ansar: [
    "CD",
    "RT",
    "PC",
    "APC",
    "Subedar",
    "Nb Subedar",
    "Havildar",
    "Naik",
    "Lance Naik",
    "Sepoy",
    ...FORCE_CIVIL_TAIL,
  ],
  "Coast Guard": [
    "MCPO",
    "SCPO",
    "CPO",
    "RT",
    "PO",
    "LS",
    "AB",
    "Seaman",
    ...NAVY_CIVIL_TAIL,
  ],
  Civilian: ["S A EB"],
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const RELIGIONS = ["Islam", "Hinduism", "Buddhism", "Christianity", "Other"];
const MEMBER_BANKS = ["Trust bank", "Community bank", "Sonali Bank"];
const YES_NO = ["Yes", "No"];

const BRANCH_DISTRICTS = [
  "Bagerhat",
  "Bandarban",
  "Barguna",
  "Barishal",
  "Bhola",
  "Bogura",
  "Brahmanbaria",
  "Chandpur",
  "Chapainawabganj",
  "Chattogram",
  "Cox's Bazar",
  "Cumilla",
  "Dhaka",
  "Dinajpur",
  "Faridpur",
  "Feni",
  "Gaibandha",
  "Gazipur",
  "Gopalganj",
  "Habiganj",
  "Jamalpur",
  "Jashore",
  "Jhalokati",
  "Jhenaidah",
  "Joypurhat",
  "Khagrachhari",
  "Khulna",
  "Kishoreganj",
  "Kurigram",
  "Kushtia",
  "Lakshmipur",
  "Lalmonirhat",
  "Madaripur",
  "Magura",
  "Manikganj",
  "Meherpur",
  "Moulvibazar",
  "Munshiganj",
  "Mymensingh",
  "Naogaon",
  "Narail",
  "Narayanganj",
  "Narsingdi",
  "Natore",
  "Netrokona",
  "Nilphamari",
  "Noakhali",
  "Pabna",
  "Panchagarh",
  "Patuakhali",
  "Pirojpur",
  "Rajbari",
  "Rajshahi",
  "Rangamati",
  "Rangpur",
  "Satkhira",
  "Shariatpur",
  "Sherpur",
  "Sirajganj",
  "Sunamganj",
  "Sylhet",
  "Tangail",
  "Thakurgaon",
];

const COLUMNS = [
  { key: "member_type", header: "Member type *", width: 16 },
  { key: "personal_id", header: "Personal no *", width: 16 },
  { key: "rab_id", header: "SRB ID", width: 14 },
  { key: "rank", header: "SRB rank *", width: 14 },
  { key: "name", header: "Name *", width: 22 },
  { key: "wing", header: "Wing *", width: 16 },
  { key: "sub_wing", header: "Sub wing (if Admin)", width: 20 },
  { key: "hq_wing", header: "HQ sub wing (if HQ Br)", width: 22 },
  { key: "phone", header: "Phone", width: 16 },
  { key: "blood_group", header: "Blood group", width: 13 },
  { key: "force", header: "Force", width: 14 },
  { key: "force_rank", header: "Force rank", width: 16 },
  { key: "religion", header: "Religion", width: 14 },
  { key: "joining_date", header: "Joining date (YYYY-MM-DD)", width: 22 },
  { key: "out_date", header: "Out date (YYYY-MM-DD)", width: 20 },
  { key: "rfid", header: "RFID", width: 14 },
  { key: "emergency_name", header: "Emergency contact name", width: 22 },
  { key: "emergency_relation", header: "Emergency relation", width: 18 },
  { key: "emergency_phone", header: "Emergency phone", width: 16 },
  { key: "bank_name", header: "Bank name", width: 18 },
  { key: "account_name", header: "Account name", width: 20 },
  { key: "account_number", header: "Account number", width: 18 },
  { key: "routing", header: "Routing", width: 14 },
  { key: "branch", header: "Branch district", width: 16 },
  { key: "branch_location", header: "Branch location", width: 18 },
  { key: "documents_verified", header: "Documents verified (civilian)", width: 24 },
];

const FIRST_DATA = 5;
const LAST_DATA = 104;
const GREEN = "067957";

function forceRangeName(force) {
  return force.replaceAll(" ", "_");
}

function writeListColumn(sheet, col, header, values) {
  sheet.getCell(1, col).value = header;
  sheet.getCell(1, col).font = { bold: true };
  values.forEach((value, i) => {
    sheet.getCell(i + 2, col).value = value;
  });
  return { col, count: values.length };
}

function listRef(col, count) {
  const letter = sheetCol(col);
  return `Lists!$${letter}$2:$${letter}$${count + 1}`;
}

function sheetCol(n) {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function addList(sheet, range, formulae, { error } = {}) {
  sheet.dataValidations.add(range, {
    type: "list",
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: "warning",
    errorTitle: "Use the list",
    error: error || "Pick a value from the dropdown.",
    formulae,
  });
}

const workbook = new ExcelJS.Workbook();
workbook.creator = "SRB Mess Distribution";
workbook.created = new Date();

const lists = workbook.addWorksheet("Lists", { state: "hidden" });
lists.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
lists.getRow(1).fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: GREEN },
};

const listMeta = {};
let col = 1;
function addNamedList(name, header, values) {
  const meta = writeListColumn(lists, col, header, values);
  listMeta[name] = meta;
  workbook.definedNames.add(listRef(col, values.length), name);
  col += 1;
}

addNamedList("MemberTypes", "Member type", MEMBER_TYPES);
addNamedList("SrbRanks", "SRB rank", RANKS);
addNamedList("MainWings", "Wing", WINGS);
addNamedList("AdminSubs", "Sub wing", ADMIN_SUB_WINGS);
addNamedList("HqSubs", "HQ sub wing", HQ_SUB_WINGS);
addNamedList("Forces", "Force", FORCES);
addNamedList("BloodGroups", "Blood group", BLOOD_GROUPS);
addNamedList("Religions", "Religion", RELIGIONS);
addNamedList("Banks", "Bank", MEMBER_BANKS);
addNamedList("Districts", "Branch district", BRANCH_DISTRICTS);
addNamedList("YesNo", "Yes / No", YES_NO);

for (const force of FORCES) {
  addNamedList(forceRangeName(force), force, FORCE_RANKS[force]);
}

lists.columns.forEach((c) => {
  c.width = 20;
});
lists.views = [{ state: "frozen", ySplit: 1 }];

const guide = workbook.addWorksheet("Read me");
guide.getColumn(1).width = 110;
guide.mergeCells("A1:A1");
guide.getCell("A1").value = TITLE;
guide.getCell("A1").font = { bold: true, size: 16, color: { argb: GREEN } };
guide.getCell("A3").value = "Give this file to the client. They fill the Members sheet. You send it back for import.";
guide.getCell("A3").font = { size: 12 };
const notes = [
  "1. Open the Members sheet. Row 4 is the header. Start typing from row 5.",
  "2. Grey columns have dropdowns — click the cell, then the arrow, and pick a value. Do not type a different spelling.",
  "3. Member type must be one of: new / attached / permanent / guest / civilian.",
  "4. Starred columns are required for a normal member: Member type, Personal no, SRB rank, Name, Wing.",
  "5. Wing is the main wing. If Wing = Admin, also pick Sub wing. If Sub wing = HQ Br, also pick HQ sub wing.",
  "6. Force rank dropdown fills after Force is picked (Army → Army ranks, Navy → Navy ranks, and so on).",
  "7. Dates must be YYYY-MM-DD, e.g. 2026-03-15.",
  "8. Phone: Bangladesh number, e.g. 017XXXXXXXX.",
  "9. Guest: Name is enough. Civilian: Personal no is required. Documents verified = Yes/No.",
  "10. Do not rename columns or sheets. Do not add extra header rows.",
  "11. The Lists sheet is the dropdown source. Leave it as-is.",
];
notes.forEach((line, i) => {
  guide.getCell(`A${5 + i}`).value = line;
  guide.getCell(`A${5 + i}`).alignment = { wrapText: true, vertical: "top" };
  guide.getRow(5 + i).height = 18;
});
guide.getCell("A17").value = "Member type meaning";
guide.getCell("A17").font = { bold: true };
guide.getCell("A18").value = "new = New Member · attached = Attached Member · permanent = Permanent Member · guest = Guest · civilian = Civilian";

const members = workbook.addWorksheet("Members");
members.mergeCells("A1:Z1");
members.getCell("A1").value = TITLE;
members.getCell("A1").font = {
  bold: true,
  size: 16,
  color: { argb: "FFFFFFFF" },
};
members.getCell("A1").fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: GREEN },
};
members.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
members.getRow(1).height = 28;

members.mergeCells("A2:Z2");
members.getCell("A2").value =
  "Fill from row 5. Grey columns are dropdowns — pick from the list. Required columns have *.";
members.getCell("A2").font = { italic: true, size: 11, color: { argb: "334155" } };
members.getRow(2).height = 20;

members.getRow(3).height = 8;

const header = members.getRow(4);
header.height = 28;
header.font = { bold: true, color: { argb: "FFFFFFFF" } };
header.alignment = { vertical: "middle", wrapText: true };
COLUMNS.forEach((colDef, i) => {
  const cell = header.getCell(i + 1);
  cell.value = colDef.header;
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: GREEN },
  };
  cell.border = {
    bottom: { style: "thin", color: { argb: "055C44" } },
  };
  members.getColumn(i + 1).width = colDef.width;
});

const dropCols = {
  member_type: "MemberTypes",
  rank: "SrbRanks",
  wing: "MainWings",
  sub_wing: "AdminSubs",
  hq_wing: "HqSubs",
  blood_group: "BloodGroups",
  force: "Forces",
  religion: "Religions",
  bank_name: "Banks",
  branch: "Districts",
  documents_verified: "YesNo",
};

for (let row = FIRST_DATA; row <= LAST_DATA; row += 1) {
  COLUMNS.forEach((colDef, i) => {
    const cell = members.getCell(row, i + 1);
    cell.border = {
      top: { style: "hair", color: { argb: "CBD5E1" } },
      bottom: { style: "hair", color: { argb: "CBD5E1" } },
      left: { style: "hair", color: { argb: "CBD5E1" } },
      right: { style: "hair", color: { argb: "CBD5E1" } },
    };
    if (dropCols[colDef.key] || colDef.key === "force_rank") {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "F1F5F9" },
      };
    }
    if (colDef.key === "joining_date" || colDef.key === "out_date") {
      cell.numFmt = "yyyy-mm-dd";
    }
  });

  const letter = (key) => sheetCol(COLUMNS.findIndex((c) => c.key === key) + 1);

  Object.entries(dropCols).forEach(([key, named]) => {
    const c = letter(key);
    addList(members, `${c}${row}`, [`${named}`]);
  });

  const forceCol = letter("force");
  const forceRankCol = letter("force_rank");
  addList(
    members,
    `${forceRankCol}${row}`,
    [`INDIRECT(SUBSTITUTE(${forceCol}${row}," ","_"))`],
    { error: "Pick a Force first, then pick that force’s rank." },
  );
}

members.views = [{ state: "frozen", ySplit: 4, xSplit: 0 }];
members.autoFilter = {
  from: { row: 4, column: 1 },
  to: { row: LAST_DATA, column: COLUMNS.length },
};

members.getCell("A5").value = "permanent";
members.getCell("B5").value = "EXAMPLE-001";
members.getCell("C5").value = "SRB-0001";
members.getCell("D5").value = "SI";
members.getCell("E5").value = "Example Name — delete this row";
members.getCell("F5").value = "Ops Wg";
members.getCell("K5").value = "Army";
members.getCell("L5").value = "Sgt";

const outDir = path.join(process.cwd(), "docs");
workbook.views = [
  {
    x: 0,
    y: 0,
    width: 25000,
    height: 16000,
    firstSheet: 0,
    activeTab: 2,
    visibility: "visible",
  },
];

await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, "SRB_Member_Data_Collection.xlsx");
await workbook.xlsx.writeFile(outFile);
console.log(outFile);
