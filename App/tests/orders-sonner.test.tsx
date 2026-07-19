// @vitest-environment jsdom
import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrdersClient, { type OrderRow } from "../src/components/dashboard/OrdersClient";

const sonnerMocks = vi.hoisted(() => ({
  custom: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), sonnerMocks),
}));

vi.mock("@/lib/dashboard-actions", () => ({
  updateOrderStatus: vi.fn(async () => ({})),
}));

type RealtimeHandler = (payload: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: unknown;
  old?: unknown;
}) => void;

const channelState = vi.hoisted(() => ({
  handler: null as RealtimeHandler | null,
  statusCb: null as ((status: string) => void) | null,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: (_e: string, _f: unknown, cb: RealtimeHandler) => {
        channelState.handler = cb;
        return {
          subscribe: (statusCb?: (status: string) => void) => {
            channelState.statusCb = statusCb ?? null;
            return {};
          },
        };
      },
    }),
    removeChannel: () => undefined,
  }),
}));

const order: OrderRow = {
  id_order: "order-1",
  cafe_id: "cafe-1",
  table_number: "7",
  items: [{ id_menu: "m1", nama_menu: "Kopi", harga_menu: 20000, image_url: "", qty: 2 }],
  total: 40000,
  status: "received",
  payment_method: null,
  payment_status: "unpaid",
  created_at: new Date().toISOString(),
};

describe("OrdersClient Sonner migration", () => {
  beforeEach(() => {
    sonnerMocks.custom.mockClear();
    sonnerMocks.warning.mockClear();
    sonnerMocks.success.mockClear();
    channelState.handler = null;
    channelState.statusCb = null;
    localStorage.setItem("3diner.orderAlerts", "on");
  });
  afterEach(cleanup);

  it("emits one deduped toast (id = order id) for repeated realtime inserts", async () => {
    render(<OrdersClient initial={[]} cafeId="cafe-1" cafeName="Senja Kopi" />);
    await waitFor(() => expect(channelState.handler).toBeTruthy());
    // Tunggu preferensi alarm ter-hydrate (rAF)
    await waitFor(() => new Promise((r) => requestAnimationFrame(() => r(null))));

    channelState.handler!({ eventType: "INSERT", new: order });
    channelState.handler!({ eventType: "INSERT", new: order }); // event ganda

    await waitFor(() => expect(sonnerMocks.custom).toHaveBeenCalledTimes(1));
    expect(sonnerMocks.custom.mock.calls[0][1]).toMatchObject({ id: "order-1" });
  });

  it("surfaces realtime disconnect once via a fixed toast id", async () => {
    render(<OrdersClient initial={[]} cafeId="cafe-1" cafeName="Senja Kopi" />);
    await waitFor(() => expect(channelState.statusCb).toBeTruthy());

    channelState.statusCb!("CHANNEL_ERROR");
    expect(sonnerMocks.warning).toHaveBeenCalledTimes(1);
    expect(sonnerMocks.warning.mock.calls[0][1]).toMatchObject({ id: "realtime-status" });

    channelState.statusCb!("SUBSCRIBED");
    expect(sonnerMocks.success).toHaveBeenCalledTimes(1);
    expect(sonnerMocks.success.mock.calls[0][1]).toMatchObject({ id: "realtime-status" });
  });
});
