/** Pemformat angka konsol — netral (tanpa "use client"), dipakai server maupun klien. */

export const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

/** Ringkas untuk sumbu dan label langsung, tempat presisi penuh jadi derau. */
export function rupiahRingkas(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(1).replace(/\.0$/, "")} M`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "")} jt`;
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)} rb`;
  return `${s}${Math.round(a)}`;
}

/** Selisih bertanda; tandanya mendahului seluruh nilai supaya "Rp -132.000"
 *  tidak terbaca seperti salah ketik. */
export const rupiahBertanda = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${rupiah(Math.abs(n))}`;

export const persen = (x: number, digit = 0) => `${(x * 100).toFixed(digit)}%`;

/** Bentuk angka otoritatif yang dipakai figur besar lembar analitik. */
export type BentukAngka = "rupiah" | "bulat" | "persen";

/** Angka besar dipecah jadi imbuhan + besaran.
 *
 *  Alasannya tipografis, bukan kosmetik: pada 30px/700, "Rp " memakan 48%
 *  lebar "Rp 69.492" — separuh figur otoritatif dihabiskan oleh satuan, dan
 *  mata membaca dua kata alih-alih satu angka. Dengan dipisah, imbuhan bisa
 *  diturunkan ukuran, berat, dan tintanya sehingga besaran yang memimpin.
 *  Hasil `pre + num + post` selalu identik dengan `rupiah()`/`persen()`
 *  supaya teks untuk pembaca layar tidak pernah berbeda dari yang terlihat. */
export function pisahAngka(n: number, bentuk: BentukAngka): { pre: string; num: string; post: string } {
  if (bentuk === "rupiah") return { pre: "Rp", num: Math.round(n).toLocaleString("id-ID"), post: "" };
  if (bentuk === "persen") return { pre: "", num: (n * 100).toFixed(0), post: "%" };
  return { pre: "", num: Math.round(n).toLocaleString("id-ID"), post: "" };
}

/** Teks utuh dari bentuk yang sama — untuk `aria-label` dan judul. */
export function teksAngka(n: number, bentuk: BentukAngka): string {
  if (bentuk === "rupiah") return rupiah(n);
  if (bentuk === "persen") return persen(n);
  return Math.round(n).toLocaleString("id-ID");
}

export const fmtTanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
export const fmtTanggalPanjang = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });
export const fmtJam = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });
export const fmtHariTanggal = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short" });

export const jamLabel = (h: number) => `${String(h).padStart(2, "0")}.00`;
