"use client";

import { useState, useTransition } from "react";
import { RotateCcwIcon } from "lucide-react";
import { resetPermission, savePermission } from "@/lib/role-permission-actions";
import {
  PERM_ACTIONS,
  PERM_MODULES,
  PERM_ROLES,
  buildPreviewMatrix,
  type PermUiMatrix,
  type UiActionKey,
  type UiRoleKey,
} from "@/lib/perm-ui-model";
import type { StaffPermission } from "@/lib/permissions-default";

/** Matriks Roles & Permissions ala Dream POS (role-permission.html):
 *  kartu daftar peran di kiri + tabel Modul × aksi ber-checkbox di kanan.
 *
 *  Yang NYATA tersimpan & ditegakkan server: sel Lihat untuk peran Owner dan
 *  Kasir pada modul ber-permission (tabel Role_Permissions →
 *  requireStaffPermission). Sel aksi granular dan peran Manager/Kitchen/Staf
 *  adalah PRATINJAU — bisa dicentang, tapi Simpan menyampaikan dengan jujur
 *  bahwa backend granularnya menyusul. Guard anti-kunci-dirinya tetap
 *  dijaga server-side (savePermission). */

export type PermCellUi = Record<UiRoleKey, boolean> & { override: boolean };
export type MatrixUi = Record<string, PermCellUi>;

type Msg = { kind: "ok" | "err" | "info"; text: string } | null;

/** Sel tersambung backend: Lihat × modul ber-permission — SEMUA peran,
 *  karena override kini disimpan 5 kolom (owner/manager/cashier/kitchen/staff)
 *  dan ditegakkan requireStaffPermission. Aksi granular tetap pratinjau. */
function selTersambung(modKey: string, action: UiActionKey): boolean {
  const mod = PERM_MODULES.find((m) => m.key === modKey);
  return Boolean(action === "lihat" && mod?.perm);
}

/** Gabungkan nilai server (Lihat, semua peran) ke matriks pratinjau. */
function matriksAwal(server: MatrixUi): PermUiMatrix {
  const m = buildPreviewMatrix();
  for (const mod of PERM_MODULES) {
    if (!mod.perm || !(mod.perm in server)) continue;
    const cell = server[mod.perm];
    for (const r of PERM_ROLES) {
      m[r.key][mod.key].lihat = cell[r.key];
    }
  }
  return m;
}

function overrideAwal(server: MatrixUi): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const mod of PERM_MODULES) {
    if (mod.perm && mod.perm in server) out[mod.perm] = server[mod.perm].override;
  }
  return out;
}

export default function PermissionsMatrix({
  matrix,
  defaults,
}: {
  matrix: MatrixUi;
  defaults: MatrixUi;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [serverMatrix, setServerMatrix] = useState<MatrixUi>(matrix);
  const [local, setLocal] = useState<PermUiMatrix>(() => matriksAwal(matrix));
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() =>
    overrideAwal(matrix),
  );
  const [role, setRole] = useState<UiRoleKey>("owner");

  const roleInfo = PERM_ROLES.find((r) => r.key === role)!;

  function toggle(modKey: string, action: UiActionKey) {
    const mod = PERM_MODULES.find((m) => m.key === modKey)!;
    const next: PermUiMatrix = {
      ...local,
      [role]: { ...local[role], [modKey]: { ...local[role][modKey], [action]: !local[role][modKey][action] } },
    };
    setLocal(next);
    setMsg(null);

    if (!selTersambung(modKey, action)) return; // pratinjau murni — status muncul saat Simpan

    const perm = mod.perm as StaffPermission;
    // Satu klik = satu upsert 5 kolom: sel peran lain diambil dari serverMatrix
    // (nilai efektif saat ini), supaya baris override tak pernah kehilangan
    // nilai peran lain. UI lokal diperbarui untuk semua peran.
    const payload = Object.fromEntries(
      PERM_ROLES.map((r) => [r.key, next[r.key][modKey].lihat]),
    ) as Record<UiRoleKey, boolean>;
    startTransition(async () => {
      const res = await savePermission(perm, payload);
      if (res.tableMissing) {
        setMsg({ kind: "err", text: "Tabel wewenang tidak terbaca, jadi perubahan ini belum tersimpan. Muat ulang halaman; bila tetap muncul, laporkan ke dukungan." });
        setLocal(matriksAwal(serverMatrix));
        return;
      }
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        setLocal(matriksAwal(serverMatrix));
        return;
      }
      setServerMatrix((s) => ({ ...s, [perm]: { ...payload, override: true } }));
      setOverrides((o) => ({ ...o, [perm]: true }));
      setMsg({ kind: "ok", text: `Wewenang Lihat ${mod.nama} untuk ${roleInfo.nama} disimpan dan langsung berlaku.` });
    });
  }

  function kembalikanModule(modKey: string) {
    const mod = PERM_MODULES.find((m) => m.key === modKey)!;
    if (!mod.perm) return;
    const perm = mod.perm;
    const bawaan = defaults[perm] ?? { owner: true, manager: false, cashier: false, kitchen: false, staff: false, override: false };
    startTransition(async () => {
      const res = await resetPermission(perm);
      if (res.tableMissing) {
        setMsg({ kind: "info", text: "Tidak ada override tersimpan untuk dikembalikan." });
        return;
      }
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      const next = matriksAwal(serverMatrix);
      for (const r of PERM_ROLES) next[r.key][modKey].lihat = bawaan[r.key];
      setLocal(next);
      setServerMatrix((s) => ({
        ...s,
        [perm]: { ...bawaan, override: false },
      }));
      setOverrides((o) => ({ ...o, [perm]: false }));
      setMsg({ kind: "ok", text: `${mod.nama} kembali ke bawaan kode.` });
    });
  }

  function kembalikanSemua() {
    startTransition(async () => {
      let adaError = "";
      for (const mod of PERM_MODULES) {
        if (!mod.perm || !overrides[mod.perm]) continue;
        const res = await resetPermission(mod.perm);
        if (res.error && !res.tableMissing) adaError = res.error;
      }
      setLocal(matriksAwal({}));
      setServerMatrix((s) => {
        const out: MatrixUi = {};
        for (const mod of PERM_MODULES) {
          if (!mod.perm || !(mod.perm in s)) continue;
          const bawaan = defaults[mod.perm] ?? { owner: true, manager: false, cashier: false, kitchen: false, staff: false, override: false };
          out[mod.perm] = { ...bawaan, override: false };
        }
        return out;
      });
      setOverrides(overrideAwal({}));
      setMsg(
        adaError
          ? { kind: "err", text: adaError }
          : { kind: "ok", text: "Semua override dikembalikan ke bawaan kode." },
      );
    });
  }

  function simpan() {
    const awal = matriksAwal(serverMatrix);
    // Sel tersambung (Lihat × modul ber-permission, semua peran) sudah
    // tersimpan saat dicentang. Pratinjau berubah = sel NON-tersambung
    // (aksi granular) mana pun yang berbeda dari awal.
    const pratinjauBerubah = PERM_ROLES.some((r) =>
      PERM_MODULES.some((m) =>
        PERM_ACTIONS.some((a) => {
          const tersambung = selTersambung(m.key, a.key);
          return !tersambung && awal[r.key][m.key][a.key] !== local[r.key][m.key][a.key];
        }),
      ),
    );
    setMsg(
      pratinjauBerubah
        ? {
            kind: "info",
            text: "Sel Lihat semua peran tersimpan nyata per kafe. Centang pada aksi granular (Tambah/Ubah/Hapus/Ekspor/Setujui) masih pratinjau — penegakannya menyusul.",
          }
        : { kind: "ok", text: "Semua perubahan wewenang sudah tersimpan dan berlaku." },
    );
  }

  function batal() {
    setLocal(matriksAwal(serverMatrix));
    setMsg({ kind: "info", text: "Perubahan yang belum tersimpan dibatalkan." });
  }

  return (
    <>
      {msg && (
        <p
          className={msg.kind === "err" ? "dp-form-error" : msg.kind === "info" ? "dp-notice" : "dp-form-ok"}
          role="status"
        >
          {msg.text}
        </p>
      )}

      <div className="dp-perm-layout">
        {/* ── Kartu Roles (kiri) ── */}
        <div className="dp-card">
          <div className="dp-card-body">
            <p className="dp-perm-roles-title">Roles</p>
            <div className="dp-perm-roles" role="tablist" aria-label="Pilih peran">
              {PERM_ROLES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="tab"
                  aria-selected={role === r.key}
                  className={`dp-perm-role${role === r.key ? " dp-perm-role-on" : ""}`}
                  onClick={() => {
                    setRole(r.key);
                    setMsg(null);
                  }}
                >
                  {r.nama}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Matriks permission (kanan) ── */}
        <div>
          <div className="dp-perm-head">
            <h2 className="dp-perm-head-title">Peran : {roleInfo.nama}</h2>
            <button
              type="button"
              className="dp-perm-revertall"
              onClick={kembalikanSemua}
              disabled={pending}
            >
              <input type="checkbox" readOnly checked={false} tabIndex={-1} aria-hidden />
              Kembalikan Semua
            </button>
          </div>
          <p className="dp-perm-head-ket">{roleInfo.ket}</p>

          <div className="dp-card">
            <div className="dp-card-body">
              <div className="dp-table-wrap">
                <table className="dp-table dp-perm-table">
                  <thead>
                    <tr>
                      <th>Modul</th>
                      {PERM_ACTIONS.map((a) => (
                        <th key={a.key}>{a.nama}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERM_MODULES.map((m) => (
                      <tr key={m.key}>
                        <td>
                          <span className="dp-mod-name">
                            {m.nama}
                            {m.perm && overrides[m.perm] && (
                              <button
                                type="button"
                                className="dp-perm-undo"
                                title="Kembalikan sel Lihat modul ini ke bawaan kode"
                                aria-label={`Kembalikan bawaan untuk ${m.nama}`}
                                disabled={pending}
                                onClick={() => kembalikanModule(m.key)}
                              >
                                <RotateCcwIcon className="h-3 w-3" /> bawaan diubah
                              </button>
                            )}
                          </span>
                          <span className="dp-mod-sub">{m.ket}</span>
                        </td>
                        {PERM_ACTIONS.map((a) => {
                          // manage_settings: Kasir & Staf terkunci dari UI
                          // (server juga menolak — jangan bohongi user).
                          const terkunci =
                            m.perm === "manage_settings" &&
                            a.key === "lihat" &&
                            (role === "cashier" || role === "staff");
                          return (
                            <td key={a.key} className="dp-perm-cell">
                              <input
                                type="checkbox"
                                className="dp-check"
                                checked={local[role][m.key][a.key]}
                                disabled={pending || terkunci}
                                title={
                                  terkunci
                                    ? "Akses Pengaturan untuk Kasir/Staf tidak dapat diaktifkan"
                                    : undefined
                                }
                                aria-label={`${a.nama} ${m.nama} untuk ${roleInfo.nama}`}
                                onChange={() => toggle(m.key, a.key)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="dp-form-foot dp-perm-foot">
                <button type="button" className="dp-btn-white" onClick={batal} disabled={pending}>
                  Batal
                </button>
                <button type="button" className="dp-add-btn" onClick={simpan} disabled={pending}>
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>

          <p className="dp-hint dp-mt">
            Centang sel <b>Lihat</b> pada modul ber-permission (Pesanan, Menu, Inventaris,
            Pengaturan) tersimpan per kafe untuk kelima peran dan langsung ditegakkan di
            server — tanpa deploy. Aksi granular (Tambah/Ubah/Hapus/Ekspor/Setujui) masih
            pratinjau UI; ikon <RotateCcwIcon className="h-3 w-3 inline" /> mengembalikan sel
            yang diubah ke bawaan kode.
          </p>
        </div>
      </div>

    </>
  );
}
