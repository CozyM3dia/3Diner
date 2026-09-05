import { describe, expect, it } from "vitest";
import { dedupeMenuCatalog } from "@/lib/menu-catalog";

describe("dedupeMenuCatalog", () => {
  it("keeps one repeated name/image row while preserving distinct variants", () => {
    const rows = [
      { id: "a", nama_menu: "Compress", image_url: "photo.jpg" },
      { id: "b", nama_menu: " compress ", image_url: "photo.jpg" },
      { id: "c", nama_menu: "Compress", image_url: "other.jpg" },
      { id: "d", nama_menu: "Kopi", image_url: null },
    ];
    expect(dedupeMenuCatalog(rows).map((row) => row.id)).toEqual(["a", "c", "d"]);
  });

  it("treats generated Compress/Generate suffixes as duplicate catalog rows", () => {
    const rows = [
      { id: "base", nama_menu: "Butter Croissant", image_url: "same.jpg" },
      { id: "compress", nama_menu: "Butter Croissant (Compress)", image_url: "same.jpg" },
      { id: "generated", nama_menu: "Butter Croissant (Generate 2)", image_url: "same.jpg" },
    ];
    expect(dedupeMenuCatalog(rows).map((row) => row.id)).toEqual(["base"]);
  });
});
