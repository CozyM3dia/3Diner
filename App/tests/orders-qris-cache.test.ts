import { beforeEach, describe, expect, it, vi } from "vitest";
import { getQrisUrl, setQrisUrl } from "@/lib/orders";

describe("QRIS URL cache", () => {
  const getItem = vi.fn();
  const setItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", { getItem, setItem });
  });

  it("keeps only the non-sensitive QRIS URL alongside order metadata", () => {
    const stub = {
      id_order: "order-1",
      cafe_slug: "kedai",
      cafe_name: "Kedai",
    };
    let stored = JSON.stringify(stub);
    getItem.mockImplementation(() => stored);
    setItem.mockImplementation((_key: string, value: string) => {
      stored = value;
    });

    setQrisUrl("order-1", "https://api.sandbox.midtrans.com/v4/qris/tx-1/qr-code");

    expect(setItem).toHaveBeenCalledWith(
      "3diner.order.order-1",
      JSON.stringify({ ...stub, qris_url: "https://api.sandbox.midtrans.com/v4/qris/tx-1/qr-code" })
    );
    expect(stored).not.toContain("customer_token");
    expect(getQrisUrl("order-1")).toBe("https://api.sandbox.midtrans.com/v4/qris/tx-1/qr-code");
  });

  it("rejects legacy stubs that contain a customer token", () => {
    getItem.mockReturnValue(JSON.stringify({
      id_order: "order-1",
      cafe_slug: "kedai",
      cafe_name: "Kedai",
      customer_token: "token-1",
      qris_url: "https://api.sandbox.midtrans.com/v4/qris/tx-1/qr-code",
    }));

    expect(getQrisUrl("order-1")).toBeNull();
  });

  it("ignores a QR URL that did not come from a Midtrans QR host", () => {
    getItem.mockReturnValue(JSON.stringify({
      id_order: "order-1",
      cafe_slug: "kedai",
      cafe_name: "Kedai",
      qris_url: "https://evil.example/track.png",
    }));

    expect(getQrisUrl("order-1")).toBeNull();
  });
});
