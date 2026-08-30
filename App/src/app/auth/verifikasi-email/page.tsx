import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "../AuthShell";

export const metadata: Metadata = { title: "Verifikasi Email | 3Diner" };

/**
 * Halaman Verifikasi Email — recreation 1:1 `email-verification.html`
 * Dream POS (placeholder UI, logic menyusul).
 */
export default function VerifikasiEmailPage() {
  return (
    <AuthShell>
      <div className="ap-mb4">
        <h3 className="ap-mb2">Cek Email Kamu</h3>
        <p className="ap-mb0 ap-head-sub">
          Kami telah mengirim instruksi pemulihan password ke email kamu
        </p>
      </div>

      <div className="ap-mb4">
        <button type="button" className="ap-btn ap-btn-primary">Kirim Ulang Email</button>
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
