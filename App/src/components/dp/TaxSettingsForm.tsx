"use client";

import { useState } from "react";
import { saveTax } from "@/lib/tax-actions";

/** Tax Settings ala Dream POS `tax-settings.html`: tabel `# / Tax Name / Rate /
 *  Type / Actions`.
 *
 *  Template menyimpan banyak baris pajak (CGST, SGST, …) dan punya Add New.
 *  Kafe ini hanya punya satu konfigurasi di tabel `Cafes`
 *  (`tax_rate_pct`, `service_charge_pct`, `prices_include_tax`), jadi tabelnya
 *  berisi dua baris tetap dan tombol Add New tidak direplikasi — tak ada
 *  entitas pajak baru yang bisa dibuat.
 *
 *  Aturan berlakunya ditegakkan database lewat `set_cafe_tax`: konfigurasi
 *  pertama langsung berlaku, perubahan berikutnya berlaku besok. Halaman ini
 *  menampilkan hasil itu apa adanya, tidak menjanjikan yang lain. */

export type TaxConfig = {
  taxPct: number;
  servicePct: number;
  includedInPrice: boolean;
  configuredAt: string | null;
  pending: { taxPct: number | null; servicePct: number | null; include: boolean | null; from: string | null } | null;
};

const persen = (n: number) => `${Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export default function TaxSettingsForm({ config }: { config: TaxConfig }) {
  const [taxPct, setTaxPct] = useState(String(config.taxPct));
  const [servicePct, setServicePct] = useState(String(config.servicePct));
  const [included, setIncluded] = useState(config.includedInPrice);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; text: string } | null>(null);

  const tipe = config.includedInPrice ? "Sudah termasuk harga" : "Ditambahkan di luar harga";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setPesan(null);
    const res = await saveTax(Number(taxPct), Number(servicePct), included);
    setBusy(false);
    if (res.error) {
      setPesan({ ok: false, text: res.error });
      return;
    }
    setPesan({
      ok: true,
      text:
        res.applied === "scheduled" && res.effectiveFrom
          ? `Tersimpan. Tarif baru berlaku mulai ${tanggal(res.effectiveFrom)}.`
          : "Tersimpan dan langsung berlaku.",
    });
  }

  return (
    <>
      <div className="dp-card">
        <div className="dp-card-body">
          <div className="dp-table-wrap">
            <table className="dp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama Pajak</th>
                  <th>Tarif</th>
                  <th>Tipe</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>Pajak</td>
                  <td>{persen(config.taxPct)}</td>
                  <td>{tipe}</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>Service Charge</td>
                  <td>{persen(config.servicePct)}</td>
                  <td>{tipe}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="dp-hint dp-mt">
            {config.configuredAt
              ? `Terakhir dikonfigurasi ${tanggal(config.configuredAt)}.`
              : "Belum pernah dikonfigurasi — penyimpanan pertama langsung berlaku."}
          </p>

          {config.pending?.from && (
            <p className="dp-notice">
              Sudah ada perubahan terjadwal: pajak {persen(config.pending.taxPct ?? 0)}, service{" "}
              {persen(config.pending.servicePct ?? 0)}, berlaku mulai {tanggal(config.pending.from)}.
            </p>
          )}
        </div>
      </div>

      <div className="dp-card">
        <div className="dp-card-body">
          <form onSubmit={onSubmit}>
            <div className="dp-form-grid">
              <label className="dp-form-row">
                <span className="dp-label">Pajak (%)</span>
                <input
                  className="dp-input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={taxPct}
                  onChange={e => setTaxPct(e.target.value)}
                  required
                />
              </label>

              <label className="dp-form-row">
                <span className="dp-label">Service Charge (%)</span>
                <input
                  className="dp-input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={servicePct}
                  onChange={e => setServicePct(e.target.value)}
                  required
                />
              </label>

              <label className="dp-switch dp-col-full">
                <input
                  type="checkbox"
                  role="switch"
                  checked={included}
                  onChange={e => setIncluded(e.target.checked)}
                />
                <i />
                Harga menu sudah termasuk pajak
              </label>
            </div>

            <div className="dp-form-foot">
              {pesan && <p className={pesan.ok ? "dp-form-ok" : "dp-form-error"}>{pesan.text}</p>}
              <button type="submit" className="dp-add-btn" disabled={busy}>
                {busy ? "Menyimpan…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
