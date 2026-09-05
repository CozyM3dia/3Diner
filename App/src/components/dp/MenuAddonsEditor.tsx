"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  ADDON_PRESETS,
  MAX_ADDON_NAME,
  MAX_GROUPS,
  MAX_VALUES_PER_GROUP,
  addonIssues,
  addonKey,
  addonPriceSpan,
  applyRule,
  emptyGroup,
  emptyValue,
  normalizeGroup,
  presetToGroup,
  pruneAddonDrafts,
  ruleOf,
  type AddonGroupDraft,
  type AddonRule,
} from "@/lib/menu-addon-drafts";

/** Tab "Tambahan" di editor menu — dulu halaman tersendiri (/dashboard-v2/addons).
 *
 *  Kenapa dipindah: sebuah addon TIDAK punya arti sendirian. "Upsize +6.000"
 *  hanya bisa dinilai sambil melihat harga menunya, dan "Wajib pilih ukuran"
 *  mengubah harga yang dilihat tamu di kartu katalog. Di halaman terpisah,
 *  pemilik menyetel keduanya secara buta lewat dropdown menu; di sini keduanya
 *  ada di satu layar, di sebelah pratinjau telepon yang menunjukkan akibatnya.
 *
 *  Bentuknya sengaja FORMULIR BIASA, sebahasa dengan tab Umum: label di atas
 *  kolom, kolom yang kelihatan seperti kolom, dan daftar pilihan sebagai tabel
 *  berjudul kolom. Tidak ada kartu kosong berhias atau tombol berbentuk pil —
 *  ini layar kerja yang dibuka berulang kali, bukan layar sambutan.
 *
 *  Kenapa min_select/max_select tidak dihadapkan mentah: angka itu tidak
 *  menjawab pertanyaan yang sebenarnya dipunya pemilik — "tamu boleh melewati
 *  ini atau tidak?". Satu dropdown aturan menjawabnya; batas angka baru muncul
 *  saat memang ada yang perlu dibatasi (pilih banyak).
 *
 *  Penyimpanan menumpang tombol Simpan menu (satu tombol, satu keadaan), lewat
 *  RPC `replace_menu_options` yang menulis ulang seluruh grup menu ini. */

export type MenuAddonsEditorProps = {
  groups: AddonGroupDraft[];
  /** Harga menu berjalan — dipakai menghitung rentang harga akhir tamu. */
  basePrice: number;
  onChange: (groups: AddonGroupDraft[]) => void;
};

const RULES: Array<{ key: AddonRule; label: string; hint: string }> = [
  { key: "wajib", label: "Wajib pilih satu", hint: "Tamu harus memilih satu sebelum bisa memesan." },
  { key: "opsional", label: "Opsional — boleh dilewati", hint: "Tamu boleh memilih satu, boleh melewatinya." },
  { key: "banyak", label: "Boleh pilih beberapa", hint: "Tamu mencentang beberapa sekaligus." },
];

const rupiah = (n: number) => `Rp ${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;

function deltaLabel(n: number): string {
  if (n === 0) return "gratis";
  return `${n > 0 ? "+" : "−"}${rupiah(n)}`;
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Kolom rupiah yang menampilkan pemisah ribuan saat diam, tapi angka telanjang
 *  saat difokus — memformat ulang di tiap ketukan akan melompatkan kursor ke
 *  ujung dan membuat penyuntingan di tengah angka mustahil. */
function PriceInput({
  value,
  label,
  invalid,
  onChange,
}: {
  value: number;
  label: string;
  invalid: boolean;
  onChange: (n: number) => void;
}) {
  const [fokus, setFokus] = useState(false);
  const [buffer, setBuffer] = useState("");

  const tampil = fokus ? buffer : value === 0 ? "" : value.toLocaleString("id-ID");

  return (
    <div className={`dp-adn-money${invalid ? " dp-adn-money-bad" : ""}`}>
      <span className="dp-adn-money-pre" aria-hidden>Rp</span>
      <input
        className="dp-adn-money-in"
        inputMode="numeric"
        aria-label={label}
        placeholder="0"
        value={tampil}
        onFocus={() => {
          setBuffer(value === 0 ? "" : String(value));
          setFokus(true);
        }}
        onBlur={() => setFokus(false)}
        onChange={e => {
          const bersih = e.target.value.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "");
          setBuffer(bersih);
          const n = bersih === "" || bersih === "-" ? 0 : Number(bersih);
          onChange(Number.isFinite(n) ? Math.trunc(n) : 0);
        }}
      />
    </div>
  );
}

export default function MenuAddonsEditor({ groups, basePrice, onChange }: MenuAddonsEditorProps) {
  const [tutup, setTutup] = useState<Set<string>>(new Set());
  // Grup yang baru dibuat mendapat fokus otomatis: menambah grup lalu harus
  // mencari kolom namanya sendiri adalah gesekan yang tidak perlu ada.
  const [grupBaru, setGrupBaru] = useState<string | null>(null);

  const bersih = useMemo(() => pruneAddonDrafts(groups), [groups]);
  const issues = useMemo(() => addonIssues(bersih), [bersih]);
  const span = useMemo(() => addonPriceSpan(basePrice, bersih), [basePrice, bersih]);

  const issueGrup = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of issues) if (!i.valueKey && !m.has(i.groupKey)) m.set(i.groupKey, i.message);
    return m;
  }, [issues]);
  const issueNilai = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of issues) if (i.valueKey && !m.has(i.valueKey)) m.set(i.valueKey, i.message);
    return m;
  }, [issues]);

  const totalPilihan = groups.reduce((s, g) => s + g.values.length, 0);
  const penuh = groups.length >= MAX_GROUPS;

  function patchGroup(key: string, fn: (g: AddonGroupDraft) => AddonGroupDraft) {
    onChange(groups.map(g => (g.key === key ? normalizeGroup(fn(g)) : g)));
  }

  function tambahGrup(g: AddonGroupDraft) {
    if (penuh) return;
    setGrupBaru(g.key);
    onChange([...groups, g]);
  }

  function gandakanGrup(g: AddonGroupDraft) {
    if (penuh) return;
    const salinan: AddonGroupDraft = {
      ...g,
      key: addonKey("g"),
      name: `${g.name} (salinan)`.slice(0, MAX_ADDON_NAME),
      values: g.values.map(v => ({ ...v, key: addonKey("v") })),
    };
    const i = groups.findIndex(x => x.key === g.key);
    const next = [...groups];
    next.splice(i + 1, 0, salinan);
    setGrupBaru(salinan.key);
    onChange(next);
  }

  function toggleTutup(key: string) {
    setTutup(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const presetTersisa = ADDON_PRESETS.filter(
    p => !groups.some(g => g.name.trim().toLowerCase() === p.label.toLowerCase()),
  );

  /* Baris tambah grup dipakai sama persis saat daftar kosong maupun terisi.
     Layar kosong yang punya tata letaknya sendiri memaksa pemilik belajar dua
     tempat untuk satu tindakan yang sama. */
  const barisTambah = (
    <div className="dp-adn-add">
      <button
        type="button"
        className="dp-adn-addbtn"
        disabled={penuh}
        onClick={() => tambahGrup(emptyGroup())}
      >
        <PlusIcon className="h-4 w-4" aria-hidden /> Tambah Grup
      </button>

      {presetTersisa.length > 0 && !penuh && (
        <span className="dp-menuf-selectwrap dp-adn-preset">
          <select
            aria-label="Tambah grup dari cetakan"
            value=""
            onChange={e => {
              const p = ADDON_PRESETS.find(x => x.label === e.target.value);
              if (p) tambahGrup(presetToGroup(p));
            }}
          >
            <option value="">Dari cetakan…</option>
            {presetTersisa.map(p => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
        </span>
      )}

      {penuh && <span className="dp-menuf-hint">Batas {MAX_GROUPS} grup per menu tercapai.</span>}
    </div>
  );

  return (
    <section className="dp-menuf-card" aria-label="Tambahan menu">
      <div className="dp-adn-head">
        <h2 className="dp-menuf-title" style={{ margin: 0 }}>Tambahan &amp; Varian</h2>
        {groups.length > 0 && (
          <span className="dp-adn-count">{groups.length} grup · {totalPilihan} pilihan</span>
        )}
      </div>
      <p className="dp-menuf-hint">
        Grup pilihan yang ditanyakan ke tamu saat memesan, misalnya Ukuran atau Topping.
      </p>

      {/* Rentang harga memakai blok yang sama dengan "Harga setelah diskon" di
          tab Digital Menu — satu bahasa untuk satu jenis informasi: angka yang
          dihitung sistem, bukan diisi pemilik. */}
      {basePrice > 0 && bersih.length > 0 && (
        <div className="dp-menuf-effective dp-adn-span" role="status">
          <span className="dp-menuf-eff-label">Harga yang dibayar tamu</span>
          <b className="dp-menuf-eff-val">
            {span.adaRentang ? `${rupiah(span.min)} – ${rupiah(span.max)}` : rupiah(span.min)}
          </b>
          <span className="dp-menuf-eff-detail">
            {span.min > basePrice
              ? `Lantai harga naik dari ${rupiah(basePrice)} — ada grup wajib berbayar.`
              : span.adaRentang
                ? `Harga dasar ${rupiah(basePrice)} + pilihan tamu.`
                : "Semua pilihan gratis."}
          </span>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="dp-adn-none">Menu ini belum punya grup pilihan.</p>
      ) : (
        <div className="dp-adn-list">
          {groups.map((g, gi) => {
            const rule = ruleOf(g);
            const terbuka = !tutup.has(g.key);
            const salah = issueGrup.get(g.key);
            const adaSalahNilai = g.values.some(v => issueNilai.has(v.key));
            const aktif = g.values.filter(v => v.is_active).length;
            const idNama = `adn-${g.key}-nama`;
            const idAturan = `adn-${g.key}-aturan`;

            return (
              <fieldset
                key={g.key}
                aria-label={`Grup ${gi + 1}${g.name.trim() ? `: ${g.name.trim()}` : ""}`}
                className={`dp-adn-group${salah || adaSalahNilai ? " dp-adn-group-bad" : ""}`}
              >
                <div className="dp-adn-ghead">
                  {/* Nomor grup selalu ada; namanya menyusul HANYA saat terlipat —
                      saat terbuka, kolom "Nama Grup" tepat di bawahnya sudah
                      menyebutkannya, dan mengulangnya dua kali cuma bising. */}
                  <span className="dp-adn-gtitle">
                    Grup {gi + 1}
                    {!terbuka && g.name.trim() ? ` · ${g.name.trim()}` : ""}
                  </span>
                  <div className="dp-adn-gtools">
                    <button
                      type="button"
                      className="dp-adn-icon"
                      title="Naikkan grup"
                      aria-label={`Naikkan grup ${gi + 1}`}
                      disabled={gi === 0}
                      onClick={() => onChange(move(groups, gi, gi - 1))}
                    >
                      <ArrowUpIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="dp-adn-icon"
                      title="Turunkan grup"
                      aria-label={`Turunkan grup ${gi + 1}`}
                      disabled={gi === groups.length - 1}
                      onClick={() => onChange(move(groups, gi, gi + 1))}
                    >
                      <ArrowDownIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="dp-adn-icon"
                      title="Gandakan grup"
                      aria-label={`Gandakan grup ${gi + 1}`}
                      disabled={penuh}
                      onClick={() => gandakanGrup(g)}
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="dp-adn-icon dp-adn-icon-bad"
                      title="Hapus grup"
                      aria-label={`Hapus grup ${gi + 1}`}
                      onClick={() => onChange(groups.filter(x => x.key !== g.key))}
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className={`dp-adn-icon dp-adn-fold${terbuka ? " dp-adn-fold-open" : ""}`}
                      aria-expanded={terbuka}
                      aria-label={terbuka ? `Tutup grup ${gi + 1}` : `Buka grup ${gi + 1}`}
                      onClick={() => toggleTutup(g.key)}
                    >
                      <ChevronDownIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {!terbuka ? (
                  <p className="dp-adn-sum">
                    {RULES.find(r => r.key === rule)?.label} · {g.values.length} pilihan
                    {aktif !== g.values.length ? ` (${aktif} tampil)` : ""} ·{" "}
                    {g.values.slice(0, 4).map(v => `${v.name.trim() || "…"} ${deltaLabel(v.price_delta)}`).join(", ")}
                    {g.values.length > 4 ? " …" : ""}
                  </p>
                ) : (
                  <>
                    <div className="dp-menuf-grid">
                      <div>
                        <label className="dp-menuf-label" htmlFor={idNama}>
                          Nama Grup <b className="dp-menuf-req">*</b>
                        </label>
                        <input
                          id={idNama}
                          className={`dp-menuf-input${salah ? " dp-menuf-bad" : ""}`}
                          value={g.name}
                          maxLength={MAX_ADDON_NAME}
                          placeholder="mis. Ukuran"
                          autoFocus={grupBaru === g.key}
                          onChange={e => patchGroup(g.key, x => ({ ...x, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="dp-menuf-label" htmlFor={idAturan}>Aturan Pilihan</label>
                        <span className="dp-menuf-selectwrap">
                          <select
                            id={idAturan}
                            value={rule}
                            onChange={e => patchGroup(g.key, x => applyRule(x, e.target.value as AddonRule))}
                          >
                            {RULES.map(r => (
                              <option key={r.key} value={r.key}>{r.label}</option>
                            ))}
                          </select>
                        </span>
                        <p className="dp-menuf-hint">{RULES.find(r => r.key === rule)?.hint}</p>
                      </div>
                    </div>

                    {rule === "banyak" && (
                      <div className="dp-menuf-grid dp-adn-limits">
                        <div>
                          <label className="dp-menuf-label" htmlFor={`${idAturan}-min`}>
                            Minimal Dipilih
                          </label>
                          <input
                            id={`${idAturan}-min`}
                            className="dp-menuf-input"
                            type="number"
                            min={0}
                            max={g.max_select}
                            value={g.min_select}
                            onChange={e => patchGroup(g.key, x => ({ ...x, min_select: Number(e.target.value) || 0 }))}
                          />
                        </div>
                        <div>
                          <label className="dp-menuf-label" htmlFor={`${idAturan}-max`}>
                            Maksimal Dipilih
                          </label>
                          <input
                            id={`${idAturan}-max`}
                            className="dp-menuf-input"
                            type="number"
                            min={1}
                            max={Math.min(g.values.length || 1, MAX_VALUES_PER_GROUP)}
                            value={g.max_select}
                            onChange={e => patchGroup(g.key, x => ({ ...x, max_select: Number(e.target.value) || 1 }))}
                          />
                        </div>
                      </div>
                    )}

                    {salah && (
                      <p className="dp-menuf-err" role="alert">
                        <TriangleAlertIcon className="h-3.5 w-3.5" aria-hidden /> {salah}
                      </p>
                    )}

                    <p className="dp-menuf-label">Daftar Pilihan</p>
                    <div className="dp-adn-table">
                      <div className="dp-adn-thead" aria-hidden>
                        <span>Nama Pilihan</span>
                        <span>Selisih Harga</span>
                        <span className="dp-adn-c">Tampil</span>
                        <span className="dp-adn-c">Aksi</span>
                      </div>

                      {g.values.length === 0 && (
                        <p className="dp-adn-none dp-adn-none-row">Belum ada pilihan di grup ini.</p>
                      )}

                      {g.values.map((v, vi) => {
                        const salahNilai = issueNilai.get(v.key);
                        return (
                          <div
                            key={v.key}
                            className={`dp-adn-row${v.is_active ? "" : " dp-adn-row-off"}`}
                          >
                            <input
                              className={`dp-menuf-input${salahNilai ? " dp-menuf-bad" : ""}`}
                              value={v.name}
                              maxLength={MAX_ADDON_NAME}
                              placeholder="mis. Reguler"
                              aria-label={`Nama pilihan ${vi + 1}`}
                              onChange={e =>
                                patchGroup(g.key, x => ({
                                  ...x,
                                  values: x.values.map(y => (y.key === v.key ? { ...y, name: e.target.value } : y)),
                                }))
                              }
                            />

                            <PriceInput
                              value={v.price_delta}
                              invalid={Boolean(salahNilai)}
                              label={`Selisih harga ${v.name || `pilihan ${vi + 1}`}`}
                              onChange={n =>
                                patchGroup(g.key, x => ({
                                  ...x,
                                  values: x.values.map(y => (y.key === v.key ? { ...y, price_delta: n } : y)),
                                }))
                              }
                            />

                            <button
                              type="button"
                              className="dp-adn-icon dp-adn-eye"
                              aria-pressed={v.is_active}
                              title={
                                v.is_active
                                  ? "Tampil di menu tamu. Klik untuk sembunyikan."
                                  : "Disembunyikan dari tamu. Data tetap tersimpan."
                              }
                              aria-label={`${v.is_active ? "Sembunyikan" : "Tampilkan"} pilihan ${v.name || vi + 1}`}
                              onClick={() =>
                                patchGroup(g.key, x => ({
                                  ...x,
                                  values: x.values.map(y => (y.key === v.key ? { ...y, is_active: !y.is_active } : y)),
                                }))
                              }
                            >
                              {v.is_active ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
                            </button>

                            <div className="dp-adn-rowtools">
                              <button
                                type="button"
                                className="dp-adn-icon"
                                title="Naikkan"
                                aria-label={`Naikkan pilihan ${vi + 1}`}
                                disabled={vi === 0}
                                onClick={() => patchGroup(g.key, x => ({ ...x, values: move(x.values, vi, vi - 1) }))}
                              >
                                <ArrowUpIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="dp-adn-icon"
                                title="Turunkan"
                                aria-label={`Turunkan pilihan ${vi + 1}`}
                                disabled={vi === g.values.length - 1}
                                onClick={() => patchGroup(g.key, x => ({ ...x, values: move(x.values, vi, vi + 1) }))}
                              >
                                <ArrowDownIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="dp-adn-icon dp-adn-icon-bad"
                                title="Hapus pilihan"
                                aria-label={`Hapus pilihan ${vi + 1}`}
                                onClick={() =>
                                  patchGroup(g.key, x => ({ ...x, values: x.values.filter(y => y.key !== v.key) }))
                                }
                              >
                                <Trash2Icon className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {salahNilai && <p className="dp-adn-rowerr" role="alert">{salahNilai}</p>}
                            {v.recipes.length > 0 && (
                              <p className="dp-adn-rownote">
                                {v.recipes.length} bahan inventory tertaut — ikut tersimpan.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="dp-adn-addrow"
                      disabled={g.values.length >= MAX_VALUES_PER_GROUP}
                      onClick={() => patchGroup(g.key, x => ({ ...x, values: [...x.values, emptyValue()] }))}
                    >
                      <PlusIcon className="h-3.5 w-3.5" aria-hidden /> Tambah pilihan
                    </button>
                  </>
                )}
              </fieldset>
            );
          })}
        </div>
      )}

      {barisTambah}

      <p className="dp-menuf-hint dp-adn-foot">
        Ikon mata menyembunyikan satu pilihan tanpa menghapusnya — untuk topping yang habis hari ini.
        Perubahan tayang di menu tamu &amp; kasir setelah menu disimpan.
      </p>
    </section>
  );
}
