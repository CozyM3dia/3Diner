// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { shareFileName, shareImage } from "@/lib/capture-share";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shareFileName", () => {
  it("builds a gallery-friendly name from the dish and cafe", () => {
    expect(shareFileName("Nasi Goreng Spesial", "Kopi Kita")).toBe(
      "3diner-nasi-goreng-spesial-kopi-kita.png"
    );
  });

  it("strips punctuation that filesystems reject", () => {
    expect(shareFileName("Es Kopi / Susu #1", "Kafe \"Senja\"")).toBe(
      "3diner-es-kopi-susu-1-kafe-senja.png"
    );
  });

  it("falls back to a generic name when nothing survives slugging", () => {
    expect(shareFileName("!!!", "???")).toBe("3diner-dish.png");
  });
});

describe("shareImage", () => {
  const blob = new Blob(["x"], { type: "image/png" });

  function stubDownload() {
    const click = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:fake"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag !== "a") throw new Error(`unexpected tag ${tag}`);
      return { href: "", download: "", click } as unknown as HTMLElement;
    });
    return click;
  }

  it("shares through the Web Share API when files are supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { canShare: () => true, share });

    expect(await shareImage(blob, "a.png", "Dish")).toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("falls back to a download when file sharing is unavailable", async () => {
    vi.stubGlobal("navigator", { canShare: () => false });
    const click = stubDownload();

    expect(await shareImage(blob, "a.png", "Dish")).toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("treats a dismissed share sheet as done, not as a failure to retry", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    vi.stubGlobal("navigator", { canShare: () => true, share });
    const click = stubDownload();

    // Tamu menutup lembar berbagi; memaksa unduhan setelah itu akan terasa
    // seperti aplikasi mengabaikan keputusan mereka.
    expect(await shareImage(blob, "a.png", "Dish")).toBe("shared");
    expect(click).not.toHaveBeenCalled();
  });

  it("downloads when the share sheet fails for a real reason", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("boom", "NotAllowedError"));
    vi.stubGlobal("navigator", { canShare: () => true, share });
    const click = stubDownload();

    expect(await shareImage(blob, "a.png", "Dish")).toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
  });
});
