import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST /api/auth/signout — target form Logout (dp/Shell, dp/ProfileMenu).
 *
 *  Form HTML tidak bisa memanggil supabase-js, jadi signout dijalankan di
 *  server memakai client yang terikat cookie permintaan. Status 303 membuat
 *  browser mengikuti redirect dengan GET — tanpa itu, landing-nya adalah
 *  respons POST yang tak dikenali halaman. Setelah signOut cookie sesi sudah
 *  lepas, jadi aturan middleware (login di-GET → /dashboard) tidak memantul. */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
