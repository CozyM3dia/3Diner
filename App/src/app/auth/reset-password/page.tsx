import type { Metadata } from "next";
import Link from "next/link";
import { EyeOffIcon } from "lucide-react";
import AuthShell from "../AuthShell";

export const metadata: Metadata = { title: "Reset Password | 3Diner" };

/**
 * Halaman Reset Password — recreation 1:1 `reset-password.html` Dream POS
 * (placeholder UI, logic menyusul).
 */
export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <div className="ap-mb4">
        <h3 className="ap-mb2">Reset Password</h3>
        <p className="ap-mb0 ap-head-sub">
          Password baru kamu harus berbeda dari password yang pernah dipakai.
        </p>
      </div>

      <div className="ap-field">
        <label className="ap-label" htmlFor="password">
          Password <span className="ap-req"> *</span>
        </label>
        <div className="ap-pass">
          <input id="password" type="password" className="ap-input" placeholder="••••••••" />
          <button type="button" className="ap-pass-toggle" aria-label="Tampilkan password">
            <EyeOffIcon size={16} />
          </button>
        </div>
      </div>

      <div className="ap-field ap-mb4">
        <label className="ap-label" htmlFor="confirm-password">
          Konfirmasi Password <span className="ap-req"> *</span>
        </label>
        <div className="ap-pass">
          <input id="confirm-password" type="password" className="ap-input" placeholder="••••••••" />
          <button type="button" className="ap-pass-toggle" aria-label="Tampilkan konfirmasi password">
            <EyeOffIcon size={16} />
          </button>
        </div>
      </div>

      <div className="ap-mb4">
        <button type="button" className="ap-btn ap-btn-primary">Kirim</button>
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
