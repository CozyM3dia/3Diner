import { createClerkClient } from "@clerk/backend";
import { NextResponse } from "next/server";

import { clientIp, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Tiket masuk sekali pakai untuk akun demo.
 *
 *  Kenapa tiket, bukan sekadar mengisi password di formulir: instance Clerk
 *  ini memverifikasi perangkat baru, dan setiap pengunjung demo — menurut
 *  definisinya — datang dari perangkat baru. Login password akan selalu
 *  berhenti di layar "masukkan kode yang dikirim ke email", dan kode itu
 *  jatuh ke kotak masuk yang tidak dipegang siapa pun. Sign-in token adalah
 *  mekanisme resmi Clerk untuk kasus ini: server menandatangani tiket untuk
 *  SATU user, klien menukarnya jadi sesi.
 *
 *  Batasnya sengaja sempit:
 *  · hanya email yang persis sama dengan konfigurasi demo yang dilayani;
 *  · route mati (404) bila akun demo tidak dikonfigurasi;
 *  · permintaan lintas-situs ditolak lewat pemeriksaan Origin;
 *  · dibatasi laju per IP, karena tiket ini menghasilkan sesi tanpa password.
 *
 *  Eksposurnya sama dengan password demo yang memang dicetak di halaman
 *  masuk — bedanya tiket kedaluwarsa dalam hitungan menit dan tidak bisa
 *  dipakai untuk akun lain.
 */

const DEMO_EMAIL = (process.env.DEMO_EMAIL ?? process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "")
  .trim()
  .toLowerCase();
const TTL_DETIK = 300;

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // navigasi non-CORS tidak mengirim Origin
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!DEMO_EMAIL || !secretKey) {
    // Bukan 403: tanpa konfigurasi demo, endpoint ini memang tidak ada.
    return NextResponse.json({ error: "Akun demo tidak dikonfigurasi." }, { status: 404 });
  }

  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Asal permintaan tidak dikenal." }, { status: 403 });
  }

  const limit = await consumeRateLimit(`demo-ticket:${clientIp(req)}`, 10, 300);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  try {
    const clerk = createClerkClient({ secretKey });
    const daftar = await clerk.users.getUserList({ emailAddress: [DEMO_EMAIL], limit: 2 });
    const user = daftar.data.find(u =>
      u.emailAddresses.some(e => e.emailAddress.trim().toLowerCase() === DEMO_EMAIL),
    );

    if (!user) {
      return NextResponse.json(
        { error: "Akun demo belum dibuat. Jalankan `npm run demo:seed`." },
        { status: 503 },
      );
    }

    const token = await clerk.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: TTL_DETIK,
    });

    return NextResponse.json(
      { ticket: token.token },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Gagal menyiapkan sesi demo." }, { status: 503 });
  }
}
