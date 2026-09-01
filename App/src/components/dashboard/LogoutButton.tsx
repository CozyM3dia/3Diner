"use client";

import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function ClerkLogoutButton() {
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

  return <LogoutButtonView onLogout={handleLogout} />;
}

function SupabaseLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <LogoutButtonView onLogout={handleLogout} />;
}

function LogoutButtonView({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <button
      onClick={onLogout}
      className="flex items-center gap-2 text-sm font-medium w-full transition-colors duration-150 hover:opacity-80"
      style={{ color: "var(--dash-muted)" }}
    >
      <LogOut size={15} strokeWidth={1.9} />
      Keluar
    </button>
  );
}

export default function LogoutButton() {
  return clerkConfigured ? <ClerkLogoutButton /> : <SupabaseLogoutButton />;
}
