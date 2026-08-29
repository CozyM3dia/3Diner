import { redirect } from "next/navigation";
import { getStaffContext, canOpenOwnerConsole } from "@/lib/staff-context";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const metadata = { title: "Manage Staffs · 3Diner" };
export const dynamic = "force-dynamic";

/** Manage Staffs — recreation `users.html` Dream POS, read-only.
 *
 *  Kolom template: Name / Role / Phone Number / Status / Actions.
 *  `Staff` tidak menyimpan nomor telepon, jadi kolom itu diganti tanggal
 *  bergabung (`created_at`) yang memang ada. Kolom Actions tidak direplikasi:
 *  aplikasi ini belum punya satu pun jalur tulis ke tabel Staff — dan di
 *  template sendiri ketiga tombol itu bertanda `disabled`.
 *
 *  Peran hanya `owner` dan `cashier` (check constraint di database). */

const PERAN: Record<string, string> = {
  owner: "Owner",
  cashier: "Kasir",
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

export default async function Page() {
  const ctx = await getStaffContext();
  if (!canOpenOwnerConsole(ctx.role)) redirect("/login");

  const { data } = await supabaseAdmin
    .from("Staff")
    .select("id_staff,full_name,role,is_active,created_at")
    .eq("cafe_id", ctx.cafe_id ?? "")
    .order("created_at", { ascending: true });

  const staff = data ?? [];

  return (
    <>
      <div className="dp-page-head">
        <h1>Manage Staffs</h1>
      </div>

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
                  </tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id_staff}>
                      <td>
                        <span className="dp-cell-cat">
                          <span className="dp-avatar-sm dp-avatar-init">{inisial(s.full_name ?? "")}</span>
                          {s.full_name}
                        </span>
                      </td>
                      <td>{PERAN[s.role] ?? s.role}</td>
                      <td>{tanggal(s.created_at)}</td>
                      <td>
                        {s.is_active ? (
                          <span className="dp-badge dp-badge-success">Aktif</span>
                        ) : (
                          <span className="dp-badge dp-badge-danger">Nonaktif</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="dp-hint dp-mt">
            Penambahan dan penonaktifan staf belum punya jalur di aplikasi ini, jadi halaman ini
            hanya menampilkan daftarnya.
          </p>
        </div>
      </div>
    </>
  );
}
