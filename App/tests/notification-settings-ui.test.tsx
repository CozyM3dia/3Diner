// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NotifSettingsDp from "@/components/dp/NotifSettingsDp";
import { DEFAULT_NOTIF_SETTINGS } from "@/lib/notification-settings";

const { saveNotificationSettings } = vi.hoisted(() => ({
  saveNotificationSettings: vi.fn(),
}));

vi.mock("@/lib/notification-actions", () => ({ saveNotificationSettings }));

describe("NotifSettingsDp", () => {
  beforeEach(() => {
    saveNotificationSettings.mockReset();
    saveNotificationSettings.mockResolvedValue({});
  });

  afterEach(cleanup);

  it("exposes a labelled matrix that becomes event cards without horizontal scrolling", () => {
    const { container } = render(<NotifSettingsDp initial={DEFAULT_NOTIF_SETTINGS} />);

    const matrix = screen.getByRole("table", { name: "Matriks notifikasi per kejadian" });
    expect(matrix.getAttribute("data-responsive")).toBe("event-cards");
    expect(matrix.getAttribute("aria-describedby")).toBe("nsw-matrix-help");
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);

    const paymentRow = screen.getByRole("rowheader", { name: /Pembayaran Lunas/ }).closest('[role="row"]');
    expect(paymentRow).toBeTruthy();
    expect(within(paymentRow as HTMLElement).getByText("Desktop", { selector: ".nsw-mobile-label" })).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Pembayaran Lunas via Push (belum tersedia)" }) as HTMLInputElement).disabled).toBe(true);
    expect(container.querySelectorAll('.nsw-matrix-ch[data-available="false"]')).toHaveLength(12);

    const css = readFileSync(resolve(process.cwd(), "src/app/nsw.css"), "utf8");
    const matrixRule = css.match(/\.nsw-matrix\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(matrixRule).toContain("max-width: 100%");
    expect(matrixRule).toContain("overflow: visible");
    expect(matrixRule).not.toContain("overflow-x: auto");
    expect(css).not.toContain("min-width: 620px");
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.nsw-matrix-head\s*\{\s*display: none/);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.nsw-matrix-row\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(max-width: 380px\)[\s\S]*?\.nsw-matrix-row\s*\{[^}]*minmax\(0, 1fr\)/);
  });

  it("keeps bulk toggles and save payload semantics intact", async () => {
    const user = userEvent.setup();
    render(<NotifSettingsDp initial={DEFAULT_NOTIF_SETTINGS} />);

    await user.click(screen.getByRole("button", { name: "Nyalakan semua channel live untuk Pembayaran Lunas" }));

    expect((screen.getByRole("checkbox", { name: "Pembayaran Lunas via In-App" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Pembayaran Lunas via Desktop" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Pembayaran Lunas via Push (belum tersedia)" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Ada perubahan belum disimpan.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(saveNotificationSettings).toHaveBeenCalledTimes(1));

    const payload = JSON.parse(String((saveNotificationSettings.mock.calls[0][0] as FormData).get("settings")));
    expect(payload.events.payment_paid).toEqual({
      in_app: true,
      desktop: true,
      push: false,
      sms: false,
      email: false,
    });
    expect(await screen.findByText(/Perubahan tersimpan/)).toBeTruthy();
  });

  it("restores the saved snapshot when changes are cancelled", async () => {
    const user = userEvent.setup();
    render(<NotifSettingsDp initial={DEFAULT_NOTIF_SETTINGS} />);

    const desktop = screen.getByRole("checkbox", { name: "Pesanan Baru via Desktop" });
    await user.click(desktop);
    expect((desktop as HTMLInputElement).checked).toBe(false);

    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect((desktop as HTMLInputElement).checked).toBe(true);
    expect(saveNotificationSettings).not.toHaveBeenCalled();
  });
});
