import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "../AuthShell";

export const metadata: Metadata = { title: "Lupa Password | 3Diner" };

/**
 * Halaman Lupa Password — recreation 1:1 `forgot-password.html` Dream POS
 * (placeholder UI, logic menyusul).
 */
export default function LupaPasswordPage() {
  return (
    <AuthShell>
      <div className="ap-mb4">
        <h3 className="ap-mb2">Lupa Password</h3>
        <p className="ap-mb0 ap-head-sub">
          Silakan masukkan alamat email untuk menerima kode verifikasi
        </p>
      </div>

      <div className="ap-field ap-mb4">
        <label className="ap-label" htmlFor="email">
          Email<span className="ap-req"> *</span>
        </label>
        <input id="email" type="email" className="ap-input" placeholder="kamu@kafe.com" />
      </div>

      <div className="ap-mb4">
        <button type="button" className="ap-btn ap-btn-primary">Kirim Email</button>
      </div>

      <div className="ap-foot">
        <p className="ap-mb0">
          Kembali ke
          <Link href="/auth/masuk" className="ap-link"> Masuk</Link>
        </p>
      </div>
    </AuthShell>
  );
}
