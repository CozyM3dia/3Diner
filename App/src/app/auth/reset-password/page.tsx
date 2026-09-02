import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "../AuthShell";
import { AuthField, AuthFoot, AuthPassword } from "@/components/ui/sign-in";

export const metadata: Metadata = { title: "Reset Password | 3Diner" };

/** Reset Password — pratinjau layar terakhir alur pemulihan: pasang password
 *  baru setelah kode diterima. */
export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Pasang password baru"
      lede="Password baru harus berbeda dari yang pernah dipakai, minimal 8 karakter."
      cards={[
        {
          name: "Setelah tersimpan",
          meta: "Semua perangkat keluar",
          body: "Sesi lama diputus, jadi kasir yang masih login harus masuk ulang dengan password baru.",
          pills: [{ label: "Aman", tone: "success" }],
        },
      ]}
    >
      <div className="au-fields">
        <p className="au-note">
          Pratinjau alur. Perubahan password yang aktif dilakukan lewat Clerk Dashboard sampai
          email recovery tersambung.
        </p>

        <AuthField label="Password baru" htmlFor="password" required delay={3}>
          <AuthPassword id="password" autoComplete="new-password" placeholder="Minimal 8 karakter" />
        </AuthField>

        <AuthField label="Konfirmasi password" htmlFor="confirm-password" required delay={4}>
          <AuthPassword
            id="confirm-password"
            autoComplete="new-password"
            placeholder="Ulangi password baru"
            labelShow="Tampilkan konfirmasi password"
            labelHide="Sembunyikan konfirmasi password"
          />
        </AuthField>

        <Link
          href="/login"
          className="au-submit au-el"
          style={{ "--d": 5 } as React.CSSProperties}
        >
          Simpan password
        </Link>
      </div>

      <AuthFoot>
        Batal?{" "}
        <Link href="/login" className="au-link">
          Kembali ke masuk
        </Link>
      </AuthFoot>
    </AuthShell>
  );
}
