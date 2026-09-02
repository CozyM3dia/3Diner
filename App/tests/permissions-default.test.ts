import { describe, expect, it } from "vitest";
import { PERMISSIONS, permissionDefaultCell } from "@/lib/permissions-default";
import { STAFF_ROLES } from "@/types";

describe("permissionDefaultCell", () => {
  it("mengisi kelima peran, bukan indeks array 0/1", () => {
    const cell = permissionDefaultCell("manage_menu");
    for (const role of STAFF_ROLES) {
      expect(cell).toHaveProperty(role);
      expect(typeof cell[role]).toBe("boolean");
    }
    expect(cell).not.toHaveProperty("0");
    expect(cell).not.toHaveProperty("1");
  });

  it("memberi owner dan manager hak manage_menu", () => {
    const cell = permissionDefaultCell("manage_menu");
    expect(cell.owner).toBe(true);
    expect(cell.manager).toBe(true);
    expect(cell.cashier).toBe(false);
    expect(cell.kitchen).toBe(false);
    expect(cell.staff).toBe(false);
    expect(PERMISSIONS.manage_menu).toEqual(["owner", "manager"]);
  });

  it("hanya owner yang punya manage_settings secara bawaan", () => {
    const cell = permissionDefaultCell("manage_settings");
    expect(cell.owner).toBe(true);
    expect(cell.manager).toBe(false);
  });
});
