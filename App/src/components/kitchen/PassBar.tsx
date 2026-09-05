"use client";

import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { ArrowLeftIcon, BellIcon, BellOffIcon, CookingPotIcon, LayoutGridIcon, ListChecksIcon, LogOutIcon, MaximizeIcon, MinimizeIcon, MoonIcon, RefreshCwIcon, SearchIcon, SunIcon, XIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TAHAP, type Tahap } from "@/lib/kitchen-model";
import { pasangTemaDapur, type TemaDapur } from "@/lib/kitchen-theme";

const clerkTerpasang = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
export type Pandangan = "tiket" | "produksi";
export type Rapat = "normal" | "besar";
interface Props {
  namaKafe: string; bingkai: "mandiri" | "konsol";
  jumlah: Record<Tahap, number>; saring: Set<Tahap>; onSaring: (t: Tahap) => void; onSemua: () => void;
  kueri: string; onKueri: (v: string) => void;
  pandangan: Pandangan; onPandangan: (v: Pandangan) => void;
  rapat: Rapat; onRapat: (v: Rapat) => void;
  tema: TemaDapur; onTema: (v: TemaDapur) => void;
  lonceng: boolean; onLonceng: (v: boolean) => void;
  sync: "connecting" | "online" | "offline" | "preview";
  refreshing: boolean; onRefresh: () => void;
  sejakSinkron: number | null; sekarang: number | null;
}
export default function PassBar(p: Props) {
  const router = useRouter();
  const clerk = useClerk();
  const clock = p.sekarang ? new Date(p.sekarang).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "--:--";
  const total = Object.values(p.jumlah).reduce((a, b) => a + b, 0);
  const connection = p.sync === "preview" ? "Pratinjau" : p.sync === "connecting" ? "Menghubungkan" : p.sync === "offline" ? "Terputus" : "Tersinkron";
  async function keluar() {
    if (clerkTerpasang) await clerk.signOut({ redirectUrl: "/login" });
    else { await createClient().auth.signOut(); router.replace("/login"); router.refresh(); }
  }
  return <header className="kds-pass">
    <div className="kds-pass-atas">
      <div className="kds-merek"><span className="kds-brand-icon"><CookingPotIcon size={25} strokeWidth={1.7} /></span><div><span className="kds-merek-sub">{p.namaKafe || "3Diner"} / Operasional</span><h1 className="kds-merek-judul">Dapur<span className="kds-title-dot" /></h1></div></div>
      <div className="kds-system"><time className="kds-jam">{clock}<small> WIB</small></time><span className="kds-sambungan" data-hidup={p.sync === "online"} title={p.sejakSinkron === null ? connection : `Diperbarui ${Math.floor(p.sejakSinkron / 1000)} detik lalu. Diperiksa setiap 5 detik.`}><i />{connection}</span></div>
      <div className="kds-tools">
        <button type="button" className="kds-alat" disabled={p.refreshing || p.sync === "preview"} onClick={p.onRefresh} aria-label="Segarkan antrean" title="Segarkan antrean"><RefreshCwIcon size={17} className={p.refreshing ? "animate-spin" : undefined} /></button>
        <button type="button" className="kds-alat" aria-pressed={p.lonceng} onClick={() => p.onLonceng(!p.lonceng)} aria-label={p.lonceng ? "Matikan bunyi pesanan baru" : "Bunyikan saat pesanan baru masuk"} title={p.lonceng ? "Bunyi menyala" : "Bunyi mati"}>{p.lonceng ? <BellIcon size={17} /> : <BellOffIcon size={17} />}</button>
        <button type="button" className="kds-alat" aria-pressed={p.rapat === "besar"} onClick={() => p.onRapat(p.rapat === "besar" ? "normal" : "besar")} aria-label={p.rapat === "besar" ? "Kembalikan ukuran normal" : "Perbesar untuk monitor dinding"} title="Ukuran tiket">{p.rapat === "besar" ? <MinimizeIcon size={17} /> : <MaximizeIcon size={17} />}</button>
        {p.bingkai === "mandiri" && <>
          <button type="button" className="kds-alat" onClick={() => { const theme = p.tema === "gelap" ? "terang" : "gelap"; pasangTemaDapur(theme); p.onTema(theme); }} aria-label={p.tema === "gelap" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}>{p.tema === "gelap" ? <SunIcon size={17} /> : <MoonIcon size={17} />}</button>
          <button type="button" className="kds-alat" onClick={() => router.back()} aria-label="Kembali"><ArrowLeftIcon size={17} /></button>
          <button type="button" className="kds-alat" onClick={keluar} aria-label="Keluar"><LogOutIcon size={17} /></button>
        </>}
      </div>
    </div>
    <div className="kds-pass-bawah">
      <div className="kds-saring" role="group" aria-label="Saring menurut tahap">
        <button type="button" className="kds-chip" aria-pressed={p.saring.size === 0} onClick={p.onSemua}>Semua tiket<b>{String(total).padStart(2, "0")}</b></button>
        {(["antre", "masak", "siap", "tahan"] as Tahap[]).map(t => <button key={t} type="button" className="kds-chip" data-tahap={t} aria-pressed={p.saring.has(t)} onClick={() => p.onSaring(t)} title={TAHAP[t].arti}><i className="kds-chip-titik" />{TAHAP[t].label}<b>{String(p.jumlah[t]).padStart(2, "0")}</b></button>)}
      </div>
      <label className="kds-cari"><SearchIcon size={17} /><input name="kitchen-search" value={p.kueri} onChange={e => p.onKueri(e.target.value)} placeholder="Cari meja, menu, catatan…" aria-label="Cari pesanan" autoComplete="off" />{p.kueri && <button type="button" onClick={() => p.onKueri("")} aria-label="Bersihkan pencarian"><XIcon size={15} /></button>}</label>
      <div className="kds-sakelar" role="group" aria-label="Bentuk tampilan">
        <button type="button" aria-pressed={p.pandangan === "tiket"} onClick={() => p.onPandangan("tiket")} title="Tiket"><LayoutGridIcon size={16} /><span>Tiket</span></button>
        <button type="button" aria-pressed={p.pandangan === "produksi"} onClick={() => p.onPandangan("produksi")} title="Semua Item"><ListChecksIcon size={16} /><span>Semua Item</span></button>
      </div>
    </div>
  </header>;
}
