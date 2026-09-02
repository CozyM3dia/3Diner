// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import Petunjuk from "../src/components/dp/Petunjuk";

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

function Halaman() {
  return (
    <div className="dv3-root">
      <Petunjuk judul="Papan kanban" bab="pesanan">
        Kolom disusun per status pesanan.
      </Petunjuk>
    </div>
  );
}

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("Petunjuk", () => {
  it("berdenyut untuk pemakai baru, lalu tenang setelah dibuka", async () => {
    render(<Halaman />);
    const tombol = screen.getByRole("button", { name: "Petunjuk: Papan kanban" });
    await waitFor(() => expect(tombol.className).toContain("dv3-hint-baru"));

    await userEvent.click(tombol);

    expect(await screen.findByText("Kolom disusun per status pesanan.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /panduan/i }).getAttribute("href")).toBe(
      "/dashboard-v2/panduan#pesanan",
    );
    // Isi dipasang di dalam .dv3-root supaya token palet konsol ikut.
    expect(document.querySelector(".dv3-root .dv3-hint-pop")).toBeTruthy();
    expect(tombol.className).not.toContain("dv3-hint-baru");
    expect(localStorage.getItem("dv3-petunjuk-dibuka")).toBe("1");
  });

  it("tidak berdenyut kalau perangkat sudah pernah membukanya", async () => {
    localStorage.setItem("dv3-petunjuk-dibuka", "1");
    render(<Halaman />);
    const tombol = screen.getByRole("button", { name: "Petunjuk: Papan kanban" });
    await new Promise(r => setTimeout(r, 20));
    expect(tombol.className).not.toContain("dv3-hint-baru");
  });
});
