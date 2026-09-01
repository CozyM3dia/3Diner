"use client";

import { useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { saveTax } from "@/lib/tax-actions";

/** Tax Settings — recreation 1:1 `tax-settings.html` Dream POS:
 *  kartu tabel `# / Nama Pajak / Tarif / Tipe / Actions` + tombol "+ Add New"
 *  yang membuka modal "Add Tax" (Title, Tax Rate %, Tax Type) dengan
 *  Cancel/Save. Edit memakai modal yang sama, terisi nilai barisnya.
 *
 *  Perbedaan jujur dari template (backend kafe ini beda bentuk): data pajak
 *  tersimpan sebagai SATU konfigurasi di `Cafes` (pajak + service charge),
 *  bukan tabel baris pajak banyak. Jadi tabel menampilkan dua baris tetap,
 *  Add New membuka modal yang mengisi pajak utama, dan Delete mengosongkan
 *  tarif (set ke 0) — bukan menghapus baris. Aturan berlakunya ditegakkan
 *  database lewat `set_cafe_tax`: konfigurasi pertama langsung berlaku,
 *  perubahan berikutnya berlaku besok. Halaman menyampaikan itu apa adanya. */

export type TaxConfig = {
  taxPct: number;
  servicePct: number;
  includedInPrice: boolean;
  configuredAt: string | null;
  pending: { taxPct: number | null; servicePct: number | null; include: boolean | null; from: string | null } | null;
};

type ModalState =
  | null
  | { mode: "add" }
  | { mode: "edit"; row: "tax" | "service" };

const persen = (n: number) => `${Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export default function TaxSettingsForm({ config }: { config: TaxConfig }) {
  const [modal, setModal] = useState<ModalState>(null);
  const [title, setTitle] = useState("");
  const [rate, setRate] = useState("");
  const [type, setType] = useState<"" | "inclusive" | "exclusive">("");
  const [busy, setBusy] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [pesan, setPesan] = useState<{ ok: boolean; text: string } | null>(null);

  const tipeLabel = (include: boolean) => (include ? "Inclusive" : "Exclusive");

  function bukaAdd() {
    setModal({ mode: "add" });
    setTitle("");
    setRate("");
    setType("");
    setModalErr(null);
  }

  function bukaEdit(row: "tax" | "service") {
    setModal({ mode: "edit", row });
    setTitle(row === "tax" ? "Pajak" : "Service Charge");
    setRate(String(row === "tax" ? config.taxPct : config.servicePct));
    setType(config.includedInPrice ? "inclusive" : "exclusive");
    setModalErr(null);
  }

  async function simpanModal() {
    const rateNum = Number(rate);
    if (!title.trim()) { setModalErr("Title wajib diisi."); return; }
    if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) {
      setModalErr("Tax Rate harus angka antara 0 dan 100.");
      return;
    }
    if (!type) { setModalErr("Pilih Tax Type dulu."); return; }

    setBusy(true);
    setModalErr(null);
    // Satu konfigurasi kafe: baris pajak membawa tarif pajak, "service charge"
    // membawa service charge; tipe inclusive/exclusive berlaku untuk keduanya
    // (satu kolom prices_include_tax di DB).
    const isTaxRow = modal?.mode === "edit" ? modal.row === "tax" : title.trim().toLowerCase() !== "service charge";
    const taxPct = isTaxRow ? rateNum : config.taxPct;
    const servicePct = isTaxRow ? config.servicePct : rateNum;
    const included = type === "inclusive";
    const res = await saveTax(taxPct, servicePct, included);
    setBusy(false);
    if (res.error) {
      setModalErr(res.error);
      return;
    }
    setModal(null);
    setPesan({
      ok: true,
      text:
        res.applied === "scheduled" && res.effectiveFrom
          ? `Tersimpan. Tarif baru berlaku mulai ${tanggal(res.effectiveFrom)}.`
          : "Tersimpan dan langsung berlaku.",
    });
  }

  async function hapus(row: "tax" | "service") {
    setBusy(true);
    setPesan(null);
    const res = await saveTax(
      row === "tax" ? 0 : config.taxPct,
      row === "service" ? 0 : config.servicePct,
      config.includedInPrice,
    );
    setBusy(false);
    setPesan(
      res.error
        ? { ok: false, text: res.error }
        : { ok: true, text: `${row === "tax" ? "Pajak" : "Service Charge"} dikosongkan (0%).` },
    );
  }

  const rows: Array<{ key: "tax" | "service"; nama: string; rate: number }> = [
    { key: "tax", nama: "Pajak", rate: config.taxPct },
    { key: "service", nama: "Service Charge", rate: config.servicePct },
  ];

  return (
    <>
      {/* ── Kartu tabel pajak ala template ── */}
      <div className="dp-card">
        <div className="dp-card-head">
          <h2 className="dp-card-title">Daftar Pajak</h2>
          <button type="button" className="dp-add-btn" onClick={bukaAdd}>
            <PlusIcon className="h-4 w-4" /> Add New
          </button>
        </div>
        <div className="dp-card-body">
          <div className="dp-table-wrap">
            <table className="dp-table dp-tax-table">
              <thead>
                <tr>
                  <th className="dp-tax-num">#</th>
                  <th>Nama Pajak</th>
                  <th>Tarif</th>
                  <th>Tipe</th>
                  <th className="dp-tax-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <td className="dp-tax-num">{i + 1}</td>
                    <td>{r.nama}</td>
                    <td>{persen(r.rate)}</td>
                    <td>{tipeLabel(config.includedInPrice)}</td>
                    <td className="dp-tax-actions-col">
                      <span className="dp-tax-actions">
                        <button
                          type="button"
                          className="dp-round-btn"
                          aria-label={`Edit ${r.nama}`}
                          disabled={busy}
                          onClick={() => bukaEdit(r.key)}
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="dp-round-btn dp-round-btn-danger"
                          aria-label={`Hapus ${r.nama}`}
                          disabled={busy}
                          onClick={() => hapus(r.key)}
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
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

          {pesan && (
            <p className={pesan.ok ? "dp-form-ok dp-mt" : "dp-form-error dp-mt"} role="status">
              {pesan.text}
            </p>
          )}
        </div>
      </div>

      {/* ── Modal Add/Edit Tax — ala template "Add Tax" ── */}
      {modal && (
        <div className="dp-tax-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div
            className="dp-tax-modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal.mode === "add" ? "Add Tax" : "Edit Tax"}
          >
            <div className="dp-tax-modal-head">
              <h3>{modal.mode === "add" ? "Add Tax" : "Edit Tax"}</h3>
              <button type="button" className="dp-tax-modal-x" aria-label="Tutup" onClick={() => setModal(null)}>
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <label className="dp-tax-field">
              <span>Title<b>*</b></span>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="mis. Pajak Restoran"
                maxLength={60}
              />
            </label>

            <label className="dp-tax-field">
              <span>Tax Rate (%)<b>*</b></span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={rate}
                onChange={e => setRate(e.target.value)}
                placeholder="mis. 10"
              />
            </label>

            <label className="dp-tax-field">
              <span>Tax Type<b>*</b></span>
              <span className="dp-tax-select-wrap">
                <select
                  value={type}
                  onChange={e => setType(e.target.value as "" | "inclusive" | "exclusive")}
                >
                  <option value="">Select</option>
                  <option value="inclusive">Inclusive — sudah termasuk harga</option>
                  <option value="exclusive">Exclusive — ditambahkan di luar harga</option>
                </select>
              </span>
            </label>

            {modalErr && <p className="dp-form-error dp-tax-err" role="alert">{modalErr}</p>}

            <div className="dp-tax-modal-foot">
              <button type="button" className="dp-tax-btn" onClick={() => setModal(null)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="dp-tax-btn dp-tax-btn-primary" onClick={simpanModal} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
