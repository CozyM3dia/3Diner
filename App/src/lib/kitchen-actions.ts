"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { canOpenKitchenConsole, canOpenOwnerConsole, getStaffContext } from "@/lib/staff-context";
import { afterResponse } from "@/lib/after-response";

export interface HasilDapur {
  error?: string;
}

/** Terjemahan kegagalan RPC ke bahasa dapur.
 *
 *  Pesan yang sama sudah ada di kasir-actions, tapi ditulis untuk kasir yang
 *  sedang memegang uang. Juru masak yang menekan "Tandai Siap" pada tiket yang
 *  baru saja diselesaikan kasir butuh kalimat lain: yang ia perlu tahu adalah
 *  tiketnya sudah bukan urusannya, bukan bahwa ada transisi yang tidak sah.
 *
 *  Berkas ini "use server", jadi peta ini tidak bisa diekspor untuk dipakai
 *  bersama — modul server action hanya boleh mengekspor fungsi async. */
const PESAN: Record<string, string> = {
  order_not_found: "Pesanan sudah tidak ada. Papan akan menyegarkan diri.",
  order_already_final: "Pesanan ini sudah diselesaikan atau dibatalkan di Kasir.",
  invalid_status_transition: "Tahapnya sudah berubah di layar lain. Papan akan menyusul.",
  cash_payment_required: "Pesanan tunai harus dilunasi di Kasir sebelum ditutup.",
};

function bacaError(message: string | undefined): string {
  if (!message) return "Gagal menyimpan. Coba lagi.";
  for (const [kode, teks] of Object.entries(PESAN)) {
    if (message.includes(kode)) return teks;
  }
  return "Gagal menyimpan. Coba lagi.";
}

/** Memajukan satu tiket dari papan dapur.
 *
 *  Sampai sekarang mutasi status hanya milik Kasir dan dapur cuma menonton.
 *  Itu memaksa alur dua orang untuk pekerjaan satu orang: juru masak
 *  mengangkat piring, lalu berteriak ke kasir supaya menekan tombol. Dapur
 *  sekarang boleh memajukan tiketnya sendiri — lewat RPC yang sama, sehingga
 *  aturan transisi tetap ditegakkan database dan bukan oleh dua layar yang
 *  masing-masing punya pendapat.
 *
 *  Yang TIDAK diberikan ke dapur: pembatalan dan penerimaan uang. Keduanya
 *  menyentuh kas, dan itu tetap milik Kasir. */
async function majukan(
  orderId: string,
  berikutnya: "preparing" | "ready" | "completed",
): Promise<HasilDapur> {
  const ctx = await getStaffContext();

  // Peran diperiksa di sini, bukan cuma di layout. Server action adalah pintu
  // HTTP tersendiri: siapa pun yang punya sesi bisa memanggilnya langsung
  // tanpa pernah memuat halaman yang menjaganya.
  if (!ctx.role || ctx.is_active === false) {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }
  if (!canOpenKitchenConsole(ctx.role) && !canOpenOwnerConsole(ctx.role)) {
    return { error: "Peran Anda tidak berwenang mengubah tahap pesanan." };
  }

  const cafeId = ctx.cafe_id;
  if (!cafeId) return { error: "Sesi tidak berlaku. Masuk ulang." };

  const { error } = await supabaseAdmin.rpc("advance_order_status", {
    p_cafe_id: cafeId,
    p_order_id: orderId,
    p_next: berikutnya,
    p_actor: ctx.user_id ?? null,
  });

  if (error) return { error: bacaError(error.message) };

  if (berikutnya === "ready") {
    afterResponse(async () => {
      const { createNotifications } = await import("@/lib/notifications");
      await createNotifications(cafeId, "kitchen_ready", [
        {
          type: "order",
          title: `Pesanan siap · #${orderId.slice(0, 5)}`,
          body: "Dapur menandai pesanan siap diantar.",
          href: "/dashboard-v2/pesanan",
        },
      ]);
    });
  }

  // Kasir melihat antrean yang sama. Tanpa baris ini, tiket yang sudah
  // diserahkan dapur masih menggantung di layar kasir sampai ia memuat ulang.
  // A cache failure must not report a committed database transition as failed.
  for (const path of ["/dapur", "/dashboard-v2/dapur", "/kasir", "/dashboard-v2/pesanan", "/dashboard-v2/pos", "/dashboard-v2"]) {
    try { revalidatePath(path); } catch { /* the authenticated feed reconciles the committed state */ }
  }
  return {};
}

/** Antre → Dimasak. Tiket masuk wajan. */
export async function mulaiMasak(orderId: string): Promise<HasilDapur> {
  return majukan(orderId, "preparing");
}

/** Dimasak → Siap. Piring keluar, menunggu diantar. */
export async function tandaiSiap(orderId: string): Promise<HasilDapur> {
  return majukan(orderId, "ready");
}

/** Siap → Selesai. Aksi terminal: tiket lepas dari papan dan dari antrean kasir.
 *
 *  Database tidak punya jalan pulang dari `completed`, jadi UI-nya menahan
 *  perintah ini beberapa detik sebelum mengirimnya — batal harus terjadi
 *  sebelum tulisan, karena sesudahnya tidak ada yang bisa dibatalkan. */
export async function serahkanPesanan(orderId: string): Promise<HasilDapur> {
  return majukan(orderId, "completed");
}
