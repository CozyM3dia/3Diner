import { beforeEach, describe, expect, it, vi } from "vitest";

/** /api/menu/extract dan /api/menu/generate-details memanggil Gemini dengan
 *  GEMINI_API_KEY milik server. Keduanya hanya dipakai dari dashboard pemilik
 *  (MenuExtractor, MenuForm), jadi harus bergerbang sesi seperti rute Tripo —
 *  tanpa itu siapa pun bisa membakar kuota API lewat POST langsung. */
const getAuthCafeId = vi.fn();

vi.mock("@/lib/dashboard-actions", () => ({ getAuthCafeId }));

const fetchSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubGlobal("fetch", fetchSpy);
  process.env.GEMINI_API_KEY = "test-key";
});

function extractRequest(): Request {
  const fd = new FormData();
  fd.append("file", new File(["menu"], "menu.png", { type: "image/png" }));
  return new Request("http://localhost/api/menu/extract", { method: "POST", body: fd });
}

function detailsRequest(): Request {
  return new Request("http://localhost/api/menu/generate-details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nama_menu: "Nasi Goreng", category: "Main Course" }),
  });
}

describe("POST /api/menu/extract", () => {
  it("rejects an unauthenticated caller before spending Gemini quota", async () => {
    getAuthCafeId.mockResolvedValue(null);
    const { POST } = await import("@/app/api/menu/extract/route");

    const response = await POST(extractRequest());

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lets a signed-in cafe owner through", async () => {
    getAuthCafeId.mockResolvedValue("cafe-1");
    const { POST } = await import("@/app/api/menu/extract/route");

    const response = await POST(extractRequest());

    expect(response.status).not.toBe(401);
    expect(getAuthCafeId).toHaveBeenCalled();
  });
});

describe("POST /api/menu/generate-details", () => {
  it("rejects an unauthenticated caller before spending Gemini quota", async () => {
    getAuthCafeId.mockResolvedValue(null);
    const { POST } = await import("@/app/api/menu/generate-details/route");

    const response = await POST(detailsRequest());

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lets a signed-in cafe owner through", async () => {
    getAuthCafeId.mockResolvedValue("cafe-1");
    const { POST } = await import("@/app/api/menu/generate-details/route");

    const response = await POST(detailsRequest());

    expect(response.status).not.toBe(401);
    expect(getAuthCafeId).toHaveBeenCalled();
  });
});
