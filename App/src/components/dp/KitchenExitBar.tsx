"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon, LogOutIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Bar navigasi papan Dapur standalone (/dapur).
 *
 *  Dua pintu:
 *  - "Kembali" — ke halaman sebelumnya (history.back). Pemilik yang membuka
 *    KDS dari konsol tidak perlu kehilangan tempat; kalau tidak ada riwayat
 *    (langsung login di perangkat dapur), tombol ini membawa ke konsol.
 *  - "Keluar" — akhiri sesi (tablet dapur milik staf kitchen). */
export default function KitchenExitBar({ cafeName }: { cafeName?: string }) {
  const router = useRouter();

  async function keluar() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="dp-exit-bar">
      <span className="dp-exit-cafe">{cafeName}</span>
      <div className="dp-exit-actions">
        <button
          type="button"
          className="dp-btn-white"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/dashboard-v2/dapur");
          }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Kembali
        </button>
        <button type="button" className="dp-btn-white" onClick={keluar}>
          <LogOutIcon className="h-4 w-4" />
          Keluar
        </button>
      </div>
    </div>
  );
}
