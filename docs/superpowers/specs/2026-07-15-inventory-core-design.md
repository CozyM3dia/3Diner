# 3Diner Inventory Core Design

Date: 2026-07-15
Status: Draft for user review

## Context

The inventory reference video demonstrates Tantri's back-office inventory flow:

- Input initial stock for raw materials.
- Maintain a stock list with quantity, unit, value, and low-stock state.
- Distribute stock between branches with a pending/approved receiving flow.
- Link inventory to cashier products through recipes or gramasi.
- Run production batches that consume raw materials and create finished goods.
- Create purchase/stock-management requests, receive goods, and approve the receipt.

3Diner already has customer ordering, a dashboard order queue, revenue analytics, menu CRUD, scheduling, and server-side order validation. The strongest inventory fit is therefore the part that protects live ordering: raw material stock, per-menu recipes, automatic stock deduction, low-stock visibility, and an auditable stock movement history.

## Recommended Scope

Build **Inventory Core + Recipe + Auto Deduct Stock** as the first inventory release.

This release adds operational value without turning 3Diner into a full POS/ERP. It is designed so later releases can add purchasing, supplier receiving, stock transfers, and production without replacing the core data model.

## Goals

- Let cafe owners manage raw ingredients or simple stock items from the dashboard.
- Let cafe owners define which ingredients each menu item consumes.
- Prevent orders when required ingredient stock is insufficient.
- Deduct ingredient stock automatically when an order is created.
- Show low-stock and out-of-stock status in the dashboard.
- Keep a stock movement ledger for manual adjustments and order deductions.
- Keep all mutations scoped to the authenticated owner's cafe.

## Non-Goals For V1

- Multi-branch stock transfers and approval.
- Supplier purchase orders and receiving.
- Production batches that convert ingredients into finished goods.
- Expiry date / batch lot tracking.
- Offline inventory sync.
- Real-time kitchen-side stock adjustment.
- Automatic menu hiding based on ingredient stock.

These are valuable later, but they would make the first release too large for the current 3Diner dashboard.

## User Experience

### Dashboard Navigation

Add a new sidebar item:

- Label: `Inventory`
- Route: `/dashboard/inventory`
- Purpose: stock overview, item management, and movement history.

The dashboard should retain the existing dark operational style used by orders, revenue, menu, and scheduler pages.

### Inventory Page

The inventory page has three primary areas:

1. **Summary strip**
   - Total stock items.
   - Low-stock item count.
   - Out-of-stock item count.
   - Estimated stock value.

2. **Stock table**
   - Item name.
   - Current stock.
   - Unit.
   - Minimum stock threshold.
   - Estimated unit cost.
   - Status: `Aman`, `Menipis`, `Habis`.
   - Actions: edit item, adjust stock.

3. **Recent movements**
   - Recent manual adjustments and order deductions.
   - Shows movement type, quantity change, related item/order, note, and timestamp.

### Inventory Item Form

Owners can create and edit stock items with:

- Name, for example `Sirup Lemon`.
- Unit from the fixed V1 list: `gram`, `kg`, `ml`, `liter`, `pcs`, `pack`, `botol`.
- Current quantity.
- Minimum quantity.
- Estimated unit cost.
- Optional notes.

Validation:

- Name is required.
- Unit is required.
- Current quantity cannot be negative.
- Minimum quantity cannot be negative.
- Estimated unit cost cannot be negative.

### Stock Adjustment Flow

Owners can adjust stock manually from the stock table.

Fields:

- Adjustment type: add, subtract, set exact quantity.
- Quantity.
- Note.

Examples:

- `Tambah 5000 ml karena belanja stok baru`.
- `Kurangi 300 gram karena rusak`.
- `Set ke 1200 gram setelah stock opname`.

Each adjustment writes an inventory movement ledger row.

### Recipe Editing In Menu Form

Each menu item can define a recipe in the dashboard menu form.

For each recipe row:

- Inventory item.
- Quantity used per menu item.
- Unit display inherited from the inventory item.

Example:

- `Fruit Tea Lemon`
  - `Sirup Lemon`, `200 ml`
- `Pasta Meatball`
  - `Pasta`, `120 gram`
  - `Daging Sapi`, `150 gram`

Recipe rows are optional. Menus without recipe rows do not affect stock.

### Menu Table Indicator

The menu dashboard table should show a small inventory indicator:

- `Resep aktif` if the menu has recipe rows.
- `Tanpa resep` if not.
- `Stok kurang` if current ingredient stock cannot fulfill at least one serving.

This helps owners find menu items that need recipe setup.

## Order Flow

When a customer creates an order through `/api/orders`:

1. The server loads the canonical menu rows, as it already does today.
2. The server loads recipe rows for all ordered menu IDs.
3. For each inventory item, the server aggregates required quantity:
   - `required = sum(recipe.quantity_per_item * ordered_qty)`.
4. The server checks current stock for each required inventory item.
5. If any item is insufficient, the server returns HTTP 409 with a customer-safe message:
   - `Stok beberapa menu sedang tidak cukup. Silakan kurangi jumlah atau pilih menu lain.`
6. If stock is sufficient:
   - Create the order.
   - Deduct stock.
   - Insert movement rows with type `order_deduction`.
7. The whole operation must be transactional at database level to avoid two simultaneous orders overselling the same ingredient.

The customer cart UI can initially reuse the existing alert behavior for failed order creation. A later polish can display which menu is unavailable directly in the cart.

## Data Model

### `Inventory_Items`

Stores stockable items per cafe.

Columns:

- `id_inventory_item uuid primary key default gen_random_uuid()`
- `cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade`
- `name text not null`
- `unit text not null check (unit in ('gram', 'kg', 'ml', 'liter', 'pcs', 'pack', 'botol'))`
- `current_qty numeric(12,3) not null default 0`
- `minimum_qty numeric(12,3) not null default 0`
- `estimated_unit_cost integer not null default 0`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `current_qty >= 0`
- `minimum_qty >= 0`
- `estimated_unit_cost >= 0`
- Unique inventory item name per cafe using a unique index on `(cafe_id, lower(name))`.

Indexes:

- `(cafe_id, name)`
- `(cafe_id, current_qty)`

### `Menu_Recipes`

Links menu items to inventory usage.

Columns:

- `id_menu_recipe uuid primary key default gen_random_uuid()`
- `cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade`
- `menu_id uuid not null references public."Menus"(id_menu) on delete cascade`
- `inventory_item_id uuid not null references public."Inventory_Items"(id_inventory_item) on delete restrict`
- `qty_per_menu numeric(12,3) not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `qty_per_menu > 0`
- Unique `(menu_id, inventory_item_id)`.

Indexes:

- `(cafe_id, menu_id)`
- `(cafe_id, inventory_item_id)`

### `Inventory_Movements`

Append-only ledger for stock changes.

Columns:

- `id_inventory_movement uuid primary key default gen_random_uuid()`
- `cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade`
- `inventory_item_id uuid not null references public."Inventory_Items"(id_inventory_item) on delete restrict`
- `movement_type text not null`
- `delta_qty numeric(12,3) not null`
- `qty_before numeric(12,3) not null`
- `qty_after numeric(12,3) not null`
- `unit text not null`
- `unit_cost integer null`
- `reference_type text null`
- `reference_id uuid null`
- `note text null`
- `created_at timestamptz not null default now()`

Movement types for V1:

- `manual_add`
- `manual_subtract`
- `manual_set`
- `order_deduction`

Indexes:

- `(cafe_id, created_at desc)`
- `(cafe_id, inventory_item_id, created_at desc)`
- `(reference_type, reference_id)`

## Transaction Strategy

Supabase JavaScript cannot safely perform multi-row order creation, stock checks, deductions, and movement inserts as one atomic operation using separate client calls. V1 should add a Postgres RPC function, for example:

`create_order_with_inventory(p_cafe_id uuid, p_table_number text, p_items jsonb, p_notes text)`

Responsibilities:

- Validate requested items belong to the cafe and are active.
- Calculate canonical item prices and discounts.
- Load menu recipes.
- Lock required `Inventory_Items` rows with `FOR UPDATE`.
- Reject if stock is insufficient.
- Insert into `Orders`.
- Update `Inventory_Items.current_qty`.
- Insert `Inventory_Movements`.
- Return order row plus customer token.

This preserves the existing security property: browser-submitted totals and prices are ignored.

If a menu has no recipe rows, it is treated as non-stock-tracked and can be ordered normally.

## Server-Side Changes

### Types

Add TypeScript types:

- `InventoryItem`
- `MenuRecipe`
- `InventoryMovement`
- `InventoryStatus`

### Dashboard Actions

Add server actions for:

- Create/update inventory item.
- Delete inventory item only when it has no recipe references and no movement history, or soft-block deletion with a clear message.
- Adjust stock.
- Save menu recipes for a menu.

All actions use `getAuthCafeId()` and scope every query by cafe.

### Order API

Update `/api/orders` to call the database RPC instead of directly inserting orders.

Expected errors:

- `400` invalid request payload.
- `409` insufficient inventory.
- `502` database/RPC failure.

## UI Components

New files likely needed:

- `src/app/dashboard/inventory/page.tsx`
- `src/components/dashboard/InventoryTable.tsx`
- `src/components/dashboard/InventoryItemForm.tsx`
- `src/components/dashboard/StockAdjustmentModal.tsx`
- `src/components/dashboard/RecipeEditor.tsx`
- `src/lib/inventory.ts`

Modified files likely needed:

- `src/components/dashboard/DashboardShell.tsx`
- `src/components/dashboard/MenuForm.tsx`
- `src/app/dashboard/menu/new/page.tsx`
- `src/app/dashboard/menu/[id]/edit/page.tsx`
- `src/app/api/orders/route.ts`
- `src/types/index.ts`

Migration:

- `migrations/2026-07-15_inventory_core.sql`

Tests:

- Unit tests for inventory calculation helpers.
- API tests for successful order deduction.
- API tests for insufficient stock rejection.
- API tests confirming menu without recipe still orders normally.

## Error Handling

Dashboard:

- Show inline form errors for invalid quantities.
- Show action-level error banners when inventory item deletion is blocked.
- Show confirmation for stock adjustments and recipes.

Customer order:

- If insufficient stock, show the existing alert with a friendly message.
- Mention unavailable menu names when possible, but never expose raw ingredient names to customers.

Data integrity:

- Reject negative inventory quantities.
- Reject recipe quantities <= 0.
- Reject stock deductions that would make `current_qty < 0`.
- Use database locks in the RPC to prevent race-condition overselling.

## Status Rules

Inventory item status:

- `Habis`: `current_qty <= 0`
- `Menipis`: `current_qty > 0` and `current_qty <= minimum_qty`
- `Aman`: `current_qty > minimum_qty`

Menu stock readiness:

- `Tanpa resep`: no recipe rows.
- `Tersedia`: all recipe ingredients can satisfy at least one serving.
- `Stok kurang`: at least one recipe ingredient cannot satisfy one serving.

## Future Extensions

The V1 model supports later additions:

- `Inventory_Transfers` for branch-to-branch distribution.
- `Inventory_Purchase_Orders` for supplier purchasing.
- `Inventory_Receipts` for receiving purchased stock.
- `Production_Batches` for converting raw materials into finished goods.
- Expiry dates and batch lots by adding stock lots beneath `Inventory_Items`.
- Auto-hide customer menu when stock cannot fulfill one serving.

## Product Decisions For V1

- Units use a fixed list: `gram`, `kg`, `ml`, `liter`, `pcs`, `pack`, `botol`.
- Customer insufficient-stock errors may mention unavailable menu names, but not raw ingredient names.
- Stock deducts at order creation because 3Diner currently has no order cancellation flow. If cancellation is added later, the movement ledger can support reversal rows.

## Acceptance Criteria

- Owner can create, edit, and view inventory items.
- Owner can manually adjust stock and see ledger rows.
- Owner can assign recipe rows to a menu.
- Creating an order with sufficient stock deducts inventory and creates movement rows.
- Creating an order with insufficient stock returns a friendly failure and does not create an order.
- Existing menus without recipes still work as they do today.
- Dashboard inventory page shows correct low-stock and out-of-stock status.
- Tests cover stock calculation, successful deduction, insufficient-stock rejection, and recipe-less menus.
