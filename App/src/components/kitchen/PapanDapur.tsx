"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRightIcon, CheckCheckIcon, CircleAlertIcon, Clock3Icon, CookingPotIcon, InboxIcon, SearchIcon, XIcon } from "lucide-react";
import { mulaiMasak, serahkanPesanan, tandaiSiap } from "@/lib/kitchen-actions";
import { bunyikanLonceng } from "@/lib/kitchen-lonceng";
import { bacaTemaDapur, type TemaDapur } from "@/lib/kitchen-theme";
import { cocokPencarian, hitungSemuaItem, tahapDari, urutkanPapan, TAHAP, type Tahap, type TiketDapur } from "@/lib/kitchen-model";
import PassBar, { type Pandangan, type Rapat } from "@/components/kitchen/PassBar";
import PanelProduksi from "@/components/kitchen/PanelProduksi";
import Tiket from "@/components/kitchen/Tiket";
import type { OrderStatus } from "@/types";

interface Preferensi { pandangan: Pandangan; rapat: Rapat; lonceng: boolean; tema: TemaDapur }
const defaults: Preferensi = { pandangan: "tiket", rapat: "normal", lonceng: false, tema: "gelap" };
const subscribeClock = (change: () => void) => { const timer = setInterval(change, 1000); return () => clearInterval(timer); };
const clientClock = () => Math.floor(Date.now() / 1000) * 1000;
const serverClock = () => 0;
const LANES: Tahap[] = ["antre", "masak", "siap"];
const LANE_ICONS = { antre: InboxIcon, masak: CookingPotIcon, siap: CheckCheckIcon };
type Period = "semua" | "hari-ini" | "sebelumnya";

export default function PapanDapur({ awal, cafeId, namaKafe, bingkai }: {
  awal: TiketDapur[]; cafeId: string; namaKafe: string; bingkai: "mandiri" | "konsol";
}) {
  const [tiket, setTiket] = useState(awal);
  const [kueri, setKueri] = useState("");
  const [saring, setSaring] = useState<Set<Tahap>>(() => new Set());
  const [period, setPeriod] = useState<Period>("semua");
  const [pref, setPref] = useState(defaults);
  const [restored, setRestored] = useState(false);
  const [plating, setPlating] = useState<Record<string, string[]>>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [sync, setSync] = useState<"connecting" | "online" | "offline">("connecting");
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const known = useRef(new Set(awal.map(t => t.id_order)));
  const pendingRef = useRef(new Set<string>());
  const generation = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const sound = useRef(false);
  const now = useSyncExternalStore(subscribeClock, clientClock, serverClock) || null;
  const storageKey = `dapur-plating:${cafeId || "preview"}`;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; activeRequest.current?.abort(); };
  }, []);

  useEffect(() => {
    let stored: Partial<Preferensi> = {};
    try { stored = JSON.parse(localStorage.getItem("dapur-preferensi") || "{}") ?? {}; } catch { /* defaults */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore browser preferences after hydration
    setPref({ pandangan: stored.pandangan === "produksi" ? "produksi" : "tiket", rapat: stored.rapat === "besar" ? "besar" : "normal", lonceng: stored.lonceng === true, tema: bacaTemaDapur() });
    setRestored(true);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const clean: Record<string, string[]> = {};
      for (const t of awal) if (Array.isArray(saved?.[t.id_order])) clean[t.id_order] = saved[t.id_order].filter((x: unknown) => typeof x === "string");
      setPlating(clean);
    } catch { /* invalid storage */ }
  }, [storageKey, awal]);

  useEffect(() => {
    sound.current = pref.lonceng;
    if (!restored) return;
    try { localStorage.setItem("dapur-preferensi", JSON.stringify(pref)); } catch { /* session preference */ }
  }, [pref, restored]);

  useEffect(() => {
    if (bingkai !== "konsol") return;
    const mirror = () => { document.documentElement.dataset.kds = document.documentElement.dataset.theme === "light" ? "terang" : "gelap"; };
    mirror();
    const observer = new MutationObserver(mirror);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [bingkai]);

  // Orders has no browser SELECT policy. Use the staff-authorized endpoint,
  // reconcile a full snapshot, and never advertise socket connectivity as freshness.
  const refresh = useCallback(async () => {
    if (!cafeId || activeRequest.current || !alive.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const version = generation.current;
    setRefreshing(true);
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("/api/kitchen", { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.tickets)) throw new Error("sync_failed");
      if (!alive.current || version !== generation.current) return;
      const next = body.tickets as TiketDapur[];
      const newTicket = next.some(t => !known.current.has(t.id_order));
      known.current = new Set(next.map(t => t.id_order));
      setTiket(previous => {
        const current = new Map(previous.map(t => [t.id_order, t]));
        const merged = next.map(t => pendingRef.current.has(t.id_order) ? current.get(t.id_order) ?? t : t);
        for (const t of previous) if (pendingRef.current.has(t.id_order) && !next.some(n => n.id_order === t.id_order)) merged.push(t);
        return JSON.stringify(previous) === JSON.stringify(merged) ? previous : merged;
      });
      setSync("online");
      setLastSync(Date.now());
      if (newTicket && sound.current) bunyikanLonceng();
    } catch {
      if (alive.current && version === generation.current) setSync("offline");
    } finally {
      clearTimeout(timeout);
      if (activeRequest.current === controller) activeRequest.current = null;
      if (alive.current) setRefreshing(false);
    }
  }, [cafeId]);

  useEffect(() => {
    if (!cafeId) return;
    const tick = () => { if (document.visibilityState !== "hidden") void refresh(); };
    const offline = () => setSync("offline");
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", tick);
    return () => {
      clearTimeout(first); clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick); window.removeEventListener("offline", offline); window.removeEventListener("focus", tick);
      activeRequest.current?.abort();
    };
  }, [cafeId, refresh]);

  const action = useCallback(async (id: string, next: OrderStatus) => {
    if (pendingRef.current.has(id)) return;
    if (!cafeId) { setGalat("Pratinjau saja. Gunakan papan dapur untuk menyimpan pesanan nyata."); return; }
    pendingRef.current.add(id);
    generation.current += 1;
    setPending(new Set(pendingRef.current));
    setGalat(null);
    try {
      const work = next === "preparing" ? mulaiMasak : next === "ready" ? tandaiSiap : serahkanPesanan;
      const result = await work(id);
      if (!alive.current) return;
      if (result.error) setGalat(result.error);
      else setTiket(previous => next === "completed" ? previous.filter(t => t.id_order !== id) : previous.map(t => t.id_order === id ? { ...t, status: next } : t));
    } catch {
      if (alive.current) setGalat("Penyimpanan belum terkonfirmasi. Papan akan memeriksa status terbaru; coba lagi jika belum berubah.");
    } finally {
      pendingRef.current.delete(id);
      generation.current += 1;
      if (alive.current) { setPending(new Set(pendingRef.current)); void refresh(); }
    }
  }, [cafeId, refresh]);

  const markLine = (orderId: string, key: string) => {
    const lines = new Set(plating[orderId] ?? []);
    if (lines.has(key)) lines.delete(key); else lines.add(key);
    const next = { ...plating, [orderId]: [...lines] };
    setPlating(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* session only */ }
  };
  const date = now ? new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }) : null;
  const isToday = (t: TiketDapur) => date === new Date(t.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const older = date ? tiket.filter(t => !isToday(t)).length : 0;
  const scoped = tiket.filter(t => period === "semua" || (period === "hari-ini" ? isToday(t) : !isToday(t)));
  const jumlah = scoped.reduce((total, t) => { total[tahapDari(t.status)]++; return total; }, { tahan: 0, antre: 0, masak: 0, siap: 0 });
  const tampil = useMemo(() => urutkanPapan(tiket.filter(t => {
    if (saring.size && !saring.has(tahapDari(t.status))) return false;
    const today = date === new Date(t.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    if (period !== "semua" && (period === "hari-ini") !== today) return false;
    return cocokPencarian(t, kueri);
  })), [tiket, saring, kueri, period, date]);
  const produksi = useMemo(() => hitungSemuaItem(tampil), [tampil]);
  const hasFilter = saring.size > 0 || kueri.trim() !== "" || period !== "semua";
  const clear = () => { setSaring(new Set()); setKueri(""); setPeriod("semua"); };
  const card = (t: TiketDapur) => <Tiket key={t.id_order} tiket={t} sekarang={now} selesai={new Set(plating[t.id_order] ?? [])} sibuk={pending.has(t.id_order)} pergi={false} onToggleBaris={key => markLine(t.id_order, key)} onAksi={action} />;
  const held = tampil.filter(t => tahapDari(t.status) === "tahan");

  return <div className="kds" data-rapat={pref.rapat} data-bingkai={bingkai}>
    <div className="kds-papan">
      <PassBar namaKafe={namaKafe} bingkai={bingkai} jumlah={jumlah} saring={saring}
        onSaring={stage => setSaring(previous => previous.has(stage) ? new Set() : new Set([stage]))}
        onSemua={() => setSaring(new Set())} kueri={kueri} onKueri={setKueri}
        pandangan={pref.pandangan} onPandangan={pandangan => setPref(p => ({ ...p, pandangan }))}
        rapat={pref.rapat} onRapat={rapat => setPref(p => ({ ...p, rapat }))}
        tema={pref.tema} onTema={tema => setPref(p => ({ ...p, tema }))}
        lonceng={pref.lonceng} onLonceng={lonceng => { if (lonceng) bunyikanLonceng(); setPref(p => ({ ...p, lonceng })); }}
        sync={cafeId ? sync : "preview"} refreshing={refreshing} onRefresh={refresh}
        sejakSinkron={lastSync && now ? now - lastSync : null} sekarang={now} />
      <div className="kds-isi">
        <div className="kds-workbar">
          <div><span className="kds-eyebrow">SERVICE BOARD</span><h2>Setiap pesanan, tepat waktu<span>.</span></h2></div>
          <div className="kds-period" role="group" aria-label="Waktu pesanan">
            {([['semua', 'Semua waktu'], ['hari-ini', 'Hari ini'], ['sebelumnya', 'Sebelumnya']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}{key === "sebelumnya" && older > 0 && <b>{older}</b>}</button>)}
          </div>
        </div>
        {sync === "offline" && cafeId && <div className="kds-notice" role="status"><CircleAlertIcon size={16} /><span>Koneksi terputus. Data terakhir tetap ditampilkan; papan mencoba kembali otomatis.</span><button type="button" disabled={refreshing} onClick={() => void refresh()}>Coba lagi</button></div>}
        {older > 0 && period !== "sebelumnya" && <div className="kds-history"><Clock3Icon size={16} /><span><strong>{older} pesanan dari hari sebelumnya</strong> masih terbuka. Periksa sebelum melanjutkan layanan.</span><button type="button" onClick={() => { setPeriod("sebelumnya"); setSaring(new Set()); setKueri(""); }}>Lihat pesanan <ArrowRightIcon size={14} /></button></div>}
        {tampil.length === 0 ? <div className="kds-kosong">
          {hasFilter ? <SearchIcon size={32} /> : <CookingPotIcon size={36} />}
          <h3>{hasFilter ? "Tidak ada tiket yang cocok" : "Siap untuk pesanan berikutnya"}</h3>
          <p>{hasFilter ? "Coba kata pencarian, tahap, atau waktu lain." : "Pesanan yang diterima akan muncul otomatis di papan ini."}</p>
          {hasFilter && <button type="button" className="kds-reset" onClick={clear}>Tampilkan semua pesanan</button>}
        </div> : pref.pandangan === "produksi" ? <PanelProduksi baris={produksi} /> : <>
          {saring.size === 0 && held.length > 0 && <details className="kds-held"><summary><Clock3Icon size={18} /><strong>Menunggu penerimaan kasir</strong><b>{held.length}</b><span>Lihat tiket</span></summary><p>Pesanan ini belum diterima kasir. Mulai memasak setelah pesanan masuk antrean.</p><div className="kds-grid">{held.map(card)}</div></details>}
          {saring.size > 0 ? <div className="kds-grid">{tampil.map(card)}</div> : <div className="kds-lanes">
            {LANES.map(stage => { const rows = tampil.filter(t => tahapDari(t.status) === stage); const Icon = LANE_ICONS[stage as keyof typeof LANE_ICONS]; return <section className="kds-lane" data-tahap={stage} key={stage} aria-label={TAHAP[stage].label}>
              <header className="kds-lane-head"><span className="kds-lane-icon"><Icon size={18} /></span><h3>{TAHAP[stage].label}</h3><b>{String(rows.length).padStart(2, "0")}</b></header>
              <p className="kds-lane-description">{stage === "antre" ? "Pesanan masuk, siap dikerjakan" : stage === "masak" ? "Sedang disiapkan oleh dapur" : "Sentuhan terakhir, lalu antarkan"}</p>
              <div className="kds-lane-cards">{rows.length ? rows.map(card) : <div className="kds-lane-empty"><Icon size={24} /><span>{stage === "siap" ? "Belum ada yang siap diantar" : "Belum ada pesanan"}</span></div>}</div>
            </section>; })}
          </div>}

        </>}
        <footer className="kds-board-footer"><span>{tampil.length} tiket · {tampil.reduce((n, t) => n + t.items.reduce((s, i) => s + Math.max(1, i.qty ?? 1), 0), 0)} porsi</span><span>Target layanan 30 menit · Waktu WIB</span></footer>
      </div>
    </div>
    {galat && <div className="kds-galat" role="alert"><CircleAlertIcon size={18} /><span>{galat}</span><button type="button" onClick={() => setGalat(null)} aria-label="Tutup pesan"><XIcon size={18} /></button></div>}
  </div>;
}
