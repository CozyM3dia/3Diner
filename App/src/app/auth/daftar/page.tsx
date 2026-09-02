import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "../AuthShell";
import { AuthField, AuthFoot, AuthInput, AuthPassword } from "@/components/ui/sign-in";

export const metadata: Metadata = { title: "Daftar | 3Diner" };

/** Halaman Daftar pratinjau. Pendaftaran yang sungguhan ada di tab "Daftar"
 *  pada `/login`. Tombol Google/Facebook milik template dibuang: tidak ada
 *  provider sosial yang tersambung, dan tombol yang tidak melakukan apa pun
 *  adalah kontrol palsu. */
export default function DaftarPage() {
  return (
    <AuthShell
      title="Daftar akun"
      lede="Buat akun untuk mulai mengelola menu, pesanan, dan stok kafe kamu."
    >
      <div className="au-fields">
        <p className="au-note">
          Pratinjau alur. Pendaftaran yang aktif ada di{" "}
          <Link href="/login" className="au-link">
            /login
          </Link>
          .
        </p>

        <AuthField label="Email" htmlFor="email" required delay={3}>
          <AuthInput id="email" type="email" autoComplete="email" placeholder="kamu@kafe.com" />
        </AuthField>

        <AuthField label="Password" htmlFor="password" required delay={4}>
          <AuthPassword id="password" autoComplete="new-password" placeholder="Minimal 8 karakter" />
        </AuthField>

        <AuthField label="Konfirmasi password" htmlFor="confirm-password" required delay={5}>
          <AuthPassword
            id="confirm-password"
            autoComplete="new-password"
            placeholder="Ulangi password"
            labelShow="Tampilkan konfirmasi password"
            labelHide="Sembunyikan konfirmasi password"
          />
        </AuthField>

        <label className="au-check au-el" style={{ "--d": 6 } as React.CSSProperties}>
          <input type="checkbox" />
          <span>
            Saya menyetujui Ketentuan Layanan &amp; Kebijakan Privasi 3Diner.
          </span>
        </label>

        <Link
          href="/login"
          className="au-submit au-el"
          style={{ "--d": 7 } as React.CSSProperties}
        >
          Daftar
        </Link>
      </div>

      <AuthFoot>
        Sudah punya akun?{" "}
        <Link href="/auth/masuk" className="au-link">
          Masuk
        </Link>
      </AuthFoot>
    </AuthShell>
  );
}
