// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={String(src)} alt={alt ?? ""} {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
  ),
  useLinkStatus: () => ({ pending: true }),
}));

import DashboardLoading from "@/app/dashboard-v2/loading";
import DashboardNavLink from "@/components/dp/DashboardNavLink";
import ItemsGrid from "@/components/dp/ItemsGrid";
import KitchenThemeSync from "@/components/kitchen/KitchenThemeSync";

afterEach(cleanup);

describe("respons navigasi dashboard", () => {
  it("menampilkan status langsung saat segmen tujuan masih dimuat", () => {
    render(<DashboardLoading />);
    expect(screen.getByRole("status", { name: /memuat halaman dashboard/i })).toBeTruthy();
  });

  it("menandai tautan yang sedang menunggu respons server", () => {
    render(<DashboardNavLink href="/dashboard-v2/items" className="dv3-item">Item</DashboardNavLink>);
    expect(screen.getByRole("status", { name: /membuka item/i })).toBeTruthy();
  });

  it("memberi browser ukuran responsif agar kartu tidak mengunduh gambar 640px", () => {
    render(
      <ItemsGrid
        initialQuery=""
        items={[
          {
            id_menu: "kopi",
            nama_menu: "Kopi",
            harga_menu: 20_000,
            image_url: "https://example.com/kopi.jpg",
            category: "Minuman",
            is_active: true,
          },
        ]}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Cari menu" }).getAttribute("name")).toBe("item-search");
    expect(screen.getByRole("img", { name: "Kopi" }).getAttribute("sizes")).toContain("280px");
  });

  it("menerapkan tema dapur pada navigasi klien tanpa script mentah", () => {
    document.documentElement.dataset.theme = "light";
    render(<KitchenThemeSync mode="console" />);
    expect(document.documentElement.dataset.kds).toBe("terang");
  });
});
