import { escapeHtml } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import type { OrderItem } from "@/types";

/** Bentuk minimum yang dibutuhkan struk. Sengaja tidak memakai `Order` utuh
 *  supaya baris pesanan dari mana pun bisa dicetak tanpa mengarang field. */
export interface ReceiptOrder {
  id_order: string;
  table_number: string;
  items: OrderItem[];
  total: number;
  payment_method: string | null;
  payment_status: string;
  created_at: string;
  notes?: string | null;
  subtotal?: number;
  tax_pct?: number;
  tax_amount?: number;
  service_pct?: number;
  service_amount?: number;
  prices_include_tax?: boolean;
}

export interface ReceiptCafe {
  name: string;
  address?: string | null;
  /** Nomor pokok wajib pajak daerah. Dicetak kalau ada — pemeriksa pajak
   *  mencarinya di kepala struk. */
  taxId?: string | null;
  /** `false` = pemilik belum pernah memutuskan tarif. Struk tetap mencetak
   *  baris pajak, tapi mengatakan bahwa tarifnya belum diatur. */
  taxConfigured?: boolean;
}

const rupiah = (n: number) => n.toLocaleString("id-ID");

/** 32 karakter = aman untuk termal 80mm pada 11px monospace. */
const D = "================================";
const S = "--------------------------------";

function row(label: string, value: string, bold = false): string {
  const weight = bold ? "font-weight:900;" : "";
  return `<tr><td style="${weight}">${label}</td><td style="text-align:right;white-space:nowrap;${weight}">${value}</td></tr>`;
}

/** Struk termal 80mm.
 *
 *  Dirakit sebagai STRING lalu ditulis ke iframe same-origin, jadi ia bukan
 *  React dan tidak dapat escaping gratis: setiap nilai teks yang disisipkan
 *  WAJIB lewat `escapeHtml`. `table_number`, `notes`, dan nama menu berasal dari
 *  `POST /api/orders` yang publik.
 */
export function buildReceiptHtml(order: ReceiptOrder, cafe: ReceiptCafe): string {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const items = Array.isArray(order.items) ? order.items : [];

  const payLabel = order.payment_method ? paymentMethodLabel(order.payment_method) : "-";
  const statusLabel = order.payment_status === "paid" ? "LUNAS" : "BELUM BAYAR";

  const itemRows = items
    .map((it) => {
      const price = rupiah(it.harga_menu);
      const sub = rupiah(it.harga_menu * it.qty);
      const variants = it.options?.length
        ? `<tr><td colspan="2" style="padding-left:12px;font-size:10px;color:#333;">${escapeHtml(
            it.options.map((o) => o.name).join(", ")
          )}</td></tr>`
        : "";
      // Catatan per item dicetak di struk dapur juga: ia mengubah cara memasak,
      // dan pesan yang hanya ada di layar hilang begitu layarnya berganti.
      const note = it.notes
        ? `<tr><td colspan="2" style="padding-left:12px;font-size:10px;font-weight:600;">* ${escapeHtml(
            it.notes
          )}</td></tr>`
        : "";
      return `
      <tr><td colspan="2" style="font-weight:600;padding-top:3px;">${it.qty}x ${escapeHtml(
        String(it.nama_menu ?? "")
      )}</td></tr>${variants}${note}
      <tr>
        <td style="padding-left:12px;font-size:10.5px;color:#333;">${it.qty} x Rp ${price}</td>
        <td style="text-align:right;font-weight:600;white-space:nowrap;">Rp ${sub}</td>
      </tr>`;
    })
    .join("");

  const subtotal = order.subtotal ?? order.total;
  const service = order.service_amount ?? 0;
  const tax = order.tax_amount ?? 0;
  const taxPct = order.tax_pct ?? 0;
  const servicePct = order.service_pct ?? 0;

  /* Baris pajak SELALU dicetak, termasuk saat nol.
     Struk lama mencetak total tanpa menyebut pajak sama sekali, sehingga nol
     yang belum diputuskan tidak bisa dibedakan dari nol yang dipilih. Nol yang
     dipilih harus tertulis sebagai nol. */
  const taxNote =
    cafe.taxConfigured === false ? ' <span style="font-size:9px;">(belum diatur)</span>' : "";

  const chargeRows = [
    row("Subtotal", `Rp ${rupiah(subtotal)}`),
    service > 0 || servicePct > 0
      ? row(`Layanan ${servicePct}%`, `Rp ${rupiah(service)}`)
      : "",
    row(
      `Pajak ${taxPct}%${order.prices_include_tax ? " (termasuk)" : ""}${taxNote}`,
      `Rp ${rupiah(tax)}`
    ),
  ]
    .filter(Boolean)
    .join("");

  const notesBlock = order.notes
    ? `<div style="border:1px dashed #000;padding:4px 5px;margin:5px 0;font-size:10.5px;word-break:break-word;"><b>** CATATAN **</b><br>${escapeHtml(
        order.notes
      )}</div>`
    : "";

  const orderId = escapeHtml(order.id_order.slice(-8).toUpperCase());
  const cafeName = escapeHtml(cafe.name);
  const table = escapeHtml(String(order.table_number ?? ""));
  const address = cafe.address ? `<div class="sub">${escapeHtml(cafe.address)}</div>` : "";
  const taxId = cafe.taxId ? `<div class="sub">NPWPD ${escapeHtml(cafe.taxId)}</div>` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Struk #${orderId}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{
    font-family:'Courier New',Courier,'Lucida Console',monospace;
    font-size:11.5px;
    line-height:1.5;
    color:#000;
    background:#fff;
    width:80mm;
    max-width:80mm;
  }
  body{ padding:4mm 4mm 12mm; }
  .c{text-align:center;}
  .sep{font-size:11px;margin:3px 0;letter-spacing:0;}
  .cafe{font-size:15px;font-weight:bold;text-align:center;letter-spacing:2px;text-transform:uppercase;}
  .sub{font-size:9.5px;text-align:center;color:#444;margin-bottom:2px;}
  .meja{font-size:24px;font-weight:900;text-align:center;margin:4px 0 3px;letter-spacing:1px;}
  .meta{font-size:10.5px;margin:1.5px 0;display:flex;justify-content:space-between;}
  .meta b{min-width:56px;display:inline-block;}
  table{width:100%;border-collapse:collapse;}
  td{padding:0;font-size:11px;vertical-align:top;}
  .total-row td{font-size:13px;font-weight:900;padding-top:5px;}
  .status-paid{font-weight:900;font-size:12px;text-align:center;
    border:2px solid #000;padding:2px 6px;display:inline-block;letter-spacing:2px;}
  .footer{text-align:center;font-size:10px;margin-top:2px;color:#333;}
  @media print{
    html,body{width:80mm;max-width:80mm;padding:0 3mm 14mm;}
    @page{size:80mm auto;margin:0;}
  }
</style>
</head>
<body>
  <div class="cafe">${cafeName}</div>
  ${address}
  ${taxId}
  <div class="sub">Powered by 3Diner</div>
  <div class="sep c">${D}</div>
  <div class="meja">MEJA ${table}</div>
  <div class="sep c">${S}</div>
  <div class="meta"><b>No.</b> <span>#${orderId}</span></div>
  <div class="meta"><b>Tgl</b> <span>${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</span></div>
  <div class="meta"><b>Bayar</b> <span>${escapeHtml(payLabel)}</span></div>
  <div class="meta"><b>Status</b> <span class="status-paid">${statusLabel}</span></div>
  <div class="sep c">${D}</div>
  <table><tbody>${itemRows}</tbody></table>
  <div class="sep c">${S}</div>
  <table><tbody>
    ${chargeRows}
    <tr class="total-row"><td>TOTAL</td><td style="text-align:right;">Rp ${rupiah(order.total)}</td></tr>
  </tbody></table>
  ${notesBlock}
  <div class="sep c">${D}</div>
  <div class="footer">Terima kasih sudah mampir!</div>
  <div style="height:10mm;"></div>
</body>
</html>`;
}

/** Mencetak lewat iframe tersembunyi.
 *
 *  Dipisah dari perakitan HTML supaya perakitannya bisa diuji tanpa DOM. */
export function printReceipt(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 1500);
  }, 350);
}
