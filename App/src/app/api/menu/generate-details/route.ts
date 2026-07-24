import { NextResponse } from "next/server";
import { getAuthCafeId } from "@/lib/dashboard-actions";

export const runtime = "nodejs";
export const maxDuration = 30;

export interface GeneratedDetails {
  description_menu: string;
  ingredients: string;
  prep_time_minutes: number;
  calories: number;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    description_menu: { type: "STRING" },
    ingredients: { type: "STRING" },
    prep_time_minutes: { type: "NUMBER" },
    calories: { type: "NUMBER" },
  },
  required: ["description_menu", "ingredients", "prep_time_minutes", "calories"],
};

function buildPrompt(name: string): string {
  return (
    `Hidangan: "${name}".\n` +
    "Buat detail menu restoran untuk hidangan ini dalam Bahasa Indonesia:\n" +
    "1. description_menu: deskripsi kuliner profesional yang menggugah selera, maksimal 2 kalimat.\n" +
    "2. ingredients: maksimal 6 bahan utama, dipisahkan koma (contoh: 'Pasta, Daging Sapi, Saus Tomat, Keju Parmesan').\n" +
    "3. prep_time_minutes: estimasi waktu persiapan dapur dalam menit, kelipatan 5, angka realistis.\n" +
    "4. calories: estimasi kalori per porsi sebagai angka integer yang wajar.\n" +
    "Kembalikan HANYA JSON sesuai skema."
  );
}

/** Pure normalizer — exported for mock testing without an API key. */
export function normalizeDetails(raw: unknown): GeneratedDetails {
  const o = (raw ?? {}) as Record<string, unknown>;

  const desc = String(o.description_menu ?? "").trim().slice(0, 400);

  let ing = "";
  if (Array.isArray(o.ingredients)) {
    ing = o.ingredients.map((x) => String(x).trim()).filter(Boolean).slice(0, 6).join(", ");
  } else {
    ing = String(o.ingredients ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join(", ");
  }

  const toInt = (v: unknown): number => {
    if (typeof v === "number") return Math.round(v);
    const digits = String(v ?? "").replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  };
  let prep = toInt(o.prep_time_minutes);
  if (prep > 0) prep = Math.max(5, Math.round(prep / 5) * 5); // snap to nearest 5
  const cal = Math.max(0, toInt(o.calories));

  return { description_menu: desc, ingredients: ing, prep_time_minutes: prep, calories: cal };
}

function stripFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return t;
}

export async function POST(req: Request) {
  try {
    // Rute ini membakar kuota GEMINI_API_KEY milik server dan hanya dipakai
    // dari dashboard pemilik, jadi gerbang sesi didahulukan seperti rute Tripo.
    const cafeId = await getAuthCafeId();
    if (!cafeId) return NextResponse.json({ error: "Sesi tidak valid. Masuk ulang." }, { status: 401 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY belum dikonfigurasi di server." }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Nama menu wajib diisi." }, { status: 400 });
    if (name.length > 120) return NextResponse.json({ error: "Nama menu terlalu panjang." }, { status: 400 });

    const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(name) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.5,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let msg = `Gemini error (${res.status})`;
      try { msg = JSON.parse(errText)?.error?.message ?? msg; } catch {}
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const data = await res.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    if (!rawText) return NextResponse.json({ error: "AI tidak mengembalikan data." }, { status: 502 });

    let parsed: unknown;
    try { parsed = JSON.parse(stripFences(rawText)); }
    catch { return NextResponse.json({ error: "Respon AI bukan JSON valid." }, { status: 502 }); }

    return NextResponse.json(normalizeDetails(parsed));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
