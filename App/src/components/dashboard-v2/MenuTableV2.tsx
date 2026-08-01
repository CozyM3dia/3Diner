"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  liveState,
  modelState,
  MODEL_STATE_LABEL,
  type MenuRow,
} from "@/lib/dashboard-v2-menu";
import { setManyMenusLive, setMenuLive } from "@/lib/menu-actions-v2";

interface Props {
  rows: MenuRow[];
  footer: React.ReactNode;
}

export default function MenuTableV2({ rows, footer }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id_menu));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(rows.map((r) => r.id_menu)));
  }

  function runBulk(live: boolean) {
    const ids = [...selected];
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await setManyMenusLive(ids, live);
      if (result.error) setError(result.error);
      else {
        // Hasilnya dikabarkan dengan angka. "Berhasil" tidak memberi tahu
        // apakah yang berubah sebanyak yang dipilih.
        setMessage(`${result.changed} item ${live ? "dinyalakan" : "dimatikan"}.`);
        setSelected(new Set());
      }
    });
  }

  function runSingle(row: MenuRow) {
    setError(null);
    setMessage(null);
    setBusyId(row.id_menu);
    startTransition(async () => {
      const result = await setMenuLive(row.id_menu, !row.is_active);
      if (result.error) setError(result.error);
      setBusyId(null);
    });
  }

  return (
    <>
      {error && (
        <div className="dv2-state dv2-state-left" role="alert">
          <p className="dv2-state-title">{error}</p>
        </div>
      )}
      {message && (
        <div className="dv2-state dv2-state-left" role="status">
          <p className="dv2-state-body">{message}</p>
        </div>
      )}

      {selected.size > 0 && (
        <div className="dv2-bulk">
          <span>
            <b>{selected.size}</b> item dipilih
          </span>
          <span className="dv2-bulk-actions">
            <button className="dv2-btn" disabled={pending} onClick={() => runBulk(false)}>
              Matikan
            </button>
            <button className="dv2-btn" disabled={pending} onClick={() => runBulk(true)}>
              Nyalakan
            </button>
            <button className="dv2-btn" onClick={() => setSelected(new Set())}>
              Batal pilih
            </button>
          </span>
        </div>
      )}

      <div className="dv2-table dv2-table-menu" role="table" aria-label="Menu">
        <div className="dv2-row dv2-row-head" role="row">
          <span className="dv2-col-pick">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAll}
              aria-label="Pilih semua item yang tampil"
            />
          </span>
          <span className="dv2-col-menu">Nama · kategori</span>
          <span className="dv2-col-price">Rp</span>
          <span className="dv2-col-model">Model 3D</span>
          <span className="dv2-col-live">Tayang</span>
          <span className="dv2-col-menu-act" />
        </div>

        {rows.map((r) => (
          <div className="dv2-row" role="row" key={r.id_menu}>
            <span className="dv2-col-pick">
              <input
                type="checkbox"
                checked={selected.has(r.id_menu)}
                onChange={() => toggle(r.id_menu)}
                aria-label={`Pilih ${r.nama_menu}`}
              />
            </span>
            {/* Baris adalah objek yang bisa dibuka. Namanya yang membuka, bukan
                seluruh baris — jari yang meleset sedikit tidak boleh membuka
                editor alih-alih mematikan menu. */}
            <span className="dv2-col-menu">
              <Link className="dv2-open" href={`/dashboard-v2/menu/${r.id_menu}`} title={r.nama_menu}>
                {r.nama_menu}
                <span className="dv2-sub"> · {r.category?.trim() || "tanpa kategori"}</span>
              </Link>
            </span>
            {/* "Rp" hidup di header kolom, bukan di tiap sel: mengulanginya
                memakan lebar yang dibutuhkan angkanya sendiri, dan kolom angka
                yang terpotong tidak bisa dibandingkan sekilas. */}
            <span className="dv2-col-price">
              {r.harga_menu.toLocaleString("id-ID")}
              {r.discount_pct ? <span className="dv2-sub"> · −{r.discount_pct}%</span> : null}
            </span>
            <span className="dv2-col-model">
              <span className="dv2-chip">{MODEL_STATE_LABEL[modelState(r)]}</span>
            </span>
            {/* Keadaan tayang menyebut SEBABNYA. "Nonaktif" saja tidak memberi
                tahu kenapa tamu tidak melihatnya, dan itu justru pertanyaan
                yang membawa pemilik ke layar ini.

                Nada hanya dipasang pada yang TIDAK tayang: layar ini dibuka
                untuk menemukan yang bermasalah, dan keadaan normal tidak
                boleh berteriak. */}
            <span className="dv2-col-live">
              <span className="dv2-chip" data-tone={r.liveNow ? undefined : "warning"}>
                {liveState(r)}
              </span>
            </span>
            <span className="dv2-col-menu-act">
              <button
                className="dv2-btn"
                disabled={pending && busyId === r.id_menu}
                onClick={() => runSingle(r)}
              >
                {r.is_active ? "Matikan" : "Nyalakan"}
              </button>
            </span>
          </div>
        ))}

        {footer}
      </div>
    </>
  );
}
