"use client";

import { useMemo, useState, useTransition } from "react";
import {
  PencilLineIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { createAddon, deleteAddon, toggleAddon, updateAddon } from "@/lib/addon-actions";

/** Tabel Addons ala template addons.html Dream POS:
 *  kolom Item | Addon | Price | Status | Actions, toolbar cari + Add New,
 *  modal Add/Edit addon, hapus dengan konfirmasi. Coupons sengaja TIDAK
 *  dibuat (permintaan eksplisit). Semua kontrol nyata (keputusan §4.4). */

export type AddonRow = {
  valueId: string;
  valueName: string;
  priceDelta: number;
  isActive: boolean;
  groupId: string;
  groupName: string;
  menuId: string;
  menuName: string;
  menuCategory: string | null;
};

export type MenuOpt = { id: string; name: string; category: string | null };

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export default function AddonsTable({ rows, menus }: { rows: AddonRow[]; menus: MenuOpt[] }) {
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Modal tambah
  const [addOpen, setAddOpen] = useState(false);
  const [addMenuId, setAddMenuId] = useState("");
  const [addGroupId, setAddGroupId] = useState("");
  const [addNewGroup, setAddNewGroup] = useState("");
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState("");

  // Modal edit
  const [editRow, setEditRow] = useState<AddonRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  // Konfirmasi hapus
  const [delRow, setDelRow] = useState<AddonRow | null>(null);

  // Dropdown menu modal Add: dari props (semua menu), bukan dari addon rows.
  const menusList = menus;
  const groupsAll = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.groupId)) seen.set(r.groupId, r.groupName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      r =>
        r.valueName.toLowerCase().includes(needle) ||
        r.menuName.toLowerCase().includes(needle) ||
        r.groupName.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  function handleAdd() {
    const menuId = addMenuId;
    const price = Number(addPrice.replace(/[^\d]/g, ""));
    if (!menuId) {
      setMsg({ kind: "err", text: "Pilih menu terlebih dahulu." });
      return;
    }
    startTransition(async () => {
      const res = await createAddon({
        menuId,
        groupId: addGroupId || null,
        newGroupName: addGroupId ? null : addNewGroup,
        name: addName,
        priceDelta: price,
      });
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: `Addon “${addName.trim()}” ditambahkan.` });
      setAddOpen(false);
      setAddName("");
      setAddPrice("");
      setAddNewGroup("");
      setAddGroupId("");
    });
  }

  function handleEdit() {
    if (!editRow) return;
    const price = Number(editPrice.replace(/[^\d]/g, ""));
    startTransition(async () => {
      const res = await updateAddon(editRow.valueId, {
        name: editName,
        priceDelta: price,
      });
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Addon disimpan." });
      setEditRow(null);
    });
  }

  function handleToggle(row: AddonRow) {
    startTransition(async () => {
      const res = await toggleAddon(row.valueId, !row.isActive);
      if (res.error) setMsg({ kind: "err", text: res.error });
    });
  }

  function handleDelete() {
    if (!delRow) return;
    const target = delRow;
    startTransition(async () => {
      const res = await deleteAddon(target.valueId);
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: `Addon “${target.valueName}” dihapus.` });
      setDelRow(null);
    });
  }

  return (
    <>
      <div className="dp-page-head">
        <h1>Addons</h1>
        <div className="dp-page-head-tools">
          <label className="dp-field">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cari addon / menu"
              aria-label="Cari addon"
            />
            <SearchIcon className="h-4 w-4" />
          </label>
          <button type="button" className="dp-add-btn" onClick={() => { setMsg(null); setAddOpen(true); }}>
            <PlusIcon className="h-4 w-4" /> Add New
          </button>
        </div>
      </div>

      {msg && (
        <p className={msg.kind === "err" ? "dp-form-error" : "dp-form-ok"} role="status">
          {msg.text}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="dp-card dp-empty">
          Belum ada addon. Klik <strong>Add New</strong> untuk menambah pilihan tambahan
          (topping, level, ukuran) pada menu — addon akan ikut tampil di menu tamu & kasir.
        </div>
      ) : (
        <div className="dp-table-wrap">
          <table className="dp-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Grup</th>
                <th>Addon</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.valueId}>
                  <td className="dp-cell-cat">
                    <span className="dp-avatar-sm" aria-hidden="true">
                      {(r.menuName || "?").slice(0, 1).toUpperCase()}
                    </span>
                    {r.menuName}
                  </td>
                  <td>{r.groupName}</td>
                  <td style={{ fontWeight: 600, color: "var(--dp-heading)" }}>{r.valueName}</td>
                  <td>{r.priceDelta > 0 ? `+ ${rupiah(r.priceDelta)}` : "—"}</td>
                  <td>
                    <button
                      type="button"
                      className={`dp-badge ${r.isActive ? "dp-badge-success" : "dp-badge-danger"}`}
                      title={r.isActive ? "Klik untuk nonaktifkan" : "Klik untuk aktifkan"}
                      disabled={pending}
                      onClick={() => handleToggle(r)}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td>
                    <div className="dp-row-actions">
                      <button
                        type="button"
                        className="dp-round-btn"
                        aria-label={`Edit addon ${r.valueName}`}
                        disabled={pending}
                        onClick={() => {
                          setMsg(null);
                          setEditRow(r);
                          setEditName(r.valueName);
                          setEditPrice(String(r.priceDelta || ""));
                        }}
                      >
                        <PencilLineIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="dp-round-btn dp-round-btn-danger"
                        aria-label={`Hapus addon ${r.valueName}`}
                        disabled={pending}
                        onClick={() => { setMsg(null); setDelRow(r); }}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="dp-empty">
                    Tidak ada addon yang cocok dengan “{q.trim()}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Add Addon ── */}
      {addOpen && (
        <div className="dp-modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="dp-modal" role="dialog" aria-modal="true" aria-label="Add Addon" onClick={e => e.stopPropagation()}>
            <div className="dp-modal-head">
              <h2>Add Addon</h2>
              <button type="button" className="dp-round-btn" aria-label="Tutup" onClick={() => setAddOpen(false)}>
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="dp-modal-body">
              <label className="dp-label" htmlFor="dp-addon-menu">Menu</label>
              <select
                id="dp-addon-menu"
                className="dp-input"
                value={addMenuId}
                onChange={e => { setAddMenuId(e.target.value); setAddGroupId(""); }}
              >
                <option value="">Pilih menu…</option>
                {menusList.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.category ? ` — ${m.category}` : ""}
                  </option>
                ))}
              </select>

              <label className="dp-label dp-mt" htmlFor="dp-addon-group">Grup pilihan</label>
              <select
                id="dp-addon-group"
                className="dp-input"
                value={addGroupId}
                onChange={e => setAddGroupId(e.target.value)}
              >
                <option value="">— Grup baru —</option>
                {groupsAll.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {!addGroupId && (
                <input
                  className="dp-input dp-mt"
                  value={addNewGroup}
                  onChange={e => setAddNewGroup(e.target.value)}
                  placeholder="Nama grup baru (mis. Level Pedas)"
                  aria-label="Nama grup baru"
                />
              )}

              <label className="dp-label dp-mt" htmlFor="dp-addon-name">Nama addon</label>
              <input
                id="dp-addon-name"
                className="dp-input"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="mis. Extra Cheese"
              />

              <label className="dp-label dp-mt" htmlFor="dp-addon-price">Harga tambahan (Rp)</label>
              <input
                id="dp-addon-price"
                className="dp-input"
                inputMode="numeric"
                value={addPrice}
                onChange={e => setAddPrice(e.target.value)}
                placeholder="0"
              />
              <p className="dp-hint">Isi 0 bila addon gratis (mis. pilihan tanpa bawang).</p>
            </div>
            <div className="dp-form-foot">
              <button type="button" className="dp-btn-white" onClick={() => setAddOpen(false)}>Batal</button>
              <button type="button" className="dp-add-btn" disabled={pending} onClick={handleAdd}>
                {pending ? "Menyimpan…" : "Tambah Addon"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Addon ── */}
      {editRow && (
        <div className="dp-modal-backdrop" onClick={() => setEditRow(null)}>
          <div className="dp-modal" role="dialog" aria-modal="true" aria-label="Edit Addon" onClick={e => e.stopPropagation()}>
            <div className="dp-modal-head">
              <h2>Edit Addon</h2>
              <button type="button" className="dp-round-btn" aria-label="Tutup" onClick={() => setEditRow(null)}>
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="dp-modal-body">
              <p className="dp-hint">
                {editRow.menuName} · grup {editRow.groupName}
              </p>
              <label className="dp-label" htmlFor="dp-edit-name">Nama addon</label>
              <input
                id="dp-edit-name"
                className="dp-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
              <label className="dp-label dp-mt" htmlFor="dp-edit-price">Harga tambahan (Rp)</label>
              <input
                id="dp-edit-price"
                className="dp-input"
                inputMode="numeric"
                value={editPrice}
                onChange={e => setEditPrice(e.target.value)}
              />
            </div>
            <div className="dp-form-foot">
              <button type="button" className="dp-btn-white" onClick={() => setEditRow(null)}>Batal</button>
              <button type="button" className="dp-add-btn" disabled={pending} onClick={handleEdit}>
                {pending ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: konfirmasi hapus ── */}
      {delRow && (
        <div className="dp-modal-backdrop" onClick={() => setDelRow(null)}>
          <div className="dp-modal dp-modal-sm" role="dialog" aria-modal="true" aria-label="Hapus addon" onClick={e => e.stopPropagation()}>
            <div className="dp-modal-head">
              <h2>Hapus Addon</h2>
              <button type="button" className="dp-round-btn" aria-label="Tutup" onClick={() => setDelRow(null)}>
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="dp-modal-body">
              <p style={{ margin: 0, fontSize: 14, color: "var(--dp-text)" }}>
                Hapus <strong>{delRow.valueName}</strong> dari {delRow.menuName}?
                Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>
            <div className="dp-form-foot">
              <button type="button" className="dp-btn-white" onClick={() => setDelRow(null)}>Batal</button>
              <button type="button" className="dp-add-btn" disabled={pending} onClick={handleDelete}>
                {pending ? "Menghapus…" : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
