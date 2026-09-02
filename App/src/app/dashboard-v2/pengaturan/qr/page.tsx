import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** QR Smart Menu kini digabung ke halaman Pengaturan Toko (/dashboard-v2/pengaturan). */
export default function Page() {
  redirect("/dashboard-v2/pengaturan");
}
