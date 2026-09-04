// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import SetupChecklist from "@/components/dp/SetupChecklist";

const STORAGE_KEY = "3diner.dashboard-v2.setup-checklist.v1";
const OPEN_KEY = "3diner.dashboard-v2.setup-checklist.open";

/** Checklist hidup di atas SETIAP layar konsol, jadi bentuk bawaannya kapsul
 *  terkatup — kartunya dibuka atas kehendak pemakai. Setiap tes yang menguji
 *  isi kartu membukanya dulu lewat kapsul itu, persis seperti pemakainya. */
async function bukaKartu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Buka checklist/i }));
}

describe("SetupChecklist", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(cleanup);

  it("starts collapsed so it never covers the screen it is guiding", () => {
    render(<SetupChecklist />);

    expect(screen.queryByRole("heading", { name: "Siapkan digital menu" })).toBeNull();
    const tab = screen.getByRole("button", { name: /Buka checklist/i });
    expect(tab.getAttribute("aria-label")).toContain("Siapkan digital menu");
    expect(tab.getAttribute("aria-label")).toContain("0 dari 4 selesai");
    expect(within(tab).getByText("4 lagi")).toBeTruthy();
  });

  it("remembers that the card was opened, and closes back to the capsule", async () => {
    const user = userEvent.setup();
    const first = render(<SetupChecklist />);

    await bukaKartu(user);
    expect(screen.getByRole("heading", { name: "Siapkan digital menu" })).toBeTruthy();
    expect(window.localStorage.getItem(OPEN_KEY)).toBe("1");

    first.unmount();
    render(<SetupChecklist />);
    expect(screen.getByRole("heading", { name: "Siapkan digital menu" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Kecilkan checklist persiapan" }));
    expect(screen.queryByRole("heading", { name: "Siapkan digital menu" })).toBeNull();
    expect(screen.getByRole("button", { name: /Buka checklist/i })).toBeTruthy();
  });

  it("toggles a task from the whole row and persists its progress", async () => {
    const user = userEvent.setup();
    render(<SetupChecklist />);
    await bukaKartu(user);

    const row = screen.getByRole("button", { name: /Lengkapi profil toko/i });
    expect(screen.getByText("0 dari 4 selesai")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByRole("link", { name: "Lengkapi" })).toBeTruthy();

    await user.click(row);

    expect(screen.getByText("1 dari 4 selesai")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    expect(row.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("link", { name: "Lengkapi" })).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("profil-toko");
  });

  it("restores checked tasks and lets their rows undo completion", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["menu-pertama", "pajak"]));
    window.localStorage.setItem(OPEN_KEY, "1");
    render(<SetupChecklist />);

    expect(await screen.findByText("2 dari 4 selesai")).toBeTruthy();
    const row = screen.getByRole("button", { name: /Atur pajak/i });
    expect(row.getAttribute("aria-pressed")).toBe("true");

    await user.click(row);

    expect(screen.getByText("1 dari 4 selesai")).toBeTruthy();
    expect(row.getAttribute("aria-pressed")).toBe("false");
  });

  it("links every incomplete task to its real setup screen", () => {
    window.localStorage.setItem(OPEN_KEY, "1");
    render(<SetupChecklist />);

    expect(screen.getByRole("link", { name: "Lengkapi" }).getAttribute("href")).toBe(
      "/dashboard-v2/pengaturan#profil-toko",
    );
    expect(screen.getByRole("link", { name: "Tambah" }).getAttribute("href")).toBe(
      "/dashboard-v2/menu/new",
    );
    expect(screen.getByRole("link", { name: "Atur" }).getAttribute("href")).toBe(
      "/dashboard-v2/pengaturan/pajak",
    );
    expect(screen.getByRole("link", { name: "Siapkan" }).getAttribute("href")).toBe(
      "/dashboard-v2/pengaturan#qr-smart-menu",
    );
  });

  it("marks a task done when its setup action is chosen", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(OPEN_KEY, "1");
    render(<SetupChecklist />);

    const action = screen.getByRole("link", { name: "Tambah" });
    action.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(action);

    expect(screen.getByText("1 dari 4 selesai")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("menu-pertama");
  });

  it("replaces the count with a celebration when every task is complete", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(OPEN_KEY, "1");
    render(<SetupChecklist />);

    for (const label of [
      /Lengkapi profil toko/i,
      /Tambahkan menu pertama/i,
      /Atur pajak/i,
      /Siapkan QR Menu/i,
    ]) {
      await user.click(screen.getByRole("button", { name: label }));
    }

    expect(screen.queryByText(/dari 4 selesai/)).toBeNull();
    expect(screen.getByText("Semua beres")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");

    await user.click(screen.getByRole("button", { name: "Kecilkan checklist persiapan" }));
    expect(screen.getByText("Persiapan selesai")).toBeTruthy();
  });

  it("stays closed for good once it is dismissed", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(OPEN_KEY, "1");
    const first = render(<SetupChecklist />);

    await user.click(screen.getByRole("button", { name: "Tutup checklist persiapan" }));
    expect(screen.queryByRole("heading", { name: "Siapkan digital menu" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Buka checklist/i })).toBeNull();

    first.unmount();
    render(<SetupChecklist />);
    expect(screen.queryByRole("button", { name: /Buka checklist/i })).toBeNull();
  });
});
