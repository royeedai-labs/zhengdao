# BL-20260501 Desktop UX Overhaul

## Trigger

User requested a real implementation path for making every Zhengdao desktop page feel professional and less chaotic, with a method that prevents missing pages instead of relying on a vague promise.

## Confirmed Defaults

- Desktop first.
- Audit + design + implementation.
- Professional product feel over marketing visuals.
- Web only receives minimum supporting changes when desktop flows require it.

## Initial Implementation

- Created `desktop-ux-overhaul-2026q2` lane.
- Added competitive pattern mapping.
- Added generated UX surface ledger script.
- Generated initial `surface-ledger.md` and `surface-ledger.json` from renderer entrypoints.

## Boundaries

- No product UI code changed in this baseline.
- Existing dirty AI/book-creation work was left untouched.
- Database schema, IPC, AI provider routing, sync and release behavior remain unchanged.
