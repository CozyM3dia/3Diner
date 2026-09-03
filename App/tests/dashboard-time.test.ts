import { describe, expect, it } from "vitest";

import { dashboardRangeTimestamps, presetRange } from "@/lib/date-range";

describe("batas waktu query dashboard", () => {
  it("mengubah tanggal bisnis WIB ke batas UTC yang sama di semua server", () => {
    expect(dashboardRangeTimestamps("2026-09-02", "2026-09-03")).toEqual({
      since: "2026-09-01T17:00:00.000Z",
      until: "2026-09-03T16:59:59.999Z",
    });
  });

  it("mengganti preset ke hari WIB berikutnya walau server masih pada tanggal UTC sebelumnya", () => {
    const zonaAwal = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      const now = new Date("2026-09-02T18:30:00.000Z"); // 3 Sep 01.30 WIB
      expect(presetRange("today", now)).toEqual({ from: "2026-09-03", to: "2026-09-03" });
      expect(presetRange("7d", now)).toEqual({ from: "2026-08-28", to: "2026-09-03" });
    } finally {
      process.env.TZ = zonaAwal;
    }
  });
});
