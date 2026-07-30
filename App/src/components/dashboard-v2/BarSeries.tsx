import type { DailyPoint } from "@/lib/dashboard-v2-reports";
import { peakIndex } from "@/lib/dashboard-v2-reports";

interface Props {
  points: DailyPoint[];
  /** Kalimat yang menjelaskan artinya. Grafik memberi bentuk, kalimat memberi arti. */
  caption: string;
  format: (value: number) => string;
  label: string;
}

/** Deret batang monokrom dengan satu batang disorot.
 *
 *  Tiga referensi berbeda melakukan hal yang sama, dan alasannya sama: seri
 *  berwarna-warni membuat mata mencari arti pada hue yang tidak membawa arti
 *  apa pun. Di sini hue nol — yang membedakan cuma tinggi, dan satu batang
 *  digelapkan karena ia yang sedang dibicarakan kalimat di bawahnya.
 *
 *  Dirender sebagai elemen biasa, bukan SVG atau kanvas: tiap batang perlu
 *  punya nama yang bisa dibaca pembaca layar, dan angka yang bisa disalin. */
export default function BarSeries({ points, caption, format, label }: Props) {
  const peak = peakIndex(points);
  const max = points.reduce((m, p) => Math.max(m, p.value), 0);

  return (
    <figure className="dv2-chart">
      <div className="dv2-bars" role="img" aria-label={`${label}. ${caption}`}>
        {points.map((p, i) => (
          <span
            key={p.day}
            className="dv2-chart-bar"
            data-peak={i === peak && p.value > 0 ? "true" : undefined}
            /* Tinggi adalah satu-satunya data yang dibawa elemen ini, jadi ia
               ditulis inline — memindahkannya ke kelas berarti membuat 100
               kelas yang isinya angka. */
            style={{ height: max > 0 ? `${Math.max(2, (p.value / max) * 100)}%` : "2px" }}
            title={`${p.label}: ${format(p.value)}`}
          />
        ))}
      </div>
      <figcaption className="dv2-chart-caption">{caption}</figcaption>
    </figure>
  );
}
