import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "../AuthShell";
import { AuthField, AuthFoot, AuthInput } from "@/components/ui/sign-in";

export const metadata: Metadata = { title: "Lupa Password | 3Diner" };

/** Lupa Password — pratinjau. Pemulihan lewat email baru bisa hidup setelah
 *  email recovery dikonfigurasi di Clerk Dashboard; sampai itu terjadi
 *  halaman ini mengatakannya, bukan berpura-pura mengirim. */
export default function LupaPasswordPage() {
  return (
    <AuthShell
      title="Lupa password"
      lede="Masukkan email akun kamu, lalu kami kirim kode untuk memulihkan akses."
      cards={[
        {
          name: "Pemulihan lewat email",
          meta: "Menunggu konfigurasi Clerk",
          body: "Sampai email recovery aktif, minta pemilik kafe mengatur ulang akses dari daftar staf.",
          pills: [{ label: "Belum aktif", tone: "warning" }],
        },
      ]}
    >
      <div className="au-fields">
        <p className="au-note">
          Pratinjau alur. Reset password aktif setelah email recovery dikonfigurasi di Clerk
          Dashboard.
        </p>

        <AuthField label="Email" htmlFor="email" required delay={3}>
          <AuthInput id="email" type="email" autoComplete="email" placeholder="kamu@kafe.com" />
        </AuthField>

        <Link
          href="/auth/verifikasi-email"
          className="au-submit au-el"
          style={{ "--d": 4 } as React.CSSProperties}
        >
          Kirim kode
        </Link>
      </div>

      <AuthFoot>
        Ingat passwordnya?{" "}
        <Link href="/login" className="au-link">
          Kembali ke masuk
        </Link>
      </AuthFoot>
    </AuthShell>
  );
}
