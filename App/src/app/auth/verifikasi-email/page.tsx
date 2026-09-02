import type { Metadata } from "next";
import Link from "next/link";
import { MailCheckIcon } from "lucide-react";
import AuthShell from "../AuthShell";
import { AuthFoot } from "@/components/ui/sign-in";

export const metadata: Metadata = { title: "Verifikasi Email | 3Diner" };

/** Cek Email — pratinjau layar antara setelah permintaan pemulihan. Kode
 *  yang sungguhan dikirim oleh alur Clerk di `/login` (verifikasi email saat
 *  daftar dan faktor kedua saat masuk). */
export default function VerifikasiEmailPage() {
  return (
    <AuthShell
      title="Cek email kamu"
      lede="Kami mengirim instruksi pemulihan ke alamat email yang terdaftar. Kode berlaku 10 menit."
      cards={[
        {
          name: "Kode dikirim",
          meta: "Berlaku 10 menit",
          body: "Tidak masuk dalam semenit? Periksa folder spam sebelum meminta kode baru.",
          pills: [{ label: "Menunggu kode", tone: "warning" }],
        },
      ]}
    >
      <div className="au-fields">
        <p className="au-note">
          Pratinjau alur. Verifikasi yang aktif berjalan di{" "}
          <Link href="/login" className="au-link">
            /login
          </Link>{" "}
          saat mendaftar atau saat akun meminta faktor kedua.
        </p>

        <Link
          href="/auth/otp"
          className="au-submit au-el"
          style={{ "--d": 3 } as React.CSSProperties}
        >
          <MailCheckIcon size={16} aria-hidden="true" />
          Masukkan kode
        </Link>

        <button type="button" className="au-ghost au-el" style={{ "--d": 4 } as React.CSSProperties}>
          Kirim ulang email
        </button>
      </div>

      <AuthFoot>
        Salah alamat email?{" "}
        <Link href="/auth/lupa-password" className="au-link">
          Ulangi dari awal
        </Link>
      </AuthFoot>
    </AuthShell>
  );
}
