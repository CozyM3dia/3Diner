"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 text-sm font-medium w-full transition-colors duration-150 hover:opacity-80"
      style={{ color: "#5A7898" }}
    >
      <LogOut size={15} strokeWidth={1.9} />
      Keluar
    </button>
  );
}
