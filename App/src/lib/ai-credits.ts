import { NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase-admin";

/** Biaya credit per jenis pekerjaan AI.
 *
 *  Generate 3D memanggil Tripo, yang menurut STRATEGY.md §4 berbiaya sekitar
 *  $0.2–0.6 per model — jauh lebih mahal daripada satu panggilan Gemini, jadi
 *  bobotnya berbeda. Kalibrasi ulang setelah biaya API sebenarnya diketahui. */
export const CREDIT_COST = {
  /** Tripo image-to-3D: satu model .glb baru. */
  model3d: 1,
  /** Gemini: ekstraksi daftar menu dari foto atau PDF. */
  menuExtract: 1,
  /** Gemini: menulis deskripsi dan detail satu menu. */
  menuDetails: 1,
} as const;

export interface CreditStatus {
  quota: number;
  used: number;
  remaining: number;
  periodStart: string;
  subscriptionActive: boolean;
}

export interface CreditClaim {
  ok: boolean;
  /** Respons siap kirim saat klaim ditolak. */
  response?: NextResponse;
}

/** Mengklaim credit sebelum memanggil API pihak ketiga.
 *
 *  Sengaja fail-closed, berlawanan dengan rate limiter: kalau penghitung credit
 *  rusak, membiarkan permintaan lewat berarti membakar uang tanpa batas. Rate
 *  limiter melindungi kafe dari trafik; ini melindungi 3Diner dari tagihan.
 *
 *  Gerbang langganan ditegakkan di dalam RPC — kafe dengan status_lunas = false
 *  tidak bisa memanggil API berbayar sama sekali. */
export async function claimAiCredit(cafeId: string, amount: number): Promise<CreditClaim> {
  const { data, error } = await supabaseAdmin.rpc("consume_ai_credit", {
    p_cafe_id: cafeId,
    p_amount: amount,
  });

  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Kuota AI tidak dapat diperiksa. Coba lagi sebentar lagi." },
        { status: 503 }
      ),
    };
  }

  const result = data as
    | { error?: string; ok?: boolean; quota?: number; used?: number; remaining?: number }
    | null;

  if (result?.error === "subscription_inactive") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: "subscription_inactive",
          error: "Langganan belum aktif. Fitur AI dinonaktifkan sampai pembayaran masuk.",
        },
        { status: 402 }
      ),
    };
  }

  if (result?.error === "quota_exceeded") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: "quota_exceeded",
          error: `Kuota AI bulan ini habis (${result.used ?? 0}/${result.quota ?? 0}). Kuota diperbarui awal bulan depan.`,
          quota: result.quota ?? 0,
          used: result.used ?? 0,
          remaining: result.remaining ?? 0,
        },
        { status: 402 }
      ),
    };
  }

  if (!result?.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Kuota AI tidak dapat diklaim." }, { status: 503 }),
    };
  }

  return { ok: true };
}

/** Mengembalikan credit saat panggilan API gagal.
 *
 *  Tanpa ini, error dari Tripo atau Gemini tetap memakan jatah kafe — mereka
 *  membayar untuk sesuatu yang tidak pernah mereka terima. */
export async function refundAiCredit(cafeId: string, amount: number): Promise<void> {
  await supabaseAdmin
    .rpc("refund_ai_credit", { p_cafe_id: cafeId, p_amount: amount })
    .then(
      () => undefined,
      () => undefined /* pengembalian gagal tidak boleh menutupi error aslinya */
    );
}

/** Ringkasan kuota untuk dashboard. Mengembalikan null bila tidak terbaca —
 *  pemanggil menyembunyikan meteran daripada menampilkan angka yang salah. */
export async function getCreditStatus(cafeId: string): Promise<CreditStatus | null> {
  const { data, error } = await supabaseAdmin.rpc("get_ai_credit_status", {
    p_cafe_id: cafeId,
  });
  if (error) return null;

  const result = data as (Partial<CreditStatus> & { error?: string }) | null;
  if (!result || result.error) return null;
  if (typeof result.quota !== "number" || typeof result.used !== "number") return null;

  return {
    quota: result.quota,
    used: result.used,
    remaining: result.remaining ?? Math.max(result.quota - result.used, 0),
    periodStart: result.periodStart ?? "",
    subscriptionActive: result.subscriptionActive ?? false,
  };
}
