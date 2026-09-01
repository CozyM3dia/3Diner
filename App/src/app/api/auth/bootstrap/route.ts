import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveHomeRoute } from "@/lib/auth-routing";

export const dynamic = "force-dynamic";

/** Finish a Clerk sign-in by resolving the existing cafe/staff role. */
export async function POST() {
  try {
    const { isAuthenticated } = await auth();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Sesi Clerk tidak valid." }, { status: 401 });
    }

    const result = await resolveHomeRoute();
    if (result.home) return NextResponse.json(result);

    return NextResponse.json(result, {
      status: result.reason === "gagal-muat" ? 503 : 403,
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal menyiapkan sesi akun." },
      { status: 503 },
    );
  }
}
