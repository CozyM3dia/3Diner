import { redirect } from "next/navigation";
import { CheckIcon, MinusIcon } from "lucide-react";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { PERMISSIONS, type StaffPermission } from "@/lib/authorization";
import type { StaffRole } from "@/types";

export const metadata = { title: "Roles & Permissions · 3Diner" };

/** Roles & Permissions — recreation `role-permission.html` Dream POS.
 *
 *  Template memakai matriks Module × (View/Add/Edit/Delete/Export/Approved)
 *  berisi checkbox yang bisa dicentang, plus tombol "Add New" untuk membuat
 *  peran baru. Di aplikasi ini peran dan wewenangnya ditetapkan di kode
 *  (`src/lib/authorization.ts`, konstanta `PERMISSIONS`) dan ditegakkan di
 *  setiap server action — bukan baris database yang bisa disunting. Maka:
 *  matriksnya ditampilkan sebagai tanda baca, bukan checkbox yang mustahil
 *  disimpan, dan "Add New" tidak direplikasi.
 *
 *  Sumbernya konstanta yang sama yang dipakai penjaga akses, jadi tabel ini
 *  tidak bisa menyimpang dari perilaku sebenarnya. */

const PERAN: { key: StaffRole; label: string; sub: string }[] = [
  { key: "owner", label: "Owner", sub: "Pemilik kafe" },
  { key: "cashier", label: "Kasir", sub: "Staf di depan" },
];

const MODUL: { key: StaffPermission; label: string; sub: string }[] = [
  { key: "operate_orders", label: "Pesanan", sub: "Membuka antrean dan memproses pembayaran di Kasir" },
  { key: "manage_menu", label: "Menu", sub: "Menyunting menu dan menyalakan/mematikan tayangnya" },
  { key: "manage_inventory", label: "Inventaris", sub: "Menyesuaikan stok bahan" },
  { key: "manage_settings", label: "Pengaturan", sub: "Profil toko, pajak, dan service charge" },
];

export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  return (
    <>
      <div className="dp-page-head">
        <div>
          <h1>Roles &amp; Permissions</h1>
          <p className="dp-page-sub">Ditetapkan di kode, bukan di database</p>
        </div>
      </div>

      <div className="dp-roles-grid">
        <div className="dp-card">
          <div className="dp-card-body">
            <h2 className="dp-card-title dp-mb">Peran</h2>
            {PERAN.map(p => (
              <div key={p.key} className="dp-role-row">
                <b>{p.label}</b>
                <span>{p.sub}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dp-card">
          <div className="dp-card-body">
            <div className="dp-table-wrap">
              <table className="dp-table">
                <thead>
                  <tr>
                    <th>Modul</th>
                    {PERAN.map(p => (
                      <th key={p.key}>{p.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODUL.map(m => (
                    <tr key={m.key}>
                      <td>
                        <b className="dp-mod-name">{m.label}</b>
                        <span className="dp-mod-sub">{m.sub}</span>
                      </td>
                      {PERAN.map(p => {
                        const boleh = PERMISSIONS[m.key].includes(p.key);
                        return (
                          <td key={p.key}>
                            {boleh ? (
                              <span className="dp-mark dp-mark-yes" title="Diizinkan">
                                <CheckIcon className="h-4 w-4" />
                              </span>
                            ) : (
                              <span className="dp-mark" title="Tidak diizinkan">
                                <MinusIcon className="h-4 w-4" />
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="dp-hint dp-mt">
              Mengubah wewenang berarti mengubah <code>PERMISSIONS</code> di{" "}
              <code>src/lib/authorization.ts</code>, lalu memasang ulang aplikasi.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
