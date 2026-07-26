import { NextResponse } from "next/server";
import { getAuthCafeId } from "@/lib/dashboard-actions";
import { CREDIT_COST, claimAiCredit, refundAiCredit } from "@/lib/ai-credits";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface DraftMenu {
  nama_menu: string;
  harga_menu: number;
  description_menu: string;
  category: string;
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const SYSTEM_PROMPT =
  "Extract all food and beverage items from this menu document. " +
  "Categorize each item (e.g. Appetizer, Main Course, Drinks, Dessert) and " +
  "determine its name, price in Rupiah (clean integer numbers only, no text or symbol like 'Rp' or '.000' separators — " +
  "e.g. 'Rp 45.000' becomes 45000), and a short description. " +
  "If a description is not present in the document, write a brief appetizing one yourself. " +
  "Return ONLY valid JSON matching the schema. Ignore section headers, prices ranges, and non-menu text.";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    menus: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nama_menu: { type: "STRING" },
          harga_menu: { type: "NUMBER" },
          description_menu: { type: "STRING" },
          category: { type: "STRING" },
        },
        required: ["nama_menu", "harga_menu", "category"],
      },
    },
  },
  required: ["menus"],
};

/**
 * Pure parser — normalizes raw Gemini JSON text into a clean DraftMenu[].
 * Exported so it can be unit-tested with mock data (no API key needed).
 */
export function parseGeminiMenus(rawText: string): DraftMenu[] {
  let text = rawText.trim();
  // Strip ```json ... ``` fences if the model added them
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Respon AI bukan JSON valid");
  }

  const root = parsed as { menus?: unknown };
  const arr = Array.isArray(root?.menus) ? root.menus : Array.isArray(parsed) ? parsed : [];

  const out: DraftMenu[] = [];
  for (const item of arr as Record<string, unknown>[]) {
    if (!item || typeof item !== "object") continue;
    const nama = String(item.nama_menu ?? "").trim();
    if (!nama) continue;

    // harga can come as number or messy string ("Rp 45.000", "45,000")
    let harga = 0;
    const rawPrice = item.harga_menu;
    if (typeof rawPrice === "number") {
      harga = Math.round(rawPrice);
    } else if (typeof rawPrice === "string") {
      const digits = rawPrice.replace(/[^\d]/g, "");
      harga = digits ? parseInt(digits, 10) : 0;
    }

    out.push({
      nama_menu: nama.slice(0, 120),
      harga_menu: harga,
      description_menu: String(item.description_menu ?? "").trim().slice(0, 400),
      category: String(item.category ?? "Lainnya").trim().slice(0, 60) || "Lainnya",
    });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    // Rute ini membakar kuota GEMINI_API_KEY milik server dan hanya dipakai
    // dari dashboard pemilik, jadi gerbang sesi didahulukan seperti rute Tripo.
    const cafeId = await getAuthCafeId();
    if (!cafeId) return NextResponse.json({ error: "Sesi tidak valid. Masuk ulang." }, { status: 401 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY belum dikonfigurasi di server." },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Ukuran file maksimal 15MB." }, { status: 400 });
    }
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: "Format tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF." },
        { status: 400 }
      );
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const claim = await claimAiCredit(cafeId, CREDIT_COST.menuExtract);
    if (!claim.ok) return claim.response!;

    // Model is env-overridable so a wrong/renamed model id can be fixed without redeploy.
    const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              { inline_data: { mime_type: mime, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      }),
    });

    // Setiap jalur keluar yang gagal mengembalikan credit — termasuk foto yang
    // tidak terbaca, yang bukan salah kafe.
    if (!res.ok) {
      await refundAiCredit(cafeId, CREDIT_COST.menuExtract);
      const errText = await res.text();
      let msg = `Gemini error (${res.status})`;
      try {
        const j = JSON.parse(errText);
        msg = j?.error?.message ?? msg;
      } catch {
        /* keep default */
      }
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const data = await res.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

    if (!rawText) {
      await refundAiCredit(cafeId, CREDIT_COST.menuExtract);
      return NextResponse.json({ error: "AI tidak mengembalikan data." }, { status: 502 });
    }

    const menus = parseGeminiMenus(rawText);
    if (menus.length === 0) {
      await refundAiCredit(cafeId, CREDIT_COST.menuExtract);
      return NextResponse.json(
        { error: "Tidak ada item menu terdeteksi. Coba foto yang lebih jelas." },
        { status: 422 }
      );
    }

    return NextResponse.json({ menus });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
