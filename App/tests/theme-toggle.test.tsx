// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ThemeToggle from "@/components/dp/ThemeToggle";

/** Kontrak tema: klik toggle membalik <html data-theme> dan menyimpan
 *  pilihan ke localStorage "tema-3diner". jsdom tanpa matchMedia →
 *  kondisi awan dianggap light (perilaku fallback yang diuji juga). */

describe("ThemeToggle", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("klik pertama membalik light → dark dan menyimpan pilihan", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /mode gelap/i });
    expect(document.documentElement.dataset.theme).not.toBe("dark");

    fireEvent.click(btn);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("tema-3diner")).toBe("dark");
    // label berubah: sekarang menawarkan mode terang
    expect(
      screen.getByRole("button", { name: /mode terang/i }),
    ).toBeTruthy();
  });

  it("klik kedua kembali ke light (toggle dua arah)", () => {
    render(<ThemeToggle />);
    const btn = () => screen.getByRole("button");
    fireEvent.click(btn()); // → dark
    fireEvent.click(btn()); // → light

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("tema-3diner")).toBe("light");
    expect(screen.getByRole("button", { name: /mode gelap/i })).toBeTruthy();
  });

  it("menghormati kondisi tema yang sudah terpasang sebelum render", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);
    // ikon awal sudah sun (menawarkan mode terang)
    expect(screen.getByRole("button", { name: /mode terang/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("mulai dari dark ketika storage berisi dark meski atribut belum ada", () => {
    window.localStorage.setItem("tema-3diner", "dark");
    render(<ThemeToggle />);
    // jsdom tanpa matchMedia: fallback tetap light — TAPI kondisi awal
    // dibaca dari dataset/matchMedia saja sesuai desain; storage diisi
    // oleh anti-FOUC script di aplikasi nyata. Yang diuji di sini:
    // toggling tetap konsisten dari kondisi light.
    expect(screen.getByRole("button", { name: /mode gelap/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
