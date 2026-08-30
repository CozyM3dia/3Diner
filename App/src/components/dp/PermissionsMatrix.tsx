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

export type PermCellUi = { owner: boolean; cashier: boolean; override: boolean };
export type MatrixUi = Record<string, PermCellUi>;

const SETUP_SQL = `-- Jalankan di Supabase Dashboard → SQL Editor (sekali)
create table if not exists public."Role_Permissions" (
  id_role_permission uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes" (id_cafe) on delete cascade,
  permission text not null check (permission in (
    'operate_orders', 'manage_menu', 'manage_inventory', 'manage_settings'
  )),
  owner_allowed boolean not null default true,
  cashier_allowed boolean not null default false,
  updated_at timestamptz,
  unique (cafe_id, permission)
);
create index if not exists "Role_Permissions_cafe_idx"
  on public."Role_Permissions" (cafe_id);
alter table public."Role_Permissions" enable row level security;`;

type Msg = { kind: "ok" | "err" | "info"; text: string } | null;

/** Gabungkan nilai server (owner/cashier Lihat) ke matriks pratinjau. */
function matriksAwal(server: MatrixUi): PermUiMatrix {
  const m = buildPreviewMatrix();
  for (const mod of PERM_MODULES) {
    if (!mod.perm || !(mod.perm in server)) continue;
    const cell = server[mod.perm];
    m.owner[mod.key].lihat = cell.owner;
    m.cashier[mod.key].lihat = cell.cashier;
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
  tableMissing,
}: {
  matrix: MatrixUi;
  defaults: MatrixUi;
  tableMissing: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [serverMatrix, setServerMatrix] = useState<MatrixUi>(matrix);
  const [local, setLocal] = useState<PermUiMatrix>(() => matriksAwal(matrix));
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() =>
    overrideAwal(matrix),
  );
  const [role, setRole] = useState<UiRoleKey>("owner");
  const [sqlCopied, setSqlCopied] = useState(false);

  const roleInfo = PERM_ROLES.find((r) => r.key === role)!;

  /** Sel tersambung backend = Lihat × (Owner|Kasir) × modul ber-permission. */
  function selTersambung(modKey: string, r: UiRoleKey, action: UiActionKey) {
    const mod = PERM_MODULES.find((m) => m.key === modKey);
    return Boolean(
      action === "lihat" &&
        mod?.perm &&
        (r === "owner" || r === "cashier"),
    );
  }

  function toggle(modKey: string, action: UiActionKey) {
    const mod = PERM_MODULES.find((m) => m.key === modKey)!;
    const next: PermUiMatrix = {
      ...local,
      [role]: { ...local[role], [modKey]: { ...local[role][modKey], [action]: !local[role][modKey][action] } },
    };
    setLocal(next);
    setMsg(null);

    if (!selTersambung(modKey, role, action)) return; // pratinjau murni — status muncul saat Simpan

    const perm = mod.perm as StaffPermission;
    const payload = {
      owner: next.owner[modKey].lihat,
      cashier: next.cashier[modKey].lihat,
    };
    startTransition(async () => {
      const res = await savePermission(perm, payload);
      if (res.tableMissing) {
        setMsg({ kind: "info", text: "Tabel override belum ada — jalankan SQL setup di bawah dulu." });
        setLocal(matriksAwal(serverMatrix));
        return;
      }
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        setLocal(matriksAwal(serverMatrix));
        return;
      }
      setServerMatrix((s) => ({
        ...s,
        [perm]: { owner: payload.owner, cashier: payload.cashier, override: true },
      }));
      setOverrides((o) => ({ ...o, [perm]: true }));
      setMsg({ kind: "ok", text: `Wewenang Lihat ${mod.nama} untuk ${roleInfo.nama} disimpan dan langsung berlaku.` });
    });
  }

  function kembalikanModule(modKey: string) {
    const mod = PERM_MODULES.find((m) => m.key === modKey)!;
    if (!mod.perm) return;
    const perm = mod.perm;
    const bawaan = defaults[perm] ?? { owner: true, cashier: false };
    startTransition(async () => {
      const res = await resetPermission(perm);
      if (res.tableMissing) {
        setMsg({ kind: "info", text: "Tabel override belum ada — tidak ada yang perlu dikembalikan." });
        return;
      }
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      const next = matriksAwal(serverMatrix);
      next.owner[modKey].lihat = bawaan.owner;
      next.cashier[modKey].lihat = bawaan.cashier;
      setLocal(next);
      setServerMatrix((s) => ({
        ...s,
        [perm]: { owner: bawaan.owner, cashier: bawaan.cashier, override: false },
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
          const bawaan = defaults[mod.perm] ?? { owner: true, cashier: false };
          out[mod.perm] = { owner: bawaan.owner, cashier: bawaan.cashier, override: false };
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
    // Sel tersambung (Lihat × Owner/Kasir) sudah tersimpan saat dicentang.
    // Pratinjau berubah = sel NON-tersambung mana pun yang berbeda dari awal.
    const pratinjauBerubah = PERM_ROLES.some((r) =>
      PERM_MODULES.some((m) =>
        PERM_ACTIONS.some((a) => {
          const tersambung = selTersambung(m.key, r.key, a.key);
          return !tersambung && awal[r.key][m.key][a.key] !== local[r.key][m.key][a.key];
        }),
      ),
    );
    setMsg(
      pratinjauBerubah
        ? {
            kind: "info",
            text: "Sel Lihat Owner & Kasir tersimpan nyata. Centang pada aksi lain (Tambah/Ubah/Hapus/Ekspor/Setujui) dan peran Manager/Kitchen/Staf masih pratinjau — penegakan granularnya menyusul.",
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
                          const terkunci =
                            role === "cashier" && m.perm === "manage_settings" && a.key === "lihat";
                          return (
                            <td key={a.key} className="dp-perm-cell">
                              <input
                                type="checkbox"
                                className="dp-check"
                                checked={local[role][m.key][a.key]}
                                disabled={pending || terkunci}
                                title={
                                  terkunci
                                    ? "Akses Pengaturan untuk Kasir tidak dapat diaktifkan"
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
            Centang sel <b>Lihat</b> untuk Owner &amp; Kasir tersimpan per kafe dan langsung
            ditegakkan di server — tanpa deploy. Sel aksi lain (Tambah/Ubah/Hapus/Ekspor/Setujui)
            dan peran Manager/Kitchen/Staf masih pratinjau UI; ikon{" "}
            <RotateCcwIcon className="h-3 w-3 inline" /> mengembalikan sel yang diubah ke bawaan
            kode.
          </p>
        </div>
      </div>

      {/* Kartu setup: hanya tampil saat tabel override belum dibuat */}
      {!Object.values(overrides).some(Boolean) && tableMissing && (
        <div className="dp-card dp-perm-setup">
          <p className="dp-qr-mini">Aktifkan override runtime (opsional)</p>
          <p className="dp-hint" style={{ marginBottom: 10 }}>
            Matriks saat ini murni bawaan kode. Untuk menyimpan perubahan permanen per kafe, buat
            tabel <code>Role_Permissions</code> dengan SQL ini (Supabase Dashboard → SQL Editor,
            sekali):
          </p>
          <pre className="dp-perm-sql">{SETUP_SQL}</pre>
          <button
            type="button"
            className="dp-btn-white"
            onClick={() =>
              navigator.clipboard.writeText(SETUP_SQL).then(
                () => {
                  setSqlCopied(true);
                  setMsg({ kind: "ok", text: "SQL disalin — tempel di SQL Editor Supabase lalu Run." });
                },
                () => setMsg({ kind: "err", text: "Gagal menyalin — salin manual dari kotak." }),
              )
            }
          >
            {sqlCopied ? "SQL tersalin ✓" : "Salin SQL setup"}
          </button>
        </div>
      )}
    </>
  );
}
