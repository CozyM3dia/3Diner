/** Pengaturan tampilan struk termal (modul "Receipt Settings").
 *
 *  Satu objek disimpan ke `Cafes.receipt_settings` (jsonb). Setiap kunci
 *  mengendalikan satu blok NYATA di `buildReceiptHtml` — tidak ada sakelar
 *  hias: kalau toggle ada, struk hasil cetak benar-benar berubah.
 *  `receipt_settings` NULL / rusak = `DEFAULT_RECEIPT_SETTINGS` (perilaku
 *  cetak lama 1:1, semua blok klasik menyala). */

export interface ReceiptSettings {
  /* Header */
  show_logo: boolean;
  show_business_name: boolean;
  show_address: boolean;
  show_powered_by: boolean;
  show_receipt_number: boolean;
  show_datetime: boolean;
  show_table_number: boolean;
  show_cashier: boolean;
  show_payment_method: boolean;
  show_payment_status: boolean;
  /* Body */
  show_items: boolean;
  show_unit_prices: boolean;
  show_item_notes: boolean;
  show_subtotal: boolean;
  show_service: boolean;
  show_tax: boolean;
  show_total: boolean;
  show_order_notes: boolean;
  /* Footer */
  show_thankyou: boolean;
  show_print_datetime: boolean;
  /** Teks kustom di atas ucapan penutup. Kosong = tidak dicetak. */
  footer_note: string;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  show_logo: true,
  show_business_name: true,
  show_address: true,
  show_powered_by: true,
  show_receipt_number: true,
  show_datetime: true,
  show_table_number: true,
  show_cashier: true,
  show_payment_method: true,
  show_payment_status: true,
  show_items: true,
  show_unit_prices: true,
  show_item_notes: true,
  show_subtotal: true,
  show_service: true,
  show_tax: true,
  show_total: true,
  show_order_notes: true,
  show_thankyou: true,
  show_print_datetime: true,
  footer_note: "",
};

const BOOL_KEYS = Object.keys(DEFAULT_RECEIPT_SETTINGS).filter(
  (k) => k !== "footer_note",
) as Array<Exclude<keyof ReceiptSettings, "footer_note">>;

/** Ambil hanya kunci yang dikenal, paksa boolean/string — sisanya dibuang.
 *  Aman dipanggil dengan `Cafes.receipt_settings` apa pun (null, rusak,
 *  diubah tangan di DB, atau berisi kunci versi lama). */
export function normalizeReceiptSettings(raw: unknown): ReceiptSettings {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_RECEIPT_SETTINGS };
  for (const k of BOOL_KEYS) {
    if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  }
  if (typeof src.footer_note === "string") {
    out.footer_note = src.footer_note.slice(0, 160);
  }
  return out;
}

/** Cek "ada perubahan belum disimpan" — urutan kunci dibakukan agar
 *  perbandingan JSON stabil. */
export function sameReceiptSettings(a: ReceiptSettings, b: ReceiptSettings): boolean {
  return JSON.stringify(normalizeReceiptSettings(a)) === JSON.stringify(normalizeReceiptSettings(b));
}
