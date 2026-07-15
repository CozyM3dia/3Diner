# Inventory Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3Diner inventory core: stock items, menu recipes, automatic stock deduction on customer orders, low-stock dashboard visibility, and stock movement history.

**Architecture:** Inventory lives in three new Supabase tables plus one transactional Postgres RPC. Dashboard server actions manage stock items, adjustments, and recipes; `/api/orders` calls the RPC so order creation and stock deduction happen atomically.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Admin client, Postgres SQL/RPC, Vitest.

## Global Constraints

- Do not implement branch transfer, supplier purchase order, receiving, production batch, expiry lot tracking, offline sync, or automatic menu hiding in V1.
- Unit list is fixed to `gram`, `kg`, `ml`, `liter`, `pcs`, `pack`, `botol`.
- Customer insufficient-stock errors may mention unavailable menu names, but must not expose raw ingredient names.
- Stock deducts at order creation because 3Diner currently has no cancellation flow.
- Existing menus without recipes must continue ordering normally.
- Every dashboard mutation must scope by the authenticated owner's cafe via `getAuthCafeId()`.
- Order totals and item prices must remain canonical from database rows, never from browser-submitted totals.
- Run `npm install` in `C:\Kerja\3Diner\App` before test execution if `node_modules/.bin/vitest` is missing.

---

## File Structure

Create:

- `App/migrations/2026-07-15_inventory_core.sql`  
  Database schema, indexes, constraints, and `create_order_with_inventory` RPC.

- `App/src/lib/inventory.ts`  
  Pure helper functions and shared inventory constants.

- `App/src/app/dashboard/inventory/page.tsx`  
  Server page that loads inventory summary, rows, and recent movements.

- `App/src/components/dashboard/InventoryTable.tsx`  
  Client table for inventory rows, edit modal opening, and stock adjustment modal opening.

- `App/src/components/dashboard/InventoryItemForm.tsx`  
  Client form used for create/edit inventory item.

- `App/src/components/dashboard/StockAdjustmentModal.tsx`  
  Client modal for add/subtract/set stock adjustment.

- `App/src/components/dashboard/RecipeEditor.tsx`  
  Client editor embedded in `MenuForm`.

- `App/tests/inventory.test.ts`  
  Unit tests for helper functions.

- `App/tests/orders-inventory-route.test.ts`  
  API route tests for RPC success and insufficient stock.

Modify:

- `App/src/types/index.ts`  
  Add inventory-related TypeScript interfaces.

- `App/src/lib/dashboard-actions.ts`  
  Add inventory item CRUD, stock adjustment, and recipe save actions.

- `App/src/components/dashboard/DashboardShell.tsx`  
  Add `Inventory` sidebar nav item.

- `App/src/components/dashboard/MenuForm.tsx`  
  Add optional recipe editor section and submit recipe rows after menu save.

- `App/src/components/dashboard/MenuTable.tsx`  
  Add menu inventory readiness indicator.

- `App/src/app/dashboard/menu/page.tsx`  
  Load recipe counts and readiness data for menu table.

- `App/src/app/dashboard/menu/new/page.tsx`  
  Load inventory items for recipe editor.

- `App/src/app/dashboard/menu/[id]/edit/page.tsx`  
  Load inventory items and current menu recipe rows for recipe editor.

- `App/src/app/api/orders/route.ts`  
  Replace direct order insert with RPC call.

- `App/tests/orders-route.test.ts`  
  Update existing test expectations to match RPC-based order creation.

---

### Task 1: Database Schema And Atomic Order RPC

**Files:**
- Create: `App/migrations/2026-07-15_inventory_core.sql`

**Interfaces:**
- Produces table `Inventory_Items`.
- Produces table `Menu_Recipes`.
- Produces table `Inventory_Movements`.
- Produces RPC `public.create_order_with_inventory(p_cafe_id uuid, p_table_number text, p_items jsonb, p_notes text)` returning JSON with `order`, `orderToken`, and optional `unavailableMenus`.

- [ ] **Step 1: Add migration file**

Create `App/migrations/2026-07-15_inventory_core.sql` with this SQL:

```sql
begin;

create table if not exists public."Inventory_Items" (
  id_inventory_item uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  name text not null,
  unit text not null check (unit in ('gram', 'kg', 'ml', 'liter', 'pcs', 'pack', 'botol')),
  current_qty numeric(12,3) not null default 0 check (current_qty >= 0),
  minimum_qty numeric(12,3) not null default 0 check (minimum_qty >= 0),
  estimated_unit_cost integer not null default 0 check (estimated_unit_cost >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists "Inventory_Items_cafe_lower_name_key"
  on public."Inventory_Items" (cafe_id, lower(name));

create index if not exists "Inventory_Items_cafe_name_idx"
  on public."Inventory_Items" (cafe_id, name);

create index if not exists "Inventory_Items_cafe_qty_idx"
  on public."Inventory_Items" (cafe_id, current_qty);

create table if not exists public."Menu_Recipes" (
  id_menu_recipe uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  menu_id uuid not null references public."Menus"(id_menu) on delete cascade,
  inventory_item_id uuid not null references public."Inventory_Items"(id_inventory_item) on delete restrict,
  qty_per_menu numeric(12,3) not null check (qty_per_menu > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_id, inventory_item_id)
);

create index if not exists "Menu_Recipes_cafe_menu_idx"
  on public."Menu_Recipes" (cafe_id, menu_id);

create index if not exists "Menu_Recipes_cafe_item_idx"
  on public."Menu_Recipes" (cafe_id, inventory_item_id);

create table if not exists public."Inventory_Movements" (
  id_inventory_movement uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  inventory_item_id uuid not null references public."Inventory_Items"(id_inventory_item) on delete restrict,
  movement_type text not null check (movement_type in ('manual_add', 'manual_subtract', 'manual_set', 'order_deduction')),
  delta_qty numeric(12,3) not null,
  qty_before numeric(12,3) not null check (qty_before >= 0),
  qty_after numeric(12,3) not null check (qty_after >= 0),
  unit text not null,
  unit_cost integer,
  reference_type text,
  reference_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists "Inventory_Movements_cafe_created_idx"
  on public."Inventory_Movements" (cafe_id, created_at desc);

create index if not exists "Inventory_Movements_cafe_item_created_idx"
  on public."Inventory_Movements" (cafe_id, inventory_item_id, created_at desc);

create index if not exists "Inventory_Movements_reference_idx"
  on public."Inventory_Movements" (reference_type, reference_id);

create or replace function public.create_order_with_inventory(
  p_cafe_id uuid,
  p_table_number text,
  p_items jsonb,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_customer_token uuid := gen_random_uuid();
  v_total integer := 0;
  v_order_items jsonb;
  v_unavailable text[];
  v_now timestamptz := now();
begin
  if p_cafe_id is null or nullif(trim(p_table_number), '') is null then
    raise exception 'invalid_order_request' using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  create temporary table tmp_requested_items (
    id_menu uuid not null,
    qty integer not null
  ) on commit drop;

  insert into tmp_requested_items (id_menu, qty)
  select
    (item->>'id_menu')::uuid,
    (item->>'qty')::integer
  from jsonb_array_elements(p_items) as item
  where (item->>'id_menu') is not null
    and (item->>'qty') is not null;

  if exists (select 1 from tmp_requested_items where qty < 1 or qty > 50) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  if (select count(*) from tmp_requested_items) <> jsonb_array_length(p_items) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  create temporary table tmp_canonical_items on commit drop as
  select
    m.id_menu,
    m.nama_menu,
    round(m.harga_menu * (1 - least(greatest(coalesce(m.discount_pct, 0), 0), 100) / 100.0))::integer as harga_menu,
    r.qty
  from tmp_requested_items r
  join public."Menus" m
    on m.id_menu = r.id_menu
   and m.cafe_id = p_cafe_id
   and coalesce(m.is_active, true) = true;

  if (select count(*) from tmp_canonical_items) <> (select count(*) from tmp_requested_items) then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  create temporary table tmp_required_inventory on commit drop as
  select
    mr.inventory_item_id,
    sum(mr.qty_per_menu * ci.qty)::numeric(12,3) as required_qty
  from tmp_canonical_items ci
  join public."Menu_Recipes" mr
    on mr.menu_id = ci.id_menu
   and mr.cafe_id = p_cafe_id
  group by mr.inventory_item_id;

  perform 1
  from public."Inventory_Items" ii
  join tmp_required_inventory req on req.inventory_item_id = ii.id_inventory_item
  where ii.cafe_id = p_cafe_id
  for update of ii;

  select array_agg(distinct ci.nama_menu)
    into v_unavailable
  from tmp_canonical_items ci
  join public."Menu_Recipes" mr
    on mr.menu_id = ci.id_menu
   and mr.cafe_id = p_cafe_id
  join public."Inventory_Items" ii
    on ii.id_inventory_item = mr.inventory_item_id
   and ii.cafe_id = p_cafe_id
  join tmp_required_inventory req
    on req.inventory_item_id = ii.id_inventory_item
  where ii.current_qty < req.required_qty;

  if coalesce(array_length(v_unavailable, 1), 0) > 0 then
    return jsonb_build_object(
      'error', 'insufficient_inventory',
      'unavailableMenus', to_jsonb(v_unavailable)
    );
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id_menu', id_menu,
      'nama_menu', nama_menu,
      'harga_menu', harga_menu,
      'qty', qty
    )
  )
    into v_order_items
  from tmp_canonical_items;

  select coalesce(sum(harga_menu * qty), 0)::integer
    into v_total
  from tmp_canonical_items;

  insert into public."Orders" (
    id_order,
    cafe_id,
    table_number,
    items,
    total,
    status,
    payment_method,
    payment_status,
    notes,
    customer_token,
    created_at
  ) values (
    v_order_id,
    p_cafe_id,
    left(trim(p_table_number), 30),
    v_order_items,
    v_total,
    'received',
    null,
    'unpaid',
    nullif(left(coalesce(trim(p_notes), ''), 500), ''),
    v_customer_token,
    v_now
  );

  insert into public."Inventory_Movements" (
    cafe_id,
    inventory_item_id,
    movement_type,
    delta_qty,
    qty_before,
    qty_after,
    unit,
    unit_cost,
    reference_type,
    reference_id,
    note,
    created_at
  )
  select
    ii.cafe_id,
    ii.id_inventory_item,
    'order_deduction',
    -req.required_qty,
    ii.current_qty,
    ii.current_qty - req.required_qty,
    ii.unit,
    ii.estimated_unit_cost,
    'order',
    v_order_id,
    'Dipakai untuk pesanan #' || right(v_order_id::text, 8),
    v_now
  from public."Inventory_Items" ii
  join tmp_required_inventory req on req.inventory_item_id = ii.id_inventory_item
  where ii.cafe_id = p_cafe_id
    and req.required_qty > 0;

  update public."Inventory_Items" ii
  set current_qty = ii.current_qty - req.required_qty,
      updated_at = v_now
  from tmp_required_inventory req
  where ii.id_inventory_item = req.inventory_item_id
    and ii.cafe_id = p_cafe_id
    and req.required_qty > 0;

  return jsonb_build_object(
    'order',
    jsonb_build_object(
      'id_order', v_order_id,
      'cafe_id', p_cafe_id,
      'table_number', left(trim(p_table_number), 30),
      'items', v_order_items,
      'total', v_total,
      'status', 'received',
      'payment_method', null,
      'payment_status', 'unpaid',
      'notes', nullif(left(coalesce(trim(p_notes), ''), 500), ''),
      'customer_token', v_customer_token,
      'created_at', v_now
    ),
    'orderToken', v_customer_token
  );
end;
$$;

commit;
```

- [ ] **Step 2: Verify migration syntax locally if a database shell is available**

Run this against the Supabase database used by the project:

```bash
psql "$SUPABASE_DB_URL" -f App/migrations/2026-07-15_inventory_core.sql
```

Expected: `COMMIT` with no SQL errors.

- [ ] **Step 3: Commit database migration**

```bash
git add App/migrations/2026-07-15_inventory_core.sql
git commit -m "feat: add inventory database schema"
```

---

### Task 2: Inventory Types And Pure Helpers

**Files:**
- Modify: `App/src/types/index.ts`
- Create: `App/src/lib/inventory.ts`
- Create: `App/tests/inventory.test.ts`

**Interfaces:**
- Produces `INVENTORY_UNITS`.
- Produces `inventoryStatus(item)`.
- Produces `formatQty(value, unit)`.
- Produces `requiredInventoryForOrder(recipes, items)`.
- Produces inventory TypeScript interfaces consumed by dashboard actions and UI.

- [ ] **Step 1: Add failing helper tests**

Create `App/tests/inventory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatQty,
  inventoryStatus,
  requiredInventoryForOrder,
} from "../src/lib/inventory";

describe("inventoryStatus", () => {
  it("classifies empty, low, and safe stock", () => {
    expect(inventoryStatus({ current_qty: 0, minimum_qty: 5 })).toBe("empty");
    expect(inventoryStatus({ current_qty: 3, minimum_qty: 5 })).toBe("low");
    expect(inventoryStatus({ current_qty: 6, minimum_qty: 5 })).toBe("safe");
  });
});

describe("formatQty", () => {
  it("formats integer and decimal quantities without noisy trailing zeros", () => {
    expect(formatQty(200, "ml")).toBe("200 ml");
    expect(formatQty(1.5, "kg")).toBe("1.5 kg");
    expect(formatQty(2.25, "liter")).toBe("2.25 liter");
  });
});

describe("requiredInventoryForOrder", () => {
  it("aggregates repeated recipe usage across multiple menu items", () => {
    const required = requiredInventoryForOrder(
      [
        { menu_id: "menu-1", inventory_item_id: "sirup", qty_per_menu: 200 },
        { menu_id: "menu-2", inventory_item_id: "sirup", qty_per_menu: 50 },
        { menu_id: "menu-2", inventory_item_id: "gula", qty_per_menu: 10 },
      ],
      [
        { id_menu: "menu-1", qty: 2 },
        { id_menu: "menu-2", qty: 3 },
      ]
    );

    expect(required).toEqual([
      { inventory_item_id: "sirup", required_qty: 550 },
      { inventory_item_id: "gula", required_qty: 30 },
    ]);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- --run tests/inventory.test.ts
```

Expected: FAIL because `src/lib/inventory.ts` does not exist.

- [ ] **Step 3: Add inventory types**

Modify `App/src/types/index.ts` by appending:

```ts
export const INVENTORY_UNITS = ["gram", "kg", "ml", "liter", "pcs", "pack", "botol"] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];
export type InventoryStatus = "safe" | "low" | "empty";

export interface InventoryItem {
  id_inventory_item: string;
  cafe_id: string;
  name: string;
  unit: InventoryUnit;
  current_qty: number;
  minimum_qty: number;
  estimated_unit_cost: number;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MenuRecipe {
  id_menu_recipe: string;
  cafe_id: string;
  menu_id: string;
  inventory_item_id: string;
  qty_per_menu: number;
  created_at: string;
  updated_at?: string;
  inventory_item?: InventoryItem;
}

export type InventoryMovementType =
  | "manual_add"
  | "manual_subtract"
  | "manual_set"
  | "order_deduction";

export interface InventoryMovement {
  id_inventory_movement: string;
  cafe_id: string;
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  delta_qty: number;
  qty_before: number;
  qty_after: number;
  unit: InventoryUnit;
  unit_cost?: number | null;
  reference_type?: string | null;
  reference_id?: string | null;
  note?: string | null;
  created_at: string;
  inventory_item?: Pick<InventoryItem, "name" | "unit">;
}
```

- [ ] **Step 4: Add helper implementation**

Create `App/src/lib/inventory.ts`:

```ts
import { INVENTORY_UNITS, type InventoryStatus, type InventoryUnit } from "@/types";

export { INVENTORY_UNITS };

export interface InventoryStatusInput {
  current_qty: number;
  minimum_qty: number;
}

export interface RecipeRequirementInput {
  menu_id: string;
  inventory_item_id: string;
  qty_per_menu: number;
}

export interface RequestedMenuQty {
  id_menu: string;
  qty: number;
}

export interface RequiredInventory {
  inventory_item_id: string;
  required_qty: number;
}

export function isInventoryUnit(value: unknown): value is InventoryUnit {
  return typeof value === "string" && (INVENTORY_UNITS as readonly string[]).includes(value);
}

export function inventoryStatus(item: InventoryStatusInput): InventoryStatus {
  if (item.current_qty <= 0) return "empty";
  if (item.current_qty <= item.minimum_qty) return "low";
  return "safe";
}

export function formatQty(value: number, unit: InventoryUnit | string): string {
  const formatted = Number(value).toLocaleString("id-ID", {
    maximumFractionDigits: 3,
  });
  return `${formatted} ${unit}`;
}

export function requiredInventoryForOrder(
  recipes: RecipeRequirementInput[],
  items: RequestedMenuQty[]
): RequiredInventory[] {
  const qtyByMenu = new Map(items.map((item) => [item.id_menu, item.qty]));
  const required = new Map<string, number>();

  for (const recipe of recipes) {
    const orderedQty = qtyByMenu.get(recipe.menu_id) ?? 0;
    if (orderedQty <= 0) continue;
    required.set(
      recipe.inventory_item_id,
      (required.get(recipe.inventory_item_id) ?? 0) + recipe.qty_per_menu * orderedQty
    );
  }

  return [...required.entries()]
    .map(([inventory_item_id, required_qty]) => ({ inventory_item_id, required_qty }))
    .sort((a, b) => a.inventory_item_id.localeCompare(b.inventory_item_id));
}
```

- [ ] **Step 5: Run helper tests**

Run:

```bash
npm test -- --run tests/inventory.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit helpers**

```bash
git add App/src/types/index.ts App/src/lib/inventory.ts App/tests/inventory.test.ts
git commit -m "feat: add inventory helpers"
```

---

### Task 3: Dashboard Server Actions For Inventory

**Files:**
- Modify: `App/src/lib/dashboard-actions.ts`

**Interfaces:**
- Produces `createInventoryItem(fd: FormData): Promise<ActionResult>`.
- Produces `updateInventoryItem(id: string, fd: FormData): Promise<ActionResult>`.
- Produces `adjustInventoryStock(id: string, fd: FormData): Promise<ActionResult>`.
- Produces `saveMenuRecipes(menuId: string, rows: RecipeDraftInput[]): Promise<ActionResult>`.

- [ ] **Step 1: Add action interfaces and parsing helpers**

Add near the existing `ActionResult` export:

```ts
export interface RecipeDraftInput {
  inventory_item_id: string;
  qty_per_menu: number;
}

const INVENTORY_UNIT_VALUES = ["gram", "kg", "ml", "liter", "pcs", "pack", "botol"];

function cleanInventoryUnit(value: FormDataEntryValue | null): string {
  const unit = String(value ?? "").trim();
  return INVENTORY_UNIT_VALUES.includes(unit) ? unit : "";
}

function nonnegativeNumber(fd: FormData, key: string): number | null {
  const value = num(fd, key);
  if (value === null || value < 0) return null;
  return value;
}
```

- [ ] **Step 2: Add inventory item create action**

Append after the cafe settings/actions section:

```ts
function inventoryPayload(fd: FormData) {
  return {
    name: str(fd, "name") ?? "",
    unit: cleanInventoryUnit(fd.get("unit")),
    current_qty: nonnegativeNumber(fd, "current_qty") ?? 0,
    minimum_qty: nonnegativeNumber(fd, "minimum_qty") ?? 0,
    estimated_unit_cost: Math.round(nonnegativeNumber(fd, "estimated_unit_cost") ?? 0),
    notes: str(fd, "notes"),
  };
}

export async function createInventoryItem(fd: FormData): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const payload = inventoryPayload(fd);
  if (!payload.name) return { error: "Nama bahan wajib diisi." };
  if (!payload.unit) return { error: "Satuan bahan tidak valid." };

  const { error } = await supabaseAdmin
    .from("Inventory_Items")
    .insert([{ cafe_id: cafeId, ...payload }]);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/menu");
  return {};
}
```

- [ ] **Step 3: Add inventory item update action**

Append:

```ts
export async function updateInventoryItem(id: string, fd: FormData): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };
  const payload = inventoryPayload(fd);
  if (!payload.name) return { error: "Nama bahan wajib diisi." };
  if (!payload.unit) return { error: "Satuan bahan tidak valid." };

  const { error } = await supabaseAdmin
    .from("Inventory_Items")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id_inventory_item", id)
    .eq("cafe_id", cafeId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/menu");
  return {};
}
```

- [ ] **Step 4: Add stock adjustment action**

Append:

```ts
export async function adjustInventoryStock(id: string, fd: FormData): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };

  const mode = str(fd, "mode");
  const rawQty = nonnegativeNumber(fd, "quantity");
  const note = str(fd, "note");
  if (!["add", "subtract", "set"].includes(mode ?? "")) return { error: "Jenis penyesuaian tidak valid." };
  if (rawQty === null) return { error: "Jumlah penyesuaian tidak valid." };

  const { data: item, error: loadError } = await supabaseAdmin
    .from("Inventory_Items")
    .select("id_inventory_item,current_qty,unit,estimated_unit_cost")
    .eq("id_inventory_item", id)
    .eq("cafe_id", cafeId)
    .single();
  if (loadError || !item) return { error: "Bahan tidak ditemukan." };

  const before = Number(item.current_qty) || 0;
  const after =
    mode === "add" ? before + rawQty :
    mode === "subtract" ? before - rawQty :
    rawQty;

  if (after < 0) return { error: "Stok tidak boleh kurang dari 0." };

  const movementType =
    mode === "add" ? "manual_add" :
    mode === "subtract" ? "manual_subtract" :
    "manual_set";

  const { error: updateError } = await supabaseAdmin
    .from("Inventory_Items")
    .update({ current_qty: after, updated_at: new Date().toISOString() })
    .eq("id_inventory_item", id)
    .eq("cafe_id", cafeId);
  if (updateError) return { error: updateError.message };

  const { error: movementError } = await supabaseAdmin.from("Inventory_Movements").insert([{
    cafe_id: cafeId,
    inventory_item_id: id,
    movement_type: movementType,
    delta_qty: after - before,
    qty_before: before,
    qty_after: after,
    unit: item.unit,
    unit_cost: item.estimated_unit_cost,
    reference_type: "manual",
    note,
  }]);
  if (movementError) return { error: movementError.message };

  revalidatePath("/dashboard/inventory");
  return {};
}
```

- [ ] **Step 5: Add recipe save action**

Append:

```ts
export async function saveMenuRecipes(menuId: string, rows: RecipeDraftInput[]): Promise<ActionResult> {
  const cafeId = await getAuthCafeId();
  if (!cafeId) return { error: "Sesi tidak valid. Masuk ulang." };

  const cleanRows = rows
    .map((row) => ({
      cafe_id: cafeId,
      menu_id: menuId,
      inventory_item_id: String(row.inventory_item_id ?? "").trim(),
      qty_per_menu: Number(row.qty_per_menu),
    }))
    .filter((row) => row.inventory_item_id && Number.isFinite(row.qty_per_menu) && row.qty_per_menu > 0);

  const ids = new Set<string>();
  for (const row of cleanRows) {
    if (ids.has(row.inventory_item_id)) return { error: "Satu bahan tidak boleh muncul dua kali di resep yang sama." };
    ids.add(row.inventory_item_id);
  }

  const { data: menu } = await supabaseAdmin
    .from("Menus")
    .select("id_menu")
    .eq("id_menu", menuId)
    .eq("cafe_id", cafeId)
    .single();
  if (!menu) return { error: "Menu tidak ditemukan." };

  const { error: deleteError } = await supabaseAdmin
    .from("Menu_Recipes")
    .delete()
    .eq("menu_id", menuId)
    .eq("cafe_id", cafeId);
  if (deleteError) return { error: deleteError.message };

  if (cleanRows.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("Menu_Recipes").insert(cleanRows);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/dashboard/menu");
  revalidatePath(`/dashboard/menu/${menuId}/edit`);
  return {};
}
```

- [ ] **Step 6: Run TypeScript check**

Run:

```bash
npm run lint
```

Expected: PASS or only pre-existing lint issues unrelated to this task.

- [ ] **Step 7: Commit actions**

```bash
git add App/src/lib/dashboard-actions.ts
git commit -m "feat: add inventory dashboard actions"
```

---

### Task 4: Inventory Dashboard Page

**Files:**
- Create: `App/src/app/dashboard/inventory/page.tsx`
- Create: `App/src/components/dashboard/InventoryTable.tsx`
- Create: `App/src/components/dashboard/InventoryItemForm.tsx`
- Create: `App/src/components/dashboard/StockAdjustmentModal.tsx`
- Modify: `App/src/components/dashboard/DashboardShell.tsx`

**Interfaces:**
- Consumes `createInventoryItem`, `updateInventoryItem`, `adjustInventoryStock`.
- Consumes `InventoryItem` and `InventoryMovement`.
- Produces `/dashboard/inventory` route.

- [ ] **Step 1: Add DashboardShell nav item**

In `App/src/components/dashboard/DashboardShell.tsx`, import `Boxes`:

```ts
import {
  BarChart3,
  Wallet,
  UtensilsCrossed,
  ShoppingBag,
  Settings,
  Megaphone,
  CalendarClock,
  Boxes,
  Menu as MenuIcon,
  X,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
```

Add this nav entry after `Menu`:

```ts
{ href: "/dashboard/inventory", label: "Inventory", desc: "Stok bahan & resep menu", icon: Boxes },
```

- [ ] **Step 2: Create inventory page server loader**

Create `App/src/app/dashboard/inventory/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { Boxes, AlertTriangle, PackageX, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOwnerCafeSlug } from "@/lib/analytics";
import { supabaseAdmin } from "@/lib/supabase-admin";
import InventoryTable from "@/components/dashboard/InventoryTable";
import type { InventoryItem, InventoryMovement } from "@/types";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = await getOwnerCafeSlug(user.id);
  const { data: cafe } = slug
    ? await supabaseAdmin.from("Cafes").select("id_cafe").eq("slug_url", slug).single()
    : { data: null };

  const cafeId = cafe?.id_cafe as string | undefined;
  const [{ data: items }, { data: movements }] = cafeId
    ? await Promise.all([
        supabaseAdmin
          .from("Inventory_Items")
          .select("*")
          .eq("cafe_id", cafeId)
          .order("name", { ascending: true }),
        supabaseAdmin
          .from("Inventory_Movements")
          .select("*, inventory_item:Inventory_Items(name, unit)")
          .eq("cafe_id", cafeId)
          .order("created_at", { ascending: false })
          .limit(12),
      ])
    : [{ data: [] }, { data: [] }];

  const list = (items ?? []) as InventoryItem[];
  const recent = (movements ?? []) as InventoryMovement[];
  const low = list.filter((item) => item.current_qty > 0 && item.current_qty <= item.minimum_qty).length;
  const empty = list.filter((item) => item.current_qty <= 0).length;
  const value = list.reduce((sum, item) => sum + item.current_qty * item.estimated_unit_cost, 0);

  return (
    <div className="p-5 lg:p-8 max-w-[1180px] mx-auto">
      <div className="mb-7 dash-reveal">
        <h1 className="font-display text-2xl font-bold" style={{ color: "#E9EEF6" }}>Inventory</h1>
        <p className="text-sm mt-1" style={{ color: "#5A7898" }}>Kelola bahan, stok minimum, dan riwayat mutasi.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Summary icon={Boxes} label="Total Bahan" value={String(list.length)} />
        <Summary icon={AlertTriangle} label="Stok Menipis" value={String(low)} tone="#F59E0B" />
        <Summary icon={PackageX} label="Stok Habis" value={String(empty)} tone="#EF4444" />
        <Summary icon={Wallet} label="Nilai Stok" value={new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value)} tone="#22D3A6" />
      </div>

      <InventoryTable items={list} movements={recent} />
    </div>
  );
}

function Summary({ icon: Icon, label, value, tone = "#FD5002" }: { icon: typeof Boxes; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>
        <Icon size={14} style={{ color: tone }} /> {label}
      </div>
      <p className="mt-3 font-display text-xl font-bold tabular-nums" style={{ color: "#E9EEF6" }}>{value}</p>
    </div>
  );
}
```

- [ ] **Step 3: Create inventory item form component**

Create `App/src/components/dashboard/InventoryItemForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { INVENTORY_UNITS, type InventoryItem } from "@/types";
import type { ActionResult } from "@/lib/dashboard-actions";

export default function InventoryItemForm({
  item,
  onSave,
  onDone,
}: {
  item?: InventoryItem;
  onSave: (fd: FormData) => Promise<ActionResult>;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData) {
    setError("");
    startTransition(async () => {
      const result = await onSave(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <form action={submit} className="space-y-4">
      {error && <div className="rounded-xl px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>{error}</div>}
      <Field label="Nama Bahan">
        <input name="name" required defaultValue={item?.name ?? ""} className="dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} placeholder="Sirup Lemon" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Satuan">
          <select name="unit" required defaultValue={item?.unit ?? "gram"} className="dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}>
            {INVENTORY_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </Field>
        <Field label="Harga / Unit">
          <input name="estimated_unit_cost" type="number" min="0" defaultValue={item?.estimated_unit_cost ?? 0} className="dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stok Saat Ini">
          <input name="current_qty" type="number" min="0" step="0.001" defaultValue={item?.current_qty ?? 0} className="dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
        </Field>
        <Field label="Batas Menipis">
          <input name="minimum_qty" type="number" min="0" step="0.001" defaultValue={item?.minimum_qty ?? 0} className="dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
        </Field>
      </div>
      <Field label="Catatan">
        <textarea name="notes" defaultValue={item?.notes ?? ""} rows={3} className="dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none" style={inputStyle} />
      </Field>
      <button disabled={pending} className="dash-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#FD5002", opacity: pending ? 0.7 : 1 }}>
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        Simpan Bahan
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#132136",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#E9EEF6",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#5A7898" }}>{label}</span>
      {children}
    </label>
  );
}
```

- [ ] **Step 4: Create stock adjustment modal**

Create `App/src/components/dashboard/StockAdjustmentModal.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { adjustInventoryStock } from "@/lib/dashboard-actions";
import { formatQty } from "@/lib/inventory";
import type { InventoryItem } from "@/types";

export default function StockAdjustmentModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData) {
    setError("");
    startTransition(async () => {
      const result = await adjustInventoryStock(item.id_inventory_item, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-5" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold" style={{ color: "#E9EEF6" }}>Atur Stok</h2>
        <p className="text-sm mt-1 mb-4" style={{ color: "#5A7898" }}>{item.name} · stok sekarang {formatQty(item.current_qty, item.unit)}</p>
        {error && <div className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>{error}</div>}
        <form action={submit} className="space-y-4">
          <select name="mode" className="dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} defaultValue="add">
            <option value="add">Tambah stok</option>
            <option value="subtract">Kurangi stok</option>
            <option value="set">Set jumlah persis</option>
          </select>
          <input name="quantity" required type="number" min="0" step="0.001" className="dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} placeholder={`Jumlah (${item.unit})`} />
          <textarea name="note" rows={3} className="dash-input w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none" style={inputStyle} placeholder="Catatan penyesuaian" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="dash-press px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ color: "#5A7898", border: "1px solid rgba(255,255,255,0.1)" }}>Batal</button>
            <button disabled={pending} className="dash-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#FD5002" }}>
              {pending && <Loader2 size={15} className="animate-spin" />}
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#132136",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#E9EEF6",
};
```

- [ ] **Step 5: Create inventory table component**

Create `App/src/components/dashboard/InventoryTable.tsx` with a table that imports `InventoryItemForm`, `StockAdjustmentModal`, `createInventoryItem`, `updateInventoryItem`, `inventoryStatus`, `formatQty`, and renders:

```tsx
type ModalState =
  | { type: "create" }
  | { type: "edit"; item: InventoryItem }
  | { type: "adjust"; item: InventoryItem }
  | null;
```

Rows use this status display:

```tsx
const STATUS = {
  safe: { label: "Aman", color: "#22D3A6", bg: "rgba(34,211,166,0.12)" },
  low: { label: "Menipis", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  empty: { label: "Habis", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
} as const;
```

The table columns must be: `Bahan`, `Stok`, `Minimum`, `Harga / Unit`, `Status`, `Aksi`. The recent movements panel must map `manual_add`, `manual_subtract`, `manual_set`, and `order_deduction` to Indonesian labels.

- [ ] **Step 6: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS or only pre-existing unrelated lint issues.

- [ ] **Step 7: Commit dashboard page**

```bash
git add App/src/app/dashboard/inventory/page.tsx App/src/components/dashboard/InventoryTable.tsx App/src/components/dashboard/InventoryItemForm.tsx App/src/components/dashboard/StockAdjustmentModal.tsx App/src/components/dashboard/DashboardShell.tsx
git commit -m "feat: add inventory dashboard"
```

---

### Task 5: Recipe Editor In Menu Form

**Files:**
- Create: `App/src/components/dashboard/RecipeEditor.tsx`
- Modify: `App/src/components/dashboard/MenuForm.tsx`
- Modify: `App/src/app/dashboard/menu/new/page.tsx`
- Modify: `App/src/app/dashboard/menu/[id]/edit/page.tsx`

**Interfaces:**
- Consumes `InventoryItem[]`.
- Consumes existing `MenuRecipe[]`.
- Calls `saveMenuRecipes(menuId, rows)` after menu save when editing an existing menu.
- For new menu creation, recipe editing is hidden until the menu exists; show a helper message.

- [ ] **Step 1: Create recipe editor component**

Create `App/src/components/dashboard/RecipeEditor.tsx`:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { saveMenuRecipes, type RecipeDraftInput } from "@/lib/dashboard-actions";
import type { InventoryItem, MenuRecipe } from "@/types";

export default function RecipeEditor({
  menuId,
  inventoryItems,
  recipes,
}: {
  menuId?: string;
  inventoryItems: InventoryItem[];
  recipes: MenuRecipe[];
}) {
  const [rows, setRows] = useState<RecipeDraftInput[]>(
    recipes.map((recipe) => ({
      inventory_item_id: recipe.inventory_item_id,
      qty_per_menu: recipe.qty_per_menu,
    }))
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const itemById = useMemo(() => new Map(inventoryItems.map((item) => [item.id_inventory_item, item])), [inventoryItems]);

  if (!menuId) {
    return (
      <div className="rounded-2xl p-5" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#5A7898" }}>Resep Inventory</p>
        <p className="text-sm" style={{ color: "#9FB6D1" }}>Simpan menu terlebih dahulu, lalu buka halaman edit untuk menghubungkan bahan inventory.</p>
      </div>
    );
  }

  function addRow() {
    const first = inventoryItems.find((item) => !rows.some((row) => row.inventory_item_id === item.id_inventory_item));
    if (!first) return;
    setRows((current) => [...current, { inventory_item_id: first.id_inventory_item, qty_per_menu: 1 }]);
  }

  function save() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const result = await saveMenuRecipes(menuId, rows);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    });
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "#0D1829", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#5A7898" }}>Resep Inventory</p>
          <p className="text-sm mt-1" style={{ color: "#9FB6D1" }}>Bahan di sini otomatis berkurang saat menu dipesan.</p>
        </div>
        <button type="button" onClick={addRow} disabled={inventoryItems.length === 0} className="dash-press inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: "#132136", color: "#E9EEF6", opacity: inventoryItems.length === 0 ? 0.5 : 1 }}>
          <Plus size={15} /> Tambah
        </button>
      </div>
      {error && <div className="rounded-xl px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>{error}</div>}
      {inventoryItems.length === 0 ? (
        <p className="text-sm" style={{ color: "#5A7898" }}>Belum ada bahan inventory. Tambahkan bahan di halaman Inventory dulu.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: "#5A7898" }}>Menu ini belum memakai stok inventory.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const item = itemById.get(row.inventory_item_id);
            return (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_110px_36px] gap-2">
                <select value={row.inventory_item_id} onChange={(event) => setRows((current) => current.map((r, i) => i === index ? { ...r, inventory_item_id: event.target.value } : r))} className="dash-input px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}>
                  {inventoryItems.map((candidate) => <option key={candidate.id_inventory_item} value={candidate.id_inventory_item}>{candidate.name}</option>)}
                </select>
                <label className="relative">
                  <input value={row.qty_per_menu || ""} onChange={(event) => setRows((current) => current.map((r, i) => i === index ? { ...r, qty_per_menu: Number(event.target.value) || 0 } : r))} type="number" min="0.001" step="0.001" className="dash-input w-full px-3 py-2.5 pr-10 rounded-xl text-sm outline-none" style={inputStyle} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: "#5A7898" }}>{item?.unit}</span>
                </label>
                <button type="button" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} className="dash-press rounded-xl inline-flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)", color: "#FCA5A5" }}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <button type="button" onClick={save} disabled={pending || !menuId} className="dash-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: saved ? "#22D3A6" : "#FD5002", opacity: pending ? 0.7 : 1 }}>
        {pending && <Loader2 size={15} className="animate-spin" />}
        {saved ? "Resep Tersimpan" : "Simpan Resep"}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#132136",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#E9EEF6",
};
```

- [ ] **Step 2: Modify MenuForm props**

In `App/src/components/dashboard/MenuForm.tsx`, import:

```ts
import RecipeEditor from "./RecipeEditor";
import type { InventoryItem, MenuRecipe } from "@/types";
```

Update props:

```ts
interface MenuFormProps {
  menu?: Menu;
  inventoryItems?: InventoryItem[];
  recipes?: MenuRecipe[];
  onSave: (fd: FormData) => Promise<ActionResult>;
  onDelete?: () => Promise<ActionResult>;
}
```

Update signature:

```ts
export default function MenuForm({ menu, inventoryItems = [], recipes = [], onSave, onDelete }: MenuFormProps) {
```

Add the component after the availability card:

```tsx
<RecipeEditor
  menuId={menu?.id_menu}
  inventoryItems={inventoryItems}
  recipes={recipes}
/>
```

- [ ] **Step 3: Load inventory items for new menu page**

Modify `App/src/app/dashboard/menu/new/page.tsx` into an async server page that loads cafe-scoped inventory items and passes them to `MenuForm`. Use `createClient`, `getOwnerCafeSlug`, and `supabaseAdmin` like `menu/page.tsx`.

Expected final `MenuForm` call:

```tsx
<MenuForm onSave={createMenu} inventoryItems={inventoryItems} recipes={[]} />
```

- [ ] **Step 4: Load recipes for edit page**

Modify `App/src/app/dashboard/menu/[id]/edit/page.tsx` to load:

```ts
const [{ data: inventoryItems }, { data: recipes }] = await Promise.all([
  supabaseAdmin
    .from("Inventory_Items")
    .select("*")
    .eq("cafe_id", cafe.id_cafe)
    .order("name", { ascending: true }),
  supabaseAdmin
    .from("Menu_Recipes")
    .select("*")
    .eq("menu_id", id)
    .eq("cafe_id", cafe.id_cafe)
    .order("created_at", { ascending: true }),
]);
```

Expected final `MenuForm` call:

```tsx
<MenuForm
  menu={menu as Menu}
  inventoryItems={(inventoryItems ?? []) as InventoryItem[]}
  recipes={(recipes ?? []) as MenuRecipe[]}
  onSave={onSave}
  onDelete={onDelete}
/>
```

- [ ] **Step 5: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS or only pre-existing unrelated lint issues.

- [ ] **Step 6: Commit recipe editor**

```bash
git add App/src/components/dashboard/RecipeEditor.tsx App/src/components/dashboard/MenuForm.tsx App/src/app/dashboard/menu/new/page.tsx App/src/app/dashboard/menu/[id]/edit/page.tsx
git commit -m "feat: add menu recipe editor"
```

---

### Task 6: Menu Inventory Readiness Indicators

**Files:**
- Modify: `App/src/app/dashboard/menu/page.tsx`
- Modify: `App/src/components/dashboard/MenuTable.tsx`

**Interfaces:**
- Produces `MenuInventoryState = "none" | "ready" | "low"`.
- Menu table receives `inventoryByMenu: Record<string, MenuInventoryState>`.

- [ ] **Step 1: Add local type to MenuTable**

In `App/src/components/dashboard/MenuTable.tsx`, add:

```ts
export type MenuInventoryState = "none" | "ready" | "low";
```

Change props:

```ts
export default function MenuTable({
  menus,
  inventoryByMenu = {},
}: {
  menus: Menu[];
  inventoryByMenu?: Record<string, MenuInventoryState>;
}) {
```

- [ ] **Step 2: Add table column**

Add `inventory` to `SortKey`:

```ts
type SortKey = "nama" | "kategori" | "harga" | "3d" | "status" | "inventory";
```

Add compare branch:

```ts
case "inventory":
  return (inventoryRank(a.id_menu) - inventoryRank(b.id_menu));
```

Inside component add:

```ts
const inventoryRank = (id: string) => {
  const state = inventoryByMenu[id] ?? "none";
  return state === "low" ? 0 : state === "ready" ? 1 : 2;
};
```

Add header before `Status`:

```tsx
<SortableTH label="Inventory" col="inventory" sortKey={sortKey} sortDir={sortDir} onClick={clickHeader} />
```

Add row cell before status:

```tsx
<td className="px-4 py-3">
  <InventoryBadge state={inventoryByMenu[menu.id_menu] ?? "none"} />
</td>
```

Add component:

```tsx
function InventoryBadge({ state }: { state: MenuInventoryState }) {
  const meta = {
    none: { label: "Tanpa resep", color: "#5A7898", bg: "#132136" },
    ready: { label: "Resep aktif", color: "#22D3A6", bg: "rgba(34,211,166,0.12)" },
    low: { label: "Stok kurang", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  }[state];
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}
```

- [ ] **Step 3: Load readiness in menu page**

In `App/src/app/dashboard/menu/page.tsx`, load recipes and inventory:

```ts
const [{ data: menus }, { data: recipes }] = cafe
  ? await Promise.all([
      supabaseAdmin
        .from("Menus")
        .select("*")
        .eq("cafe_id", cafe.id_cafe)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("Menu_Recipes")
        .select("menu_id,qty_per_menu,inventory_item:Inventory_Items(current_qty)")
        .eq("cafe_id", cafe.id_cafe),
    ])
  : [{ data: [] }, { data: [] }];
```

Build state:

```ts
const inventoryByMenu: Record<string, "none" | "ready" | "low"> = {};
for (const menu of list) inventoryByMenu[menu.id_menu] = "none";
for (const recipe of recipes ?? []) {
  const row = recipe as { menu_id: string; qty_per_menu: number; inventory_item?: { current_qty: number } | null };
  const current = Number(row.inventory_item?.current_qty ?? 0);
  const state = current >= Number(row.qty_per_menu) ? "ready" : "low";
  inventoryByMenu[row.menu_id] = inventoryByMenu[row.menu_id] === "low" || state === "low" ? "low" : "ready";
}
```

Pass:

```tsx
<MenuTable menus={list} inventoryByMenu={inventoryByMenu} />
```

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS or only pre-existing unrelated lint issues.

- [ ] **Step 5: Commit indicators**

```bash
git add App/src/app/dashboard/menu/page.tsx App/src/components/dashboard/MenuTable.tsx
git commit -m "feat: show menu inventory status"
```

---

### Task 7: Order API Uses Inventory RPC

**Files:**
- Modify: `App/src/app/api/orders/route.ts`
- Modify: `App/tests/orders-route.test.ts`
- Create: `App/tests/orders-inventory-route.test.ts`

**Interfaces:**
- Consumes RPC `create_order_with_inventory`.
- Keeps request body shape `{ cafeId, table, items, notes }`.
- Returns `{ order, orderToken }` on success.
- Returns 409 with friendly message on insufficient inventory.

- [ ] **Step 1: Update route implementation**

Replace the menu-loading, `calculateOrderTotal`, and direct insert part of `POST` with:

```ts
  const { data, error } = await supabaseAdmin.rpc("create_order_with_inventory", {
    p_cafe_id: cafeId,
    p_table_number: table,
    p_items: items,
    p_notes: notes,
  });

  if (error) {
    if (error.message.includes("menu_unavailable") || error.message.includes("invalid_order")) {
      return NextResponse.json({ error: "Menu tidak tersedia" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 502 });
  }

  const result = data as {
    error?: string;
    unavailableMenus?: string[];
    order?: unknown;
    orderToken?: string;
  } | null;

  if (result?.error === "insufficient_inventory") {
    const names = Array.isArray(result.unavailableMenus) && result.unavailableMenus.length > 0
      ? ` Menu: ${result.unavailableMenus.join(", ")}.`
      : "";
    return NextResponse.json(
      { error: `Stok beberapa menu sedang tidak cukup.${names} Silakan kurangi jumlah atau pilih menu lain.` },
      { status: 409 }
    );
  }

  if (!result?.order || !result.orderToken) {
    return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 502 });
  }

  return NextResponse.json({ order: result.order, orderToken: result.orderToken }, { status: 201 });
```

Remove imports that are no longer used:

```ts
import { randomUUID } from "node:crypto";
import { calculateOrderTotal, type RequestedOrderItem } from "@/lib/order-validation";
```

Keep `RequestedOrderItem` by moving it into the route or importing the type if still needed. Recommended local interface:

```ts
interface RequestedOrderItem {
  id_menu: string;
  qty: number;
}
```

- [ ] **Step 2: Update existing route test mock**

Modify `App/tests/orders-route.test.ts` so the mocked Supabase admin has `rpc` instead of chained `from`.

Expected core assertion:

```ts
expect(rpc).toHaveBeenCalledWith("create_order_with_inventory", {
  p_cafe_id: "cafe-1",
  p_table_number: "12",
  p_items: [{ id_menu: "menu-1", qty: 2 }],
  p_notes: null,
});
```

- [ ] **Step 3: Add insufficient inventory route test**

Create `App/tests/orders-inventory-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { rpc },
}));

describe("POST /api/orders inventory integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 409 when inventory is insufficient", async () => {
    rpc.mockResolvedValue({
      data: {
        error: "insufficient_inventory",
        unavailableMenus: ["Pasta Meatball"],
      },
      error: null,
    });

    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafeId: "cafe-1",
          table: "12",
          items: [{ id_menu: "menu-1", qty: 2 }],
        }),
      })
    );

    const json = await response.json();
    expect(response.status).toBe(409);
    expect(json.error).toContain("Pasta Meatball");
    expect(json.error).not.toContain("Daging");
  });

  it("returns created order from the RPC result", async () => {
    rpc.mockResolvedValue({
      data: {
        order: {
          id_order: "order-1",
          cafe_id: "cafe-1",
          table_number: "12",
          items: [{ id_menu: "menu-1", nama_menu: "Nasi Goreng", harga_menu: 20000, qty: 1 }],
          total: 20000,
          status: "received",
          payment_method: null,
          payment_status: "unpaid",
          created_at: "2026-07-15T00:00:00.000Z",
        },
        orderToken: "token-1",
      },
      error: null,
    });

    const { POST } = await import("@/app/api/orders/route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafeId: "cafe-1",
          table: "12",
          items: [{ id_menu: "menu-1", qty: 1 }],
        }),
      })
    );

    const json = await response.json();
    expect(response.status).toBe(201);
    expect(json.order.total).toBe(20000);
    expect(json.orderToken).toBe("token-1");
  });
});
```

- [ ] **Step 4: Run route tests**

Run:

```bash
npm test -- --run tests/orders-route.test.ts tests/orders-inventory-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit order integration**

```bash
git add App/src/app/api/orders/route.ts App/tests/orders-route.test.ts App/tests/orders-inventory-route.test.ts
git commit -m "feat: deduct inventory when creating orders"
```

---

### Task 8: End-To-End Verification And Polish

**Files:**
- Modify only files touched by earlier tasks if verification finds defects.

**Interfaces:**
- Verifies the full feature works in local dev.

- [ ] **Step 1: Ensure dependencies are installed**

Run:

```bash
if not exist node_modules\.bin\vitest.cmd npm install
```

Expected: dependencies installed and `node_modules\.bin\vitest.cmd` exists.

- [ ] **Step 2: Run all tests**

Run:

```bash
npm test -- --run
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Manual browser verification**

Run:

```bash
npm run dev
```

Open `http://localhost:3000/dashboard/inventory` and verify:

- Inventory nav item appears.
- Create stock item works.
- Edit stock item works.
- Add/subtract/set adjustment works.
- Recent movement appears after adjustment.
- Edit a menu and save recipe rows.
- Menu table shows `Resep aktif` for the edited menu.
- Creating an order for a recipe-backed menu with enough stock succeeds.
- Creating an order after reducing stock below required quantity fails with a friendly message.

- [ ] **Step 6: Commit final fixes**

If verification required fixes:

```bash
git add App
git commit -m "fix: polish inventory flow"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage: inventory item CRUD, manual adjustments, recipe rows, auto deduction, low-stock status, and ledger rows are covered by Tasks 1-8.
- Non-goals preserved: no branch transfer, purchase order, receiving, production, expiry lots, or auto-hide menu tasks are included.
- Type consistency: table names are `Inventory_Items`, `Menu_Recipes`, and `Inventory_Movements`; TypeScript interfaces use matching `id_*` fields.
- Transaction consistency: customer order stock deduction is handled by one Postgres RPC using `FOR UPDATE`.
- Test coverage: helper tests, updated existing route test, insufficient-stock test, success test, full suite, lint, and build are included.
