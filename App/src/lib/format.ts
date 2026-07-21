/** Escape teks sebelum disisipkan ke string HTML yang dirakit manual
 *  (mis. struk yang ditulis via document.write). Wajib untuk semua nilai
 *  yang berasal dari input publik. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format angka ke Rupiah (id-ID, tanpa desimal). */
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
