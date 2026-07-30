import Link from "next/link";
import { getStaffContext } from "@/lib/staff-context";
import { getSettingsPage } from "@/lib/dashboard-v2-settings";
import OwnerShell from "@/components/dashboard-v2/OwnerShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pengaturan · Konsol Owner",
};

/** Rute Pengaturan — daftar bagian, bukan satu formulir raksasa.
 *
 *  Layar ini jarang dibuka dan sebagian isinya merusak kalau salah. Pertanyaan
 *  yang dijawab: "saya perlu mengubah satu hal, di mana?" — jadi yang pertama
 *  terlihat adalah apa yang belum lengkap, bukan seluruh isi pengaturan. */
export default async function OwnerSettingsPage() {
  const ctx = await getStaffContext();
  const page = await getSettingsPage(ctx.cafe_id ?? null);

  return (
    <OwnerShell
      title="Pengaturan"
      note="Daftar bagian, bukan satu formulir raksasa — yang punya akibat kalau dibiarkan ada di paling atas."
      cafe={page.cafeName}
    >
      {page.error ? (
        <div className="dv2-state">
          <p className="dv2-state-title">Gagal memuat pengaturan</p>
          <p className="dv2-state-body">{page.error}</p>
          <Link className="dv2-btn dv2-btn-solid dv2-state-cta" href="/dashboard-v2/pengaturan">
            Coba lagi
          </Link>
        </div>
      ) : (
        <>
          {page.tasks.length > 0 ? (
            <section className="dv2-group" aria-label="Perlu dilengkapi">
              <div className="dv2-ghd">
                <span>
                  Perlu dilengkapi <b>{page.tasks.length}</b>
                </span>
                <span className="dv2-ghd-note">yang punya akibat kalau dibiarkan</span>
              </div>
              {page.tasks.map((t, i) => (
                <div className="dv2-row dv2-row-setup" key={t.id}>
                  <span className="dv2-col-setup-name">{t.label}</span>
                  {/* Akibatnya yang membuat orang mengerjakannya. Daftar
                      pengaturan kosong tanpa akibat tidak pernah disentuh. */}
                  <span className="dv2-col-setup-why">
                    <span className="dv2-chip" data-tone="warning">
                      {t.consequence}
                    </span>
                  </span>
                  <span className="dv2-col-setup-act">
                    {/* HANYA baris pertama yang solid. Daftar ini sudah urut
                        menurut kegentingan, jadi yang teratas adalah aksi
                        primer layar ini — dan dua tombol terisi berarti tidak
                        ada yang primer. Sisanya tetap terlihat dan tetap bisa
                        ditekan; yang dilepas cuma penekanannya. */}
                    <Link className={i === 0 ? "dv2-btn dv2-btn-solid" : "dv2-btn"} href={t.href}>
                      {t.actionLabel}
                    </Link>
                  </span>
                </div>
              ))}
            </section>
          ) : (
            <section className="dv2-group" aria-label="Perlu dilengkapi">
              <div className="dv2-ghd">
                <span>Perlu dilengkapi</span>
              </div>
              {/* Dinyatakan sebagai hasil, tanpa CTA — ini kabar baik, dan
                  tombol di sini membatalkan kabarnya. */}
              <div className="dv2-state">
                <p className="dv2-state-title">Semua sudah dilengkapi</p>
                <p className="dv2-state-body">Tidak ada pengaturan yang menghambat penjualan.</p>
              </div>
            </section>
          )}

          {page.sections.map((section) => (
            <section className="dv2-group" aria-label={section.title} key={section.title}>
              <div className="dv2-ghd">
                <span>{section.title}</span>
              </div>
              {section.rows.map((row) => (
                <div className="dv2-row dv2-row-setup" key={row.label}>
                  <span className="dv2-col-setup-name">
                    {row.label}
                    <span className="dv2-sub"> · {row.detail}</span>
                  </span>
                  <span className="dv2-col-setup-state">
                    <span className="dv2-chip">{row.state}</span>
                  </span>
                  <span className="dv2-col-setup-act">
                    <Link className="dv2-btn" href={row.href}>
                      {/* Rute yang belum pindah dikatakan apa adanya, bukan
                          disamarkan sebagai tombol biasa yang melempar keluar. */}
                      {row.moved ? "Buka" : "Konsol lama"}
                    </Link>
                  </span>
                </div>
              ))}
            </section>
          ))}

          {/* Catatan jujur: asumsi A5 di kontrak wireframe menyebut jam buka
              tersimpan di database dan dipakai untuk menghitung SLA. Ternyata
              kolomnya tidak ada sama sekali. */}
          <p className="dv2-note">
            Jam buka belum punya tempat penyimpanan di database, jadi hitungan &quot;terlambat&quot; di
            konsol kasir memakai 24 jam penuh. Notifikasi terlambat masih bisa muncul di jam kafe
            tutup sampai kolomnya dibuat.
          </p>
        </>
      )}
    </OwnerShell>
  );
}
