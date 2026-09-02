import type { AnalyticsLog } from "@/types";

/** Fire-and-forget analitik tamu. Aman diimpor dari Client Component —
 *  modul ini tidak menyentuh `next/cache` atau kueri halaman. */
export async function logEvent(
  payload: Pick<AnalyticsLog, "cafe_id" | "menu_id" | "event_type" | "duration">
): Promise<void> {
  const { logEvent: fn } = await import("@/lib/supabase");
  fn(payload).catch(() => {
    /* fire and forget */
  });
}
