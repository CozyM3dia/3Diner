// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import SetupChecklist from "@/components/dp/SetupChecklist";

const STORAGE_KEY = "3diner.dashboard-v2.setup-checklist.v1";
const OPEN_KEY = "3diner.dashboard-v2.setup-checklist.open";

/** Checklist hidup di akhir alur SETIAP layar konsol, dengan bentuk bawaan
 *  kapsul terkatup. Setiap tes yang menguji isi kartu membukanya dulu lewat
 *  kapsul itu, persis seperti pemakainya. */
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
    const { container } = render(<SetupChecklist />);

    expect(container.querySelector(".dv3-setup")?.getAttribute("data-layout")).toBe("flow");
    expect(screen.queryByRole("heading", { name: "Siapkan digital menu" })).toBeNull();
    const tab = screen.getByRole("button", { name: /Buka checklist/i });
    expect(tab.getAttribute("aria-label")).toContain("Siapkan digital menu");
    expect(tab.getAttribute("aria-label")).toContain("0 dari 4 selesai");
    expect(within(tab).getByText("4 lagi")).toBeTruthy();
  });

  it("tetap berada di normal flow saat kartu dibuka, termasuk layout ponsel", async () => {
    const user = userEvent.setup();
    const { container } = render(<SetupChecklist />);
    await bukaKartu(user);

    expect(container.querySelector(".dv3-setup")?.getAttribute("data-layout")).toBe("flow");
    expect(container.querySelector(".dv3-setup-kartu")).toBeTruthy();

    const css = readFileSync(resolve(process.cwd(), "src/app/console.css"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "src/components/dp/Shell.tsx"), "utf8");
    const wrapperRule = css.match(/\.dv3-setup\s*\{([^}]*)\}/)?.[1] ?? "";
    const cardRule = css.match(/\.dv3-setup-kartu\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(wrapperRule).toContain("position: static");
    expect(wrapperRule).not.toContain("position: fixed");
    expect(cardRule).toContain("max-width: 100%");
    expect(cardRule).toContain("overflow: visible");
    expect(css).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.dv3-setup-kartu\s*\{[^}]*width: 100%/);

    const mainStart = shell.indexOf('<main className="dv3-content">');
    const checklist = shell.indexOf("<SetupChecklist />", mainStart);
    const mainEnd = shell.indexOf("</main>", mainStart);
    expect(mainStart).toBeGreaterThan(-1);
    expect(checklist).toBeGreaterThan(mainStart);
    expect(checklist).toBeLessThan(mainEnd);
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
