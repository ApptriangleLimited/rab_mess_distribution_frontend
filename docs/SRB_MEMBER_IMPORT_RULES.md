# SRB member Excel import rules

Agreed 2026-10-04. Do not import until the remaining bank instruction is given.
Source files are in `srb_member_data/` on the workstation. Do not commit those workbooks.

## Do not touch

- `srb_member_data/Master Copy/` — leave the Master Copy workbook, `issue list.xlsx`, and `Membars.docx` as they are. Do not read them into the import.
- Duplicate rows — do not merge, drop, or edit them. Report them only when asked.
  - Personal no `BJO-85034` is on OPS WING rows 159 and 160.
  - Md Showkat Ali, personal no `2206486`, SRB ID `425691`, is in HQ Office, Int Wing, and the Master Copy. The Master Copy copy is ignored with that folder. The HQ Office and Int Wing rows stay as they are.

## Member type

Store the application value in lowercase. Excel `Permanent`, `Permanant`, and `parmanent` all become `permanent`.

| Stored | Shown |
|---|---|
| `new` | New Member |
| `attached` | Attached Member |
| `permanent` | Permanent Member |
| `guest` | Guest |
| `civilian` | Civilian |

## SRB rank and force rank

| Excel SRB rank | Save as |
|---|---|
| `Con`, `con` | SRB rank `Constable` |
| `NK` | SRB rank `Naik` |
| `CPL` | Force rank `Cpl` (shown as Corporal). Not an SRB rank. |
| `SNK`, `Snk` | Force rank `Sainik`. Not an SRB rank. |
| `Lab Asst` | Force rank `LA` (shown as Lab Assistant). Not an SRB rank. |
| `Lcpl`, `LCPL`, `Lnk`, `Nayek`, `SEP`, `Sep`, `MLSS`, `MLSSS`, `AB`, `UDC`, `Lro(G)`, `NC(E)` | Leave the SRB rank empty. Do not guess. |

Force-rank cells use the application’s saved rank, ignoring capital letters. Match the Excel text below to that saved rank:

| Excel force rank | Saved as |
|---|---|
| `Lcpl`, `LCPL`, `lcpl`, `LCpl` | `L/Cpl` (Lance Corporal) |
| `NK`, `Nayek`, `NAYEK SIG`, `Naik Asst` | `Naik` |
| `Con`, `con` | `Constable` |
| `SNK`, `Snk`, `snk` on Police | `Constable` |
| `SNK`, `Snk`, `snk` | `Sainik` |
| `sep`, `Sep`, `SEP`, `Sep (Asst)` | `Sepoy` |
| `Lnk Asst`, `LC/NK`, `LNK`, `Lnk` | `Lance Naik` |
| `AB(TD-2)` | `AB` (Able Seaman) |
| `Hav` | `Havildar` |
| `Inspector (TT)` | `Inspector` |
| `Lab Asst` | `LA` (Lab Assistant) |
| `LS(TD-II)` | `L/Std` (Leading Steward) |
| `MASSINGER` | `Msg` (Messenger) |
| `N/S` on BGB | `Nb Sub` (Naib Subedar) |
| `PO(Writer)` | `PO` |
| `SCPOS` | `SCPO` |
| `NCE`, `NC(E)`, `nce` on Army or BGB | `NCE` |
| `Sub-Inspector` on Police | `SI` |
| `SI` on Army | `SI` (Sub-Inspector) |
| `Cook` on BGB | `CK` |
| `ASI` on Army | `L/Cpl` (Lance Corporal) |
| `UDC` on Civilian | `UDC` |
| `Office Assistant` on Civilian | `Office Assistant` |
| `CEA` on Navy | `CEA`. Army সমমান `SWO`. SRB rank `DAD` |
| `REA-IV`, `REA-Y` on Navy | `REA-IV`. Army সমমান `Sgt`. SRB rank `SI` |
| `LEN`, `LREN`, `LSA` on Navy | same text. Army সমমান `Cpl`. SRB rank `SI` |
| `LRO(G)`, `LRO (G)`, `LROGC` on Navy | `LRO(G)`. Army সমমান `Cpl`. SRB rank `SI` |
| `LNP`, `LPM`, `LNP/LPM` on Navy | `LNP/LPM`. Army সমমান `Cpl`. SRB rank `SI` |
| `SA-I` on Navy | `SA-I`. Army সমমান `L/Cpl`. SRB rank `ASI` |
| `LME` on Navy | `LME` |
| `NP-1` on Navy | `PM-1` |
| `MLSSS` on Civilian | `Office Assistant` |

## Force

Match the application force list ignoring capital letters and spaces.

- `Air` and `Airforce` become `Air Force`.
- `civil` becomes `Civilian`.
- `Army`, `NAVY`, and `police` match `Army`, `Navy`, and `Police`.

## Wing and branch

The application stores a short wing. The screen shows the long name. Save the short value. Section names below are not stored as Br or Sub Br.

| Excel | Saved wing | Shown as | Branch / sub |
|---|---|---|---|
| Legal & Media, L & M Wing | `L & M Wg` | Legal & Media Wing | empty |
| Training & Orientation Wing | `Trg Wg` | Training & Orientation Wing | empty |
| Comm &MIS, Comm & Mis Wg | `Comm & MIS Wg` | Communication & MIS Wing | empty |
| Ops, and Ops sections below | `Ops Wg` | Operations Wing | empty |
| DG Doptor | `Admin` | Admin & Finance Wing | branch `DG Office` |
| Admin, Admin wing | `Admin` | Admin & Finance Wing | see branches |

Ops file, main wing only, no sub-wing: Central Ops, C.ops, Dog Squad, BDU, MT Sec, Planning & Monitoring, Plg, HQ Office.

Legal Media file, main wing `L & M Wg` only, no Br and no Sub Br: Head Clk, Senior DAD, Paper Cutting, CQ, Media Clk, Legal Cell, MT Sec, Media Center, PA, Admin, Accounts, Archive, Admin Clk, IEC, HRC.

TV Monitoring is in the Legal Media workbook and is saved as `Comm & MIS Wg` (Communication & MIS Wing), with Br and Sub Br empty.

Md Akram Hossain, personal no `9515189186`, is in `10. (15) Admin Wing.xlsx` with sub-branch `HQ Mosque`. Do not save that sub-branch. Save wing `Admin` (Admin & Finance Wing) and branch `HQ Br` only. Sub Br stays empty.

Rows that already use a saved short name stay on that name: `Ops Wg`, `Inv Wg`, `R & D Cell`, `Admin`, and the Admin branches that already match.

### Admin branches

Save the application short code, not the longer Excel spelling.

| Excel | Saved | Shown |
|---|---|---|
| Supply Br | `Sup Br` | Supply Branch (সরবরাহ শাখা) |
| Record Br, Record br | `Rec Br` | Record Branch |
| Dev Br file (31 people written as Wing Admin, Br Fin Br, Sub Br Dev Br) | wing `Admin`, branch `Dev Br`, Sub Br empty | Development Branch. Do not store `Fin Br` for these rows. |

The Finance file’s own people stay Wing `Admin`, branch `Fin Br`, Sub Br empty.

## Banks

Ignore capital letters when matching a bank already stored in the database.

- `Trust Bank` matches `Trust bank`.
- `Community Bank` matches `Community bank`.
- Same idea for Sonali Bank.

Leave the bank section empty for the 20 members in `srb_member_data/Bank details still to update.xlsx`, and also for personal no `85026` (Md Sujon Biswas) and `69268` (Md Shahidul Islam). Empty means bank name, account name, account number, routing, branch district, and branch location. Do not add Shimanto, DBBL, Dutch Bangla, UCB, Janata, CBBL, Bangladesh Krisi Bank, or Basic Bank for this import.

A CC user fills those fields later on the member edit screen. For a permanent member the form does not save until that bank section is filled. The bank dropdown lists only banks already saved in the app: Trust bank, Community bank, and Sonali Bank.
