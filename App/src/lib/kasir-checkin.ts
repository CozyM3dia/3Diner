/** Check-in pesanan bayar-di-kasir dari konsol kasir.
 *
 *  Ini helper KLIEN, bukan server action: endpoint `/api/kasir/checkin`
 *  diautentikasi lewat cookie sesi staf di browser, jadi panggilannya harus
 *  berangkat dari perangkat kasir, bukan dari server. Karena itu ia tinggal di
 *  modul biasa, terpisah dari `kasir-actions.ts` yang berlabel `"use server"`.
 *
 *  Mengembalikan `null` bila berhasil, atau pesan kesalahan siap-tampil —
 *  meniru gaya `setPaymentMethod` di `orders.ts`: satu nilai balik, tanpa
 *  lempar, supaya pemanggil cukup menulis `if (msg) …`. */
export async function checkInOrder(checkinCode: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch("/api/kasir/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkinCode }),
    });
  } catch {
    // Jaringan putus di tengah layanan bukan "gagal check-in" — kasir perlu
    // tahu ini soal koneksi, bukan soal kode yang salah.
    return "Tidak dapat menghubungi server. Periksa koneksi.";
  }

  if (res.ok) return null;

  const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
  return data?.message ?? data?.error ?? "Gagal check-in pesanan";
}
