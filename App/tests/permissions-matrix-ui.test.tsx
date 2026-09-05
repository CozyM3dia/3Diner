// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PermissionsMatrix, { type MatrixUi } from "@/components/dp/PermissionsMatrix";

const { resetPermission, savePermission } = vi.hoisted(() => ({
  resetPermission: vi.fn(),
  savePermission: vi.fn(),
}));

vi.mock("@/lib/role-permission-actions", () => ({ resetPermission, savePermission }));

const cell = (
  values: Partial<Omit<MatrixUi[string], "override">> = {},
  override = false,
): MatrixUi[string] => ({
  owner: true,
  manager: false,
  cashier: false,
  kitchen: false,
  staff: false,
  override,
  ...values,
});

const matrix: MatrixUi = {
  operate_orders: cell({ manager: true, cashier: true, kitchen: true }),
  manage_menu: cell({ manager: true }),
  manage_inventory: cell({ manager: true }),
  manage_settings: cell(),
};

describe("PermissionsMatrix responsive controls", () => {
  beforeEach(() => {
    savePermission.mockReset();
    resetPermission.mockReset();
    savePermission.mockResolvedValue({});
    resetPermission.mockResolvedValue({});
  });

  afterEach(cleanup);

  it("explains disabled controls and distinguishes preview from security locks", async () => {
    const user = userEvent.setup();
    render(<PermissionsMatrix matrix={matrix} defaults={matrix} />);

    expect(screen.getByRole("note", { name: "Keterangan status kontrol wewenang" })).toBeTruthy();
    expect(screen.getByText(/Belum dapat diubah karena dukungan backend/)).toBeTruthy();
    expect(screen.getByText(/Dikunci demi keamanan akses Pengaturan/)).toBeTruthy();

    const preview = screen.getByRole("checkbox", { name: "Tambah Menu untuk Owner / Admin" }) as HTMLInputElement;
    expect(preview.disabled).toBe(true);
    expect(preview.getAttribute("aria-describedby")).toBe("dp-perm-preview-note");

    const live = screen.getByRole("checkbox", { name: "Lihat Menu untuk Owner / Admin" }) as HTMLInputElement;
    expect(live.disabled).toBe(false);
    expect(live.getAttribute("aria-describedby")).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Kasir" }));
    const guarded = screen.getByRole("checkbox", { name: "Lihat Pengaturan untuk Kasir" }) as HTMLInputElement;
    expect(guarded.disabled).toBe(true);
    expect(guarded.getAttribute("aria-describedby")).toBe("dp-perm-guard-note");
  });

  it("keeps enabled Lihat cells wired to the truthful backend payload", async () => {
    const user = userEvent.setup();
    render(<PermissionsMatrix matrix={matrix} defaults={matrix} />);

    await user.click(screen.getByRole("checkbox", { name: "Lihat Menu untuk Owner / Admin" }));

    await waitFor(() => expect(savePermission).toHaveBeenCalledTimes(1));
    expect(savePermission).toHaveBeenCalledWith("manage_menu", {
      owner: false,
      manager: true,
      cashier: false,
      kitchen: false,
      staff: false,
    });
    expect(await screen.findByText(/Wewenang Lihat Menu untuk Owner \/ Admin disimpan/)).toBeTruthy();
  });

  it("turns module rows into bounded cards without horizontal scrolling", () => {
    const { container } = render(<PermissionsMatrix matrix={matrix} defaults={matrix} />);

    const wrap = container.querySelector(".dp-perm-table-wrap");
    expect(wrap?.getAttribute("data-responsive")).toBe("module-cards");
    expect(container.querySelectorAll('[data-control-state="preview"]')).toHaveLength(32);

    const css = readFileSync(resolve(process.cwd(), "src/app/dp.css"), "utf8");
    const wrapRule = css.match(/\.dp-perm-table-wrap\s*\{([^}]*)\}/)?.[1] ?? "";
    const disabledRule = css.match(/\.dp-check:disabled\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(wrapRule).toContain("max-width: 100%");
    expect(wrapRule).toContain("overflow: visible");
    expect(disabledRule).toContain("opacity: 1");
    expect(disabledRule).toContain("border-style: dashed");
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.dp-perm-table tbody tr\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(max-width: 420px\)[\s\S]*?\.dp-perm-table tbody tr\s*\{[^}]*minmax\(0, 1fr\)/);
  });
});
