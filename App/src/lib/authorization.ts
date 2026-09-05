import { getEffectivePermissions } from "@/lib/role-permissions";
import { getStaffContext } from "@/lib/staff-context";
import { PERMISSIONS, type StaffPermission } from "@/lib/permissions-default";
import type { StaffRole } from "@/types";

export { PERMISSIONS };
export type { StaffPermission };

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN" as const;

  constructor(message = "Akses tidak diizinkan") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface AuthorizedStaff {
  cafeId: string;
  userId: string;
  role: StaffRole;
  cafeSlug: string | null;
}

async function requireActiveStaff(): Promise<AuthorizedStaff> {
  const context = await getStaffContext();
  if (!context.cafe_id || !context.user_id || !context.role || context.is_active === false) {
    throw new AuthorizationError();
  }
  return {
    cafeId: context.cafe_id,
    userId: context.user_id,
    role: context.role,
    cafeSlug: context.cafe_slug ?? null,
  };
}

export async function requireOwnerCafe(): Promise<AuthorizedStaff> {
  const staff = await requireActiveStaff();
  if (staff.role !== "owner") throw new AuthorizationError();
  return staff;
}

export async function requireStaffPermission(permission: StaffPermission): Promise<AuthorizedStaff> {
  const staff = await requireActiveStaff();
  // Wewenang EFEKTIF = bawaan kode + override runtime per-kafe
  // (tabel Role_Permissions, disunting dari halaman Roles & Permissions).
  const { matrix } = await getEffectivePermissions(staff.cafeId);
  if (!matrix[permission][staff.role]) throw new AuthorizationError();
  return staff;
}

/** Cashier writes must respect runtime permissions, not just staff membership. */
export async function getOperationsCafeId(): Promise<string | null> {
  try { return (await requireStaffPermission("operate_orders")).cafeId; }
  catch { return null; }
}

export async function requireOrderCapability(
  orderId: string,
  scope: "read_status" | "pay" | "view_qr"
): Promise<{ orderId: string; scope: typeof scope }> {
  if (!orderId.trim() || !scope) throw new AuthorizationError();
  throw new AuthorizationError("Customer capability belum di-bootstrap");
}
