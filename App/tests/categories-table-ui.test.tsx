// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
}));

import CategoriesTable, { type CategoryRow } from "@/components/dp/CategoriesTable";

const rows: CategoryRow[] = [
  { name: "Makanan Ringan", items: 2, liveItems: 2, firstCreatedAt: "2026-06-01T00:00:00Z" },
  { name: "Minuman", items: 4, liveItems: 3, firstCreatedAt: "2026-09-01T00:00:00Z" },
  { name: "Menu Utama", items: 3, liveItems: 0, firstCreatedAt: "2026-08-01T00:00:00Z" },
  { name: "Pencuci Mulut", items: 1, liveItems: 1, firstCreatedAt: "2026-07-01T00:00:00Z" },
];

afterEach(cleanup);

describe("CategoriesTable compact states", () => {
  it("renders a short list without meaningless avatars and keeps item actions", () => {
    const { container } = render(<CategoriesTable rows={rows} />);

    expect(container.querySelector(".dp-category-card")?.getAttribute("data-content-size")).toBe("short");
    expect(screen.getByText("4 kategori")).toBeTruthy();
    expect(container.querySelector(".dp-avatar-sm")).toBeNull();
    expect(container.querySelector("img")).toBeNull();

    const action = screen.getAllByRole("link", { name: "Lihat item" })[0];
    expect(action.getAttribute("href")).toBe("/dashboard-v2/items?q=Minuman");

    const css = readFileSync(resolve(process.cwd(), "src/app/dp.css"), "utf8");
    const cardRule = css.match(/\.dp-category-card\s*\{([^}]*)\}/)?.[1] ?? "";
    const tableRule = css.match(/\.dp-category-table-wrap\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(cardRule).toContain("height: fit-content");
    expect(cardRule).toContain("align-self: flex-start");
    expect(tableRule).toContain("min-height: 0");
  });

  it("replaces the table with a deliberate compact state when search has no result", async () => {
    const user = userEvent.setup();
    render(<CategoriesTable rows={rows} />);

    await user.type(screen.getByRole("textbox", { name: "Cari kategori" }), "sarapan");

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("0 kategori")).toBeTruthy();
    expect(screen.getByText("Tidak ada kategori yang cocok dengan “sarapan”.")).toBeTruthy();
  });

  it("preserves category sorting for the compact table", async () => {
    const user = userEvent.setup();
    const { container } = render(<CategoriesTable rows={rows} />);

    await user.click(screen.getByRole("button", { name: /Urut: Terbaru/ }));
    await user.click(screen.getByRole("button", { name: "A–Z" }));

    const names = [...container.querySelectorAll(".dp-category-name")].map(node => node.textContent);
    expect(names).toEqual(["Makanan Ringan", "Menu Utama", "Minuman", "Pencuci Mulut"]);
  });
});
