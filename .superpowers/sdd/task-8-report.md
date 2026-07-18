# Task 8 Report

## Final Inventory Fix Wave - 2026-07-16

Scope completed:
- Hardened inventory item create/update numeric validation so invalid, non-finite, or negative `current_qty`, `minimum_qty`, and `estimated_unit_cost` return errors before writes.
- Hardened `saveMenuRecipes` so intentional `[]` clears recipes, while blank inventory ids and non-finite or non-positive quantities reject the whole request before the RPC. Duplicate validation remains.
- Moved recipe persistence into the main `MenuForm` save sequence: save menu, resolve existing or newly-created menu id, save recipes, then navigate only after both succeed. Newly-created menu recipe failures keep the user on the page with `Menu tersimpan tetapi resep gagal: ...` and retry through the main save button uses the persisted menu id instead of creating a duplicate.
- Reworked `RecipeEditor` into controlled rows owned by `MenuForm`; removed the separate recipe save path while preserving empty state, validation, compact controls, accessibility labels, and disabled/submitting state.
- Added blocking Indonesian inventory query error states to new/edit menu pages.
- Prevented no-op inventory adjustments at SQL level with a computed `v_delta = 0` rejection; add/subtract server action and UI now require `> 0`, while set permits `0`.
- Granted `create_order_with_inventory` execute to `service_role`.
- Added focused pure/helper coverage for inventory readiness sorting and manual sort mode.
- Preserved cafe scoping in server actions and SQL RPC calls. No composite cafe triggers or unrelated refactors added.

TDD RED evidence:
- `npm test -- --run tests/dashboard-inventory-actions.test.ts tests/menu-form-save.test.ts tests/menu-page-inventory-errors.test.ts tests/menu-table-inventory.test.ts tests/inventory-dashboard.test.ts tests/database-contract.test.ts`
  - Failed as expected before implementation: invalid inventory values were accepted, invalid recipes were filtered, createMenu did not return id, menu save helper was missing, inventory page errors were not rendered, sort/stock helpers were missing, SQL grant/delta guard missing.
- `npm test -- --run tests/menu-page-inventory-errors.test.ts`
  - After fixing the test harness mock, failed as expected on missing `Inventory belum dapat dimuat` blocking state.

GREEN and verification evidence:
- Focused GREEN: `npm test -- --run tests/dashboard-inventory-actions.test.ts tests/menu-form-save.test.ts tests/menu-page-inventory-errors.test.ts tests/menu-table-inventory.test.ts tests/inventory-dashboard.test.ts tests/database-contract.test.ts`
  - 6 files passed, 40 tests passed.
- Full test suite: `npm test -- --run`
  - 12 files passed, 78 tests passed.
- TypeScript: `npx tsc --noEmit`
  - Passed with exit code 0.
- ESLint on changed TS/TSX files: `npx eslint src/app/dashboard/menu/[id]/edit/page.tsx src/app/dashboard/menu/new/page.tsx src/components/dashboard/MenuForm.tsx src/components/dashboard/MenuTable.tsx src/components/dashboard/RecipeEditor.tsx src/components/dashboard/StockAdjustmentModal.tsx src/lib/dashboard-actions.ts src/lib/menu-form-save.ts tests/dashboard-inventory-actions.test.ts tests/database-contract.test.ts tests/inventory-dashboard.test.ts tests/menu-form-save.test.ts tests/menu-page-inventory-errors.test.ts tests/menu-table-inventory.test.ts`
  - Passed with exit code 0.
  - Note: an earlier lint attempt from the repository root invoked a mismatched transient ESLint 10 and crashed before code linting; rerunning from `App` used the project local ESLint and passed.
- Build: `npm run build`
  - Passed with exit code 0.
  - Existing warning: Next.js reports the `middleware` file convention is deprecated in favor of `proxy`.
- Final full test suite after lint cleanup: `npm test -- --run`
  - 12 files passed, 78 tests passed.
- Whitespace: `git diff --check`
  - Passed with exit code 0. Git emitted LF-to-CRLF working-copy warnings only.
- Browser visual attempt:
  - Existing Next dev server detected at `http://localhost:3000`.
  - In-app browser navigation to `/dashboard/menu/new` redirected to `/login`, so authenticated dashboard desktop/mobile screenshots were blocked by missing browser session auth.
  - Browser tabs were finalized. Server-render tests and production build covered the touched UI states available without browser auth.

Concerns:
- Authenticated visual screenshot verification could not be completed in the in-app browser without a logged-in dashboard session.
- Build still surfaces the pre-existing Next middleware deprecation warning.
