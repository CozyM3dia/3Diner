import { getStaffContext } from "@/lib/staff-context";
import type { StaffRole } from "@/types";

export type StaffPermission = "operate_orders" | "manage_menu" | "manage_inventory" | "manage_settings";

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN" as const;

  constructor(message = "Akses tidak diizinkan") {
    super(message);
    this.name = "AuthorizationError";
  }
}

const PERMISSIONS: Record<StaffPermission, StaffRole[]> = {
  operate_orders: ["owner", "cashier"],
  manage_menu: ["owner"],
  manage_inventory: ["owner"],
  manage_settings: ["owner"],
};

export interface AuthorizedStaff {
  cafeId: string;
  userId: string;
  role: StaffRole;
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
  };
}

export async function requireOwnerCafe(): Promise<AuthorizedStaff> {
  const staff = await requireActiveStaff();
  if (staff.role !== "owner") throw new AuthorizationError();
  return staff;
}

export async function requireStaffPermission(permission: StaffPermission): Promise<AuthorizedStaff> {
  const staff = await requireActiveStaff();
  if (!PERMISSIONS[permission].includes(staff.role)) throw new AuthorizationError();
  return staff;
}

export async function requireOrderCapability(
  orderId: string,
  scope: "read_status" | "pay" | "view_qr"
): Promise<{ orderId: string; scope: typeof scope }> {
  if (!orderId.trim() || !scope) throw new AuthorizationError();
  throw new AuthorizationError("Customer capability belum di-bootstrap");
}
