"use client";

import { useState, useTransition } from "react";
import { RotateCcwIcon } from "lucide-react";
import { resetPermission, savePermission } from "@/lib/role-permission-actions";
import { LABEL_PERMISI } from "@/lib/role-permissions-list";
import type { StaffPermission } from "@/lib/permissions-default";

/** Matriks Roles & Permissions yang bisa disunting.
 *  Setiap sel = override runtime per-kafe (tabel Role_Permissions);
 *  "Kembalikan" menghapus override → bawaan kode berlaku lagi.
 *  Guard anti-kunci-dirinya dijaga server-side (savePermission). */

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
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [local, setLocal] = useState<MatrixUi>(matrix);
  const [sqlCopied, setSqlCopied] = useState(false);

  function toggle(permission: StaffPermission, role: "owner" | "cashier") {
    const cur = local[permission];
    const next = { ...cur, [role]: !cur[role], override: true };
    setLocal({ ...local, [permission]: next });
    startTransition(async () => {
      const res = await savePermission(permission, { owner: next.owner, cashier: next.cashier });
      if (res.tableMissing) {
        setMsg({ kind: "info", text: "Tabel override belum ada — jalankan SQL setup di bawah dulu." });
        setLocal(local); // batalkan perubahan lokal
        return;
      }
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        setLocal(local);
        return;
      }
      setMsg({ kind: "ok", text: "Wewenang disimpan." });
    });
  }

  function reset(permission: StaffPermission) {
    const bawaan = defaults[permission]; // bawaan kode, BUKAN override aktif
    startTransition(async () => {
      const res = await resetPermission(permission);
      if (res.tableMissing) {
        setMsg({ kind: "info", text: "Tabel override belum ada — tidak ada yang perlu dikembalikan." });
        return;
      }
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setLocal({ ...local, [permission]: { ...bawaan, override: false } });
      setMsg({ kind: "ok", text: "Kembali ke bawaan kode." });
    });
  }

  return (
    <>
      {msg && (
        <p className={msg.kind === "err" ? "dp-form-error" : msg.kind === "info" ? "dp-notice" : "dp-form-ok"} role="status">
          {msg.text}
        </p>
      )}

      <div className="dp-card">
        <div className="dp-card-body">
          <div className="dp-table-wrap">
            <table className="dp-table">
              <thead>
                <tr>
                  <th>Modul</th>
                  <th>Owner</th>
                  <th>Kasir</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(local) as StaffPermission[]).map(p => (
                  <tr key={p}>
                    <td>
                      <span className="dp-mod-name">{LABEL_PERMISI[p].nama}</span>
                      <span className="dp-mod-sub">{LABEL_PERMISI[p].deskripsi}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`dp-perm-toggle${local[p].owner ? " dp-perm-on" : ""}`}
                        aria-pressed={local[p].owner}
                        aria-label={`${LABEL_PERMISI[p].nama} untuk Owner`}
                        disabled={pending}
                        onClick={() => toggle(p, "owner")}
                      >
                        {local[p].owner ? "✓" : "—"}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`dp-perm-toggle${local[p].cashier ? " dp-perm-on" : ""}`}
                        aria-pressed={local[p].cashier}
                        aria-label={`${LABEL_PERMISI[p].nama} untuk Kasir`}
                        disabled={pending || p === "manage_settings"}
                        title={p === "manage_settings" ? "Tidak dapat diaktifkan untuk Kasir" : undefined}
                        onClick={() => toggle(p, "cashier")}
                      >
                        {local[p].cashier ? "✓" : "—"}
                      </button>
                    </td>
                    <td>
                      {local[p].override && (
                        <button
                          type="button"
                          className="dp-round-btn"
                          aria-label={`Kembalikan bawaan untuk ${LABEL_PERMISI[p].nama}`}
                          title="Kembalikan ke bawaan kode"
                          disabled={pending}
                          onClick={() => reset(p)}
                        >
                          <RotateCcwIcon className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="dp-hint dp-mt">
            Perubahan tersimpan per kafe dan langsung berlaku — tanpa deploy. Sel tanpa override
            mengikuti bawaan kode; ikon <RotateCcwIcon className="h-3 w-3 inline" /> mengembalikannya.
          </p>
        </div>
      </div>

      {/* Kartu setup: hanya tampil saat tabel override belum dibuat */}
      {!Object.values(local).some(c => c.override) && tableMissing && (
        <div className="dp-card dp-perm-setup">
          <p className="dp-qr-mini">Aktifkan override runtime (opsional)</p>
          <p className="dp-hint" style={{ marginBottom: 10 }}>
            Matriks di atas saat ini murni bawaan kode. Untuk menyimpan perubahan permanen per
            kafe, buat tabel <code>Role_Permissions</code> dengan SQL ini (Supabase Dashboard →
            SQL Editor, sekali):
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
