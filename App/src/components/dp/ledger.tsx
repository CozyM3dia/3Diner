import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import type { Delta } from "@/lib/dashboard-metrics";

/** Potongan bahasa ledger yang dipakai kedua lembar analitik. */

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

/** Satu angka sekunder di strip: eyebrow + nilai + baris bawah. */
export function Angka({
  label,
  nilai,
  bawah,
  icon,
}: {
  label: string;
  nilai: ReactNode;
  bawah: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="dv3-angka">
      <span className="dv3-eyebrow dv3-eyebrow-row">
        {icon && (
          <span className="dv3-icon" aria-hidden>
            {icon}
          </span>
        )}
        {label}
      </span>
      <span className="dv3-strip-val dv3-num">{nilai}</span>
      <span className="dv3-strip-sub">{bawah}</span>
    </div>
  );
}
