# Catalog classification

Do not move every frontend constant into PostgreSQL. Labels and duty codes are part of the approved UI.

| Value | Class | Storage |
| ----- | ----- | ------- |
| Daily tags (`FR`, `CL`, `MS`, …) | CODE CONSTANT | Frontend `DAILY_TAGS` + backend `DUTY_TAGS` |
| Member status `0`/`1` | SYSTEM ENUM | Column check in application code |
| Approval / tag-request / report status | SYSTEM ENUM | Application code |
| Desk roles `cc`…`admin` | SYSTEM ENUM | `staff.role` + permission rows |
| Ranks, wings, forces, banks | USER-MANAGEABLE MASTER | `catalog_state.payload` JSON |
| Authorized strength | USER-MANAGEABLE MASTER | `authorized_strength` |
| Allowance rates | USER-MANAGEABLE MASTER | `rates` |
| Official senders | USER-MANAGEABLE MASTER | `senders` |

`catalog_state` stays one document because Settings already edits it as one document. Splitting it into lookup tables would force a Settings rewrite.

APIs:

- `GET /api/v1/catalog`
- `PUT /api/v1/catalog` (`settings.manage`)
- Snapshot PUT still accepts catalog keys for desks that may save Settings.
