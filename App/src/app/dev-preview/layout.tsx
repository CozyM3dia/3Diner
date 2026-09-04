import { notFound } from "next/navigation";
import "../dp.css";
import "@/components/pos/pos-item.css";
import "@/app/menu-editor.css";
import "@/app/menu-preview.css";
import "../role-pill.css";
import "../console.css";
// Lapisan kartu lembar analitik — harus setelah console.css.
import "../analitik.css";
import "../panduan.css";
import "../kitchen.css";

/** Harness visual konsol — HANYA berjalan di `next dev`.
 *
 *  Kegunaannya: memeriksa susunan, tipografi, kontras, mode gelap, dan setiap
 *  empty state tanpa menyentuh data kafe sungguhan dan tanpa perlu sesi login.
 *
 *  KEAMANAN. Rute ini berada di luar `proxy.ts` (yang hanya menjaga
 *  /dashboard, /dashboard-v2, /kasir, /dapur), jadi gerbangnya ada di sini:
 *  di luar mode development ia memanggil `notFound()`, sehingga build produksi
 *  merendernya sebagai 404. Ia juga tidak pernah menyentuh Supabase — seluruh
 *  isinya datang dari `dashboard-fixtures.ts`, sehingga tak ada data pelanggan
 *  yang bisa bocor lewat jalur ini sekalipun gerbangnya dilewati.
 */
export default function DevPreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return children;
}
