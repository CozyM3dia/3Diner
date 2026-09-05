// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ItemsGrid, { type GridItem } from "@/components/dp/ItemsGrid";

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={String(src)} alt={alt ?? ""} {...props} />
  ),
}));

const item = (image_url: string | null): GridItem => ({
  id_menu: "kopi",
  nama_menu: "Kopi Susu",
  harga_menu: 20_000,
  image_url,
  category: "Minuman",
  is_active: true,
});

describe("ItemsGrid image states", () => {
  afterEach(cleanup);

  it("shows an accessible skeleton until the optimized image has loaded", () => {
    const { container } = render(<ItemsGrid items={[item("https://example.com/kopi.jpg")]} />);

    const media = container.querySelector(".dp-food-media");
    expect(media).toBeTruthy();
    expect(screen.getByRole("status", { name: "Memuat foto Kopi Susu" })).toBeTruthy();

    const image = screen.getByRole("img", { name: "Kopi Susu" });
    expect(image.getAttribute("data-state")).toBe("loading");
    expect(image.getAttribute("width")).toBe("320");
    expect(image.getAttribute("height")).toBe("240");
    expect(image.getAttribute("sizes")).toContain("280px");

    fireEvent.load(image);
    expect(screen.queryByRole("status", { name: "Memuat foto Kopi Susu" })).toBeNull();
    expect(screen.getByRole("img", { name: "Kopi Susu" }).getAttribute("data-state")).toBe("loaded");
  });

  it("replaces a failed request with a clear fallback instead of a blank box", () => {
    render(<ItemsGrid items={[item("https://example.com/rusak.jpg")]} />);

    fireEvent.error(screen.getByRole("img", { name: "Kopi Susu" }));

    expect(screen.queryByRole("status", { name: "Memuat foto Kopi Susu" })).toBeNull();
    expect(screen.getByRole("img", { name: "Foto Kopi Susu tidak dapat dimuat" })).toBeTruthy();
    expect(screen.getByText("Foto tidak dapat dimuat")).toBeTruthy();
  });

  it("reserves the same 4:3 slot for loading, loaded, error, and missing states", () => {
    const first = render(<ItemsGrid items={[item(null)]} />);
    expect(screen.getByRole("img", { name: "Kopi Susu belum memiliki foto" })).toBeTruthy();
    expect(screen.getByText("Belum ada foto")).toBeTruthy();
    first.unmount();

    const css = readFileSync(resolve(process.cwd(), "src/app/dp.css"), "utf8");
    const mediaRule = css.match(/\.dp-food-media\s*\{([^}]*)\}/)?.[1] ?? "";
    const imageRule = css.match(/\.dp-food-img\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(mediaRule).toContain("aspect-ratio: 4 / 3");
    expect(mediaRule).toContain("overflow: hidden");
    expect(imageRule).toContain("position: absolute");
    expect(imageRule).toContain("width: 100%");
    expect(imageRule).toContain("height: 100%");
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*?dp-food-shimmer/);
  });
});
