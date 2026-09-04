"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Menyegarkan halaman menu tamu begitu owner menekan Simpan di konsol.
 *
 *  Halaman /[slug] adalah ISR. Aksi simpan sudah memanggil `revalidatePath`
 *  dan `revalidateTag`, tetapi itu hanya mengubah apa yang diterima permintaan
 *  BERIKUTNYA — telepon yang layarnya sedang menyala tetap memegang HTML lama
 *  sampai tamunya sendiri memuat ulang. Komponen ini yang menutup jarak itu:
 *  ia mendengar perubahan baris `Menus` kafe ini dan memanggil
 *  `router.refresh()`.
 *
 *  Kenapa Realtime, bukan polling seperti `OrderView`: di sana polling dipilih
 *  karena peran anon dicabut aksesnya dari tabel `Orders`, jadi
 *  `postgres_changes` memang tidak pernah sampai ke pelanggan. `Menus` tidak
 *  begitu — kebijakan "public read menus paid" sudah membolehkan anon
 *  membacanya, jadi siaran ini tidak membuka satu baris pun yang belum boleh
 *  dibaca, dan tamu tidak perlu membayar satu permintaan tiap sepuluh detik
 *  untuk kabar yang hampir selalu "tidak ada yang berubah".
 */

/* Jeda sebelum menyegarkan. Ada BALAPAN yang nyata di sini: peristiwa Realtime
   lahir saat transaksi Postgres di-commit, sedangkan `revalidateTag` baru
   dijalankan aksi server SETELAH itu. Menyegarkan seketika berisiko mengambil
   halaman yang cache-nya belum sempat dibatalkan — tamu melihat kilatan, lalu
   data lama yang sama. Jeda ini juga menggabungkan perubahan beruntun (simpan
   menu, lalu unggah foto) jadi satu penyegaran. */
const JEDA_MS = 900;

export default function MenuRealtimeSync({ cafeId }: { cafeId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cafeId) return;
    const supabase = createClient();
    let disposed = false;
    let pernahTersambung = false;

    const jadwalkanSegar = () => {
      if (disposed) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        if (disposed) return;
        // Tab tersembunyi tidak perlu dirender ulang; ia akan mengejar sendiri
        // lewat pendengar visibilitas di bawah saat tamu kembali melihatnya.
        if (document.hidden) return;
        router.refresh();
      }, JEDA_MS);
    };

    const channel = supabase
      .channel(`menu-tamu-${cafeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Menus", filter: `cafe_id=eq.${cafeId}` },
        jadwalkanSegar,
      )
      /* Peristiwa yang lewat selagi soket putus TIDAK diputar ulang. Jadi
         setiap kali kanal tersambung KEMBALI — bukan saat sambungan pertama,
         yang datanya baru saja dirender server — sekali segarkan untuk
         mengejar apa pun yang terlewat. */
      .subscribe(status => {
        if (status !== "SUBSCRIBED") return;
        if (pernahTersambung) jadwalkanSegar();
        pernahTersambung = true;
      });

    /* Telepon yang terkunci memutus soket, dan peristiwa yang lewat selama itu
       tidak diputar ulang. Jadi saat layar menyala lagi, sekali segarkan tanpa
       menunggu perubahan berikutnya. */
    const onVisible = () => {
      if (!document.hidden) jadwalkanSegar();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [cafeId, router]);

  return null;
}
