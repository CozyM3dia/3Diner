import type { CSSProperties } from "react";
import type { IrisanMix } from "@/lib/dashboard-metrics";
import { rupiah } from "@/lib/dashboard-format";

/** Komposisi bagian-terhadap-keseluruhan sebagai satu batang bertumpuk +
 *  daftar berlabel langsung. Menggantikan donat: pada batang bertumpuk,
 *  mata membandingkan panjang di satu garis, bukan sudut juring; dan daftar
 *  di bawahnya memuat angka persis, jadi warna tak pernah jadi satu-satunya
 *  pembawa identitas.
 *
 *  Server-renderable — tak ada state. Warna per irisan datang dari `warna`
 *  (semantik, mis. status) atau jatuh ke seri data berurut.
 */
export default function MixBar({
  irisan,
  dasar,
  warna,
  kosong,
}: {
  irisan: IrisanMix[];
  /** Ukuran yang menentukan panjang irisan. */
  dasar: "nilai" | "jumlah";
  /** Kelas CSS pewarna per key (mis. `dv3-mix-ok`). Tanpa ini: seri berurut. */
  warna?: Record<string, string>;
  kosong: string;
}) {
  const total = irisan.reduce((s, i) => s + (dasar === "nilai" ? i.nilai : i.jumlah), 0);
  if (!total) return <p className="dv3-annot dv3-mix-empty">{kosong}</p>;

  const kelas = (i: IrisanMix, idx: number) => warna?.[i.key] ?? `dv3-series-${Math.min(idx + 1, 5)}`;

  return (
    <div className="dv3-mix">
      <div className="dv3-mix-bar" role="img" aria-label={irisan.map((i) => `${i.label} ${Math.round(((dasar === "nilai" ? i.nilai : i.jumlah) / total) * 100)}%`).join(", ")}>
        {irisan.map((i, idx) => {
          const v = dasar === "nilai" ? i.nilai : i.jumlah;
          if (!v) return null;
          return (
            <span
              key={i.key}
              className={`dv3-mix-seg ${kelas(i, idx)}`}
              style={{ flexGrow: v, "--i": idx } as CSSProperties}
            />
          );
        })}
      </div>
      <ul className="dv3-mix-list">
        {irisan.map((i, idx) => {
          const v = dasar === "nilai" ? i.nilai : i.jumlah;
          const pangsa = Math.round((v / total) * 100);
          return (
            <li key={i.key} className="dv3-mix-row">
              <span className={`dv3-mix-key ${kelas(i, idx)}`} aria-hidden />
              <span className="dv3-mix-label">{i.label}</span>
              <span className="dv3-mix-val dv3-num">
                {dasar === "nilai" ? rupiah(i.nilai) : `${i.jumlah}`}
                <span className="dv3-mix-sub">
                  {pangsa}%{dasar === "nilai" ? ` · ${i.jumlah}×` : i.nilai ? ` · ${rupiah(i.nilai)}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
