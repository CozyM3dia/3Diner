import { permanentRedirect } from "next/navigation";

/** Halaman Addons yang berdiri sendiri DIHAPUS (Sep 2026).
 *
 *  Alasannya bukan penyederhanaan: sebuah addon tidak punya arti tanpa menunya.
 *  "Upsize +6.000" hanya bisa dinilai di sebelah harga menu, dan "wajib pilih
 *  ukuran" mengubah harga yang dilihat tamu di kartu katalog. Layar terpisah
 *  memaksa pemilik menyetel keduanya lewat dropdown, buta terhadap akibatnya.
 *  Sekarang keduanya satu tab di editor menu (Items → Edit → Tambahan), di
 *  sebelah pratinjau telepon.
 *
 *  Rutenya dipertahankan sebagai pengalihan permanen: tautan lama ada di
 *  penunjuk arah panduan, riwayat peramban, dan bookmark pemilik. */
export default function Page(): never {
  permanentRedirect("/dashboard-v2/items");
}
