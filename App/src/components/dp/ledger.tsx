import Link from "next/link";
import { ArrowRightIcon, MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import type { Delta } from "@/lib/dashboard-metrics";
import { pisahAngka, teksAngka, type BentukAngka } from "@/lib/dashboard-format";

/** Potongan bahasa ledger yang dipakai kedua lembar analitik. */

/** Figur angka statis — pasangan server dari `AngkaHidup`.
 *
 *  Menulis satuan dan besaran sebagai satu untai teks membuat "Rp" berdiri
 *  setara dengan angkanya: pada figur hero lama (40px/700), "Rp " memakan
 *  55.4px dari 233.9px — 24% lebar total, dengan berat yang sama persis.
 *  Dipisah, satuan bisa turun ke 0.58em dan tinta ketiga, dan yang memimpin
 *  kembali besarannya. */
export function Nilai({
  nilai,
  bentuk = "rupiah",
  className,
}: {
  nilai: number;
  bentuk?: BentukAngka;
  className?: string;
}) {
  const { pre, num, post } = pisahAngka(nilai, bentuk);
  return (
    <strong className={`an-fig ${className ?? ""}`} aria-label={teksAngka(nilai, bentuk)}>
      {pre && (
        <i className="an-fig-pre" aria-hidden>
          {pre}
        </i>
      )}
      <span aria-hidden>{num}</span>
      {post && (
        <i className="an-fig-post" aria-hidden>
          {post}
        </i>
      )}
    </strong>
  );
}

/** Delta nyata: dihitung dari periode setara sebelumnya, tidak pernah dikarang. */
export function DeltaTag({ delta, satuan }: { delta: Delta; satuan: string }) {
  if (delta.pct === null) {
    // Periode pembanding nol. Persentase apa pun di sini bohong: "+100%" dan
    // "∞" sama-sama mengarang basis yang tidak ada.
    return (
      <span className="dv3-delta dv3-delta-flat">
        {delta.arah === "up" ? "Tanpa pembanding" : `Belum ada ${satuan}`}
      </span>
    );
  }
  const Icon = delta.arah === "up" ? TrendingUpIcon : delta.arah === "down" ? TrendingDownIcon : MinusIcon;
  const cls = delta.arah === "up" ? "dv3-delta-up" : delta.arah === "down" ? "dv3-delta-down" : "dv3-delta-flat";
  return (
    <span className={`dv3-delta ${cls}`}>
      <Icon aria-hidden />
      {delta.pct > 0 ? "+" : ""}
      {delta.pct.toFixed(1)}%
    </span>
  );
}

export function Kosong({ judul, isi, aksi }: { judul: string; isi: string; aksi?: { label: string; href: string } }) {
  return (
    <div className="dv3-empty">
      <p className="dv3-empty-title">{judul}</p>
      <p className="dv3-empty-body">{isi}</p>
      {aksi && (
        <Link href={aksi.href as never} className="dv3-btn">
          {aksi.label}
          <ArrowRightIcon />
        </Link>
      )}
    </div>
  );
}
