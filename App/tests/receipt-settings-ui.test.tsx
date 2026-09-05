// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StrukSettingsDp from "@/components/dp/StrukSettingsDp";
import { DEFAULT_RECEIPT_SETTINGS } from "@/lib/receipt-settings";

const { updateReceiptSettings } = vi.hoisted(() => ({
  updateReceiptSettings: vi.fn(),
}));

vi.mock("@/lib/dashboard-actions", () => ({ updateReceiptSettings }));

function renderSettings() {
  return render(
    <StrukSettingsDp
      cafeName="Senja Kopi"
      cafeAddress="Jl. Senja No. 12"
      logoUrl="https://example.com/logo.png"
      taxConfigured
      initial={DEFAULT_RECEIPT_SETTINGS}
    />,
  );
}

describe("StrukSettingsDp availability states", () => {
  beforeEach(() => {
    updateReceiptSettings.mockReset();
    updateReceiptSettings.mockResolvedValue({});
  });

  afterEach(cleanup);

  it("makes the unavailable print-limit toggle explicit and accessibly described", () => {
    const { container } = renderSettings();

    const unavailable = container.querySelector('[data-availability="unavailable"]');
    expect(unavailable).toBeTruthy();
    expect(screen.getByText("Belum tersedia")).toBeTruthy();
    expect(screen.getByText(/belum terhubung ke sistem printer/)).toBeTruthy();
    expect(screen.getByText("Dinonaktifkan")).toBeTruthy();

    const toggle = screen.getByRole("checkbox", {
      name: "Batasan jumlah cetak struk (belum tersedia)",
    }) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute("aria-describedby")).toBe("rsp-print-limit-description");

    const css = readFileSync(resolve(process.cwd(), "src/app/rsp.css"), "utf8");
    const switchRule = css.match(/\.rsp-limit-switch\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(switchRule).toContain("opacity: 1");
    expect(switchRule).toContain("cursor: not-allowed");
    expect(css).toMatch(/\.rsp-limit-switch i\s*\{[^}]*border: 1px dashed var\(--dp-muted\)/);
    expect(css).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.rsp-limit-row\s*\{[^}]*flex-direction: column/);
  });

  it("keeps enabled receipt toggles and the normalized save payload working", async () => {
    const user = userEvent.setup();
    renderSettings();

    const logo = screen.getByRole("checkbox", { name: "Logo" }) as HTMLInputElement;
    expect(logo.disabled).toBe(false);
    expect(logo.checked).toBe(true);

    await user.click(logo);
    expect(logo.checked).toBe(false);
    expect(screen.getByText("Ada perubahan belum disimpan.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(updateReceiptSettings).toHaveBeenCalledTimes(1));

    const formData = updateReceiptSettings.mock.calls[0][0] as FormData;
    const payload = JSON.parse(String(formData.get("settings")));
    expect(payload).toEqual({ ...DEFAULT_RECEIPT_SETTINGS, show_logo: false });
    expect(await screen.findByText(/Perubahan tersimpan/)).toBeTruthy();
  });
});
