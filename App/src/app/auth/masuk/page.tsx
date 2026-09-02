import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "../AuthShell";
import { AuthField, AuthFoot, AuthInput, AuthPassword } from "@/components/ui/sign-in";

export const metadata: Metadata = { title: "Masuk | 3Diner" };

/** Halaman Masuk pratinjau. Login yang sungguhan (Clerk) ada di `/login`;
 *  halaman ini menjaga alur /auth/* tetap utuh saat didemokan. Statusnya
 *  ditulis di layar supaya tombol yang belum tersambung tidak terbaca
 *  sebagai janji. */
export default function MasukPage() {
  return (
    <AuthShell
      title="Hai, selamat datang kembali!"
      lede="Masukkan kredensial kamu untuk membuka konsol kafe."
    >
      <div className="au-fields">
        <p className="au-note">
          Pratinjau alur. Masuk yang aktif ada di{" "}
          <Link href="/login" className="au-link">
            /login
          </Link>
          .
        </p>

        <AuthField label="Email" htmlFor="email" required delay={3}>
          <AuthInput id="email" type="email" autoComplete="email" placeholder="kamu@kafe.com" />
        </AuthField>

        <AuthField label="Password" htmlFor="password" required delay={4}>
          <AuthPassword id="password" autoComplete="current-password" placeholder="Masukkan password" />
        </AuthField>

        <div className="au-row au-el" style={{ "--d": 5 } as React.CSSProperties}>
          <label className="au-check">
            <input type="checkbox" /> Ingat saya
          </label>
          <Link href="/auth/lupa-password" className="au-link">
            Lupa password?
          </Link>
        </div>

        <Link
          href="/login"
          className="au-submit au-el"
          style={{ "--d": 6 } as React.CSSProperties}
        >
          Masuk
        </Link>
      </div>

      <AuthFoot>
        Belum punya akun?{" "}
        <Link href="/auth/daftar" className="au-link">
          Daftar
        </Link>
      </AuthFoot>
    </AuthShell>
  );
}
