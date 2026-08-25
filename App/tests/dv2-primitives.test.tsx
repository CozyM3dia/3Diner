// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EmptyState, Field, StatusPill, Tabs } from "@/components/dashboard-v2/primitives";

// Tanpa setup file global, RTL tidak membersihkan DOM antar test — sisa render
// test sebelumnya membuat getByRole menemukan elemen kembar.
afterEach(cleanup);

describe("Tabs", () => {
  const tabs = [
    { key: "semua", label: "Semua", count: 48 },
    { key: "selesai", label: "Selesai", count: 22 },
  ];

  it("merender label ber-counter gaya template", () => {
    render(<Tabs tabs={tabs} active="semua" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "Semua (48)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Selesai (22)" })).toBeTruthy();
  });

  it("menandai tab aktif dan melaporkan klik ke onChange", async () => {
    let picked = "";
    render(<Tabs tabs={tabs} active="semua" onChange={(k) => (picked = k)} />);
    const aktif = screen.getByRole("tab", { name: "Semua (48)" });
    expect(aktif.getAttribute("aria-selected")).toBe("true");
    await userEvent.click(screen.getByRole("tab", { name: "Selesai (22)" }));
    expect(picked).toBe("selesai");
  });

  it("tab tanpa hitungan tidak menampilkan angka", () => {
    render(<Tabs tabs={[{ key: "a", label: "Polos" }]} active="a" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "Polos" }).textContent).toBe("Polos");
  });
});

describe("StatusPill", () => {
  it("memakai warna token lewat CSS var --pill, bukan hex inline", () => {
    render(<StatusPill tone="success">3D ready</StatusPill>);
    const pill = screen.getByText("3D ready");
    expect(pill.className).toContain("dv2-pill");
    expect((pill as HTMLElement).style.getPropertyValue("--pill")).toContain("semantic-success");
  });
});

describe("Field", () => {
  it("mengikat label ke input lewat htmlFor/id", () => {
    render(<Field label="Nama Menu" required />);
    const input = screen.getByLabelText(/Nama Menu/);
    expect(input).toBeTruthy();
    expect(input.getAttribute("required")).not.toBeNull();
  });

  it("error dirender sebagai role=alert dan menandai aria-invalid", () => {
    render(<Field label="Harga" error="Harga wajib diisi" />);
    expect(screen.getByRole("alert").textContent).toBe("Harga wajib diisi");
    expect(screen.getByLabelText(/Harga/).getAttribute("aria-invalid")).toBe("true");
  });

  it("hint hanya tampil saat tidak ada error", () => {
    render(<Field label="Harga" hint="Rupiah penuh" />);
    expect(screen.getByText("Rupiah penuh")).toBeTruthy();
  });
});

describe("EmptyState", () => {
  it("menjelaskan kosong + menyediakan aksi nyata", async () => {
    let clicked = false;
    render(
      <EmptyState title="Belum ada menu" hint="Tambah menu pertamamu" actionLabel="Tambah"
        onAction={() => (clicked = true)} />,
    );
    expect(screen.getByText("Belum ada menu")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Tambah" }));
    expect(clicked).toBe(true);
  });

  it("tanpa handler, tombol tidak dirender — bukan tombol mati ala template", () => {
    render(<EmptyState title="Kosong" actionLabel="Tambah" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
