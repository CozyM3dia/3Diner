"use client";

import { useState, useTransition } from "react";
import { PlusIcon, UserRoundCheckIcon, UserRoundXIcon } from "lucide-react";
import { addStaff, deactivateStaff, reactivateStaff, type StaffMemberInput } from "@/lib/staff-actions";
import RolePill, { ROLE_LABELS, ROLE_DESKRIPSI, STAFF_ROLES } from "@/components/dp/RolePill";
import type { StaffRole } from "@/types";

/** Manajemen staf: tambah (email+nama+peran) dan kurangi (nonaktif/aktifkan).
 *  Pengganti halaman read-only — kini semua kontrol nyata.
 *  Owner tak bisa menonaktifkan dirinya/owner lain (dijaga server-side juga). */

export type StaffRow = {
  id_staff: string;
  user_id: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
};

const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

const inisial = (nama: string) =>
  nama
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

export default function StaffManager({
  staff,
  selfUserId,
}: {
  staff: StaffRow[];
  selfUserId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);

  // Modal tambah
  const [addOpen, setAddOpen] = useState(false);
  const [fEmail, setFEmail] = useState("");
  const [fNama, setFNama] = useState("");
  const [fPeran, setFPeran] = useState<StaffRole>("cashier");
  const [created, setCreated] = useState<{ email: string; password: string; reused: boolean } | null>(null);

  // Konfirmasi nonaktif
  const [delRow, setDelRow] = useState<StaffRow | null>(null);

  function handleAdd() {
    const input: StaffMemberInput = { email: fEmail, fullName: fNama, role: fPeran };
    startTransition(async () => {
      const res = await addStaff(input);
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({
        kind: "ok",
        text: res.reusedAccount
          ? "Akun sudah ada — diaktifkan kembali sebagai staf kafe ini. Password baru direset; bagikan ke staf."
          : "Staf ditambahkan.",
      });
      if (res.tempPassword) {
        setCreated({ email: input.email.trim().toLowerCase(), password: res.tempPassword, reused: !!res.reusedAccount });
      }
      setAddOpen(false);
      setFEmail("");
      setFNama("");
      setFPeran("cashier");
    });
  }

  function handleDeactivate() {
    if (!delRow) return;
    const target = delRow;
    startTransition(async () => {
      const res = await deactivateStaff(target.id_staff);
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: `${target.full_name} dinonaktifkan — tidak bisa masuk konsol lagi.` });
      setDelRow(null);
    });
  }

  function handleReactivate(row: StaffRow) {
    startTransition(async () => {
      const res = await reactivateStaff(row.id_staff);
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: `${row.full_name} aktif kembali.` });
    });
  }

  const active = staff.filter(s => s.is_active);
  const inactive = staff.filter(s => !s.is_active);

  return (
    <>
      <div className="dp-page-head">
        <h1>Kelola Staf</h1>
        <div className="dp-page-head-tools">
          <button
            type="button"
            className="dp-add-btn"
            onClick={() => {
              setMsg(null);
              setCreated(null);
              setAddOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4" /> Tambah Staf
          </button>
        </div>
      </div>

      {msg && (
        <p className={msg.kind === "err" ? "dp-form-error" : "dp-form-ok"} role="status">
          {msg.text}
        </p>
      )}

      {/* Kredensial akun baru — tampil SEKALI, bisa disalin */}
      {created && (
        <div className="dp-card dp-staff-cred" role="alert">
          <p className="dp-qr-mini">Kredensial akun {created.reused ? "(direset)" : "baru"} — tampil sekali</p>
          <div className="dp-staff-cred-row">
            <code>{created.email}</code>
            <code>{created.password}</code>
          </div>
          <button
            type="button"
            className="dp-btn-white"
            onClick={() => navigator.clipboard.writeText(`${created.email} / ${created.password}`).then(
              () => setMsg({ kind: "ok", text: "Kredensial disalin ke clipboard." }),
              () => setMsg({ kind: "err", text: "Gagal menyalin — salin manual." }),
            )}
          >
            Salin kredensial
          </button>
        </div>
      )}

      <div className="dp-card">
        <div className="dp-card-body">
          {staff.length === 0 ? (
            <p className="dp-empty">Belum ada staf terdaftar di kafe ini.</p>
          ) : (
            <div className="dp-table-wrap">
              <table className="dp-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Peran</th>
                    <th>Bergabung</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map(s => {
                    return (
                      <tr key={s.id_staff}>
                        <td>
                          <span className="dp-cell-cat">
                            <span className="dp-avatar-sm dp-avatar-init">{inisial(s.full_name ?? "")}</span>
                            {s.full_name}
                            {s.user_id === selfUserId && (
                              <span className="dp-badge dp-badge-success">Kamu</span>
                            )}
                          </span>
                        </td>
                        <td><RolePill role={s.role} /></td>
                        <td>{tanggal(s.created_at)}</td>
                        <td>
                          <span className="dp-badge dp-badge-success">Aktif</span>
                        </td>
                        <td>
                          {s.role === "owner" ? (
                            <span className="dp-hint">—</span>
                          ) : (
                            <button
                              type="button"
                              className="dp-round-btn dp-round-btn-danger"
                              aria-label={`Nonaktifkan ${s.full_name}`}
                              disabled={pending}
                              onClick={() => {
                                setMsg(null);
                                setDelRow(s);
                              }}
                            >
                              <UserRoundXIcon className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {inactive.map(s => (
                    <tr key={s.id_staff} style={{ opacity: 0.65 }}>
                      <td>
                        <span className="dp-cell-cat">
                          <span className="dp-avatar-sm dp-avatar-init">{inisial(s.full_name ?? "")}</span>
                          {s.full_name}
                        </span>
                      </td>
                      <td><RolePill role={s.role} /></td>
                      <td>{tanggal(s.created_at)}</td>
                      <td>
                        <span className="dp-badge dp-badge-danger">Nonaktif</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="dp-round-btn"
                          aria-label={`Aktifkan kembali ${s.full_name}`}
                          disabled={pending}
                          onClick={() => handleReactivate(s)}
                        >
                          <UserRoundCheckIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="dp-hint dp-mt">
            Menonaktifkan tidak menghapus riwayat — staf hanya kehilangan akses konsol
            dan bisa diaktifkan kembali kapan pun.
          </p>
        </div>
      </div>

      {/* ── Modal: Add Staff ── */}
      {addOpen && (
        <div className="dp-modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="dp-modal" role="dialog" aria-modal="true" aria-label="Tambah staf" onClick={e => e.stopPropagation()}>
            <div className="dp-modal-head">
              <h2>Tambah Staf</h2>
              <button type="button" className="dp-round-btn" aria-label="Tutup" onClick={() => setAddOpen(false)}>
                ✕
              </button>
            </div>
            <div className="dp-modal-body">
              <label className="dp-label" htmlFor="dp-staff-email">Email</label>
              <input
                id="dp-staff-email"
                className="dp-input"
                type="email"
                value={fEmail}
                onChange={e => setFEmail(e.target.value)}
                placeholder="nama@kafe.com"
              />
              <p className="dp-hint">
                Kalau email ini sudah punya akun 3Diner, akun itu yang dipakai (password direset).
              </p>

              <label className="dp-label dp-mt" htmlFor="dp-staff-nama">Nama lengkap</label>
              <input
                id="dp-staff-nama"
                className="dp-input"
                value={fNama}
                onChange={e => setFNama(e.target.value)}
                placeholder="mis. Rani Putri"
              />

              <label className="dp-label dp-mt" htmlFor="dp-staff-peran">Peran</label>
              <select
                id="dp-staff-peran"
                className="dp-input"
                value={fPeran}
                onChange={e => setFPeran(e.target.value as StaffRole)}
              >
                {STAFF_ROLES.map(r => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]} — {ROLE_DESKRIPSI[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="dp-form-foot">
              <button type="button" className="dp-btn-white" onClick={() => setAddOpen(false)}>
                Batal
              </button>
              <button type="button" className="dp-add-btn" disabled={pending} onClick={handleAdd}>
                {pending ? "Menyimpan…" : "Tambah Staf"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: konfirmasi nonaktif ── */}
      {delRow && (
        <div className="dp-modal-backdrop" onClick={() => setDelRow(null)}>
          <div className="dp-modal dp-modal-sm" role="dialog" aria-modal="true" aria-label="Nonaktifkan staf" onClick={e => e.stopPropagation()}>
            <div className="dp-modal-head">
              <h2>Nonaktifkan Staf</h2>
              <button type="button" className="dp-round-btn" aria-label="Tutup" onClick={() => setDelRow(null)}>
                ✕
              </button>
            </div>
            <div className="dp-modal-body">
              <p style={{ margin: 0, fontSize: 14, color: "var(--dp-text)" }}>
                Nonaktifkan <strong>{delRow.full_name}</strong> ({ROLE_LABELS[delRow.role]})? Staf tidak
                bisa masuk konsol lagi, tetapi riwayatnya tetap ada dan bisa diaktifkan kembali.
              </p>
            </div>
            <div className="dp-form-foot">
              <button type="button" className="dp-btn-white" onClick={() => setDelRow(null)}>
                Batal
              </button>
              <button type="button" className="dp-add-btn" disabled={pending} onClick={handleDeactivate}>
                {pending ? "Memproses…" : "Nonaktifkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
