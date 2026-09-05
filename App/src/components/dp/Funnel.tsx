import type { CSSProperties } from "react";
import { hitungRasioTerbatas, type Corong } from "@/lib/dashboard-metrics";

/** Corong tamu: dari membuka QR menu sampai uang masuk.
 *
 *  Lima langkah dari dua sumber (peristiwa ponsel tamu + Orders) disatukan
 *  ke satu skala. Setiap batang berbagi garis dasar kiri; di antara dua
 *  langkah ditulis rasio lanjutnya — angka yang sebenarnya ingin dibaca
 *  owner ("dari yang membuka menu, berapa yang memesan?"). Kolom kanan
 *  menaruh angka periode pembanding dalam tinta tipis, bukan persen delta:
 *  pada cacah yang kecil, persentase lebih dramatis daripada kenyataannya.
 */
export default function Funnel({ corong, kosong }: { corong: Corong; kosong: string }) {
  const { langkah } = corong;
  const dasar = Math.max(langkah[0]?.nilai ?? 0, ...langkah.map((l) => l.nilai), 1);
  const semuaNol = langkah.every((l) => l.nilai === 0);
  if (semuaNol) return <p className="dv3-annot dv3-mix-empty">{kosong}</p>;

  const rasio = (a: number, b: number) => {
    const nilai = hitungRasioTerbatas(a, b);
    return nilai === null ? "—" : `${Math.round(nilai * 100)}%`;
  };

  return (
    <ol className="dv3-funnel">
      {langkah.map((l, i) => {
        const sebelum = langkah[i - 1];
        const lebar = Math.max((l.nilai / dasar) * 100, l.nilai > 0 ? 1.5 : 0);
        return (
          <li key={l.key} className="dv3-funnel-row" style={{ "--i": i } as CSSProperties}>
            {sebelum && (
              <span className="dv3-funnel-step" aria-label={`Rasio lanjut dari ${sebelum.label}: ${rasio(l.nilai, sebelum.nilai)}`}>
                <i aria-hidden />
                <span className="dv3-annot">{rasio(l.nilai, sebelum.nilai)} lanjut</span>
              </span>
            )}
            <span className="dv3-funnel-label">{l.label}</span>
            <span className="dv3-funnel-track" aria-hidden>
              <i style={{ width: `${lebar}%` }} data-last={i === langkah.length - 1 ? "true" : undefined} />
            </span>
            <span className="dv3-funnel-val dv3-num">
              {l.nilai.toLocaleString("id-ID")}
              <span className="dv3-funnel-prev">{l.lalu.toLocaleString("id-ID")} sebelumnya</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
