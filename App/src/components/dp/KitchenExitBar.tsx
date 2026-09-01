"use client";

import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { ArrowLeftIcon, LogOutIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/** Bar navigasi papan Dapur standalone (/dapur).
 *
 *  Dua pintu:
 *  - "Kembali" — ke halaman sebelumnya (history.back). Pemilik yang membuka
 *    KDS dari konsol tidak perlu kehilangan tempat; kalau tidak ada riwayat
 *    (langsung login di perangkat dapur), tombol ini membawa ke konsol.
 *  - "Keluar" — akhiri sesi (tablet dapur milik staf kitchen). */
export default function KitchenExitBar({ cafeName }: { cafeName?: string }) {
  const router = useRouter();

  const keluar = () => {
    if (clerkConfigured) return <ClerkExitAction />;
    return <SupabaseExitAction />;
  };

  return (
    <div className="dp-exit-bar">
      <span className="dp-exit-cafe">{cafeName}</span>
      <div className="dp-exit-actions">
        <button
          type="button"
          className="dp-btn-white"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/dashboard-v2/dapur");
          }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Kembali
        </button>
        {keluar()}
      </div>
    </div>
  );
}

function ClerkExitAction() {
  const router = useRouter();
  const { signOut } = useClerk();

  async function handleLogout() {
    // Clerk's default post-sign-out redirect is "/", which this app forwards to
    // the public menu. Naming /login keeps sign-out landing where staff expect,
    // and keeps that navigation from racing the router call below.
    await signOut({ redirectUrl: "/login" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button type="button" className="dp-btn-white" onClick={handleLogout}>
      <LogOutIcon className="h-4 w-4" />
      Keluar
    </button>
  );
}

function SupabaseExitAction() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button type="button" className="dp-btn-white" onClick={handleLogout}>
      <LogOutIcon className="h-4 w-4" />
      Keluar
    </button>
  );
}
