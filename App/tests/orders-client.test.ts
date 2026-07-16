import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrder } from "../src/lib/orders";

describe("createOrder client errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the response message for user-facing errors while preserving API error codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "Menu tidak tersedia",
          message: "Stok beberapa menu sedang tidak cukup. Silakan kurangi jumlah atau pilih menu lain.",
        }),
      })
    );

    await expect(
      createOrder({
        cafeId: "cafe-1",
        cafeSlug: "kopi",
        cafeName: "Kopi",
        table: "7",
        items: [],
      })
    ).rejects.toThrow("Stok beberapa menu sedang tidak cukup. Silakan kurangi jumlah atau pilih menu lain.");
  });
});
