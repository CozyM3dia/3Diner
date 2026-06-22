import type { Menu } from "@/types";

/**
 * Whether a menu should be visible to customers right now, based on the
 * dashboard scheduler settings (active flag + day-of-week + daypart window).
 * Empty schedule means "always available".
 */
export function isMenuAvailableNow(menu: Menu, now: Date = new Date()): boolean {
  if (menu.is_active === false) return false;

  // Day filter — schedule_days is comma list of ISO weekdays (1=Mon..7=Sun)
  const days = (menu.schedule_days ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (days.length > 0) {
    const isoDay = now.getDay() === 0 ? 7 : now.getDay();
    if (!days.includes(String(isoDay))) return false;
  }

  // Time window filter
  const start = menu.schedule_start?.trim();
  const end = menu.schedule_end?.trim();
  if (start && end) {
    const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (start <= end) {
      // same-day window, e.g. 08:00–22:00
      if (cur < start || cur > end) return false;
    } else {
      // overnight window, e.g. 22:00–02:00
      if (cur < start && cur > end) return false;
    }
  }

  return true;
}

/** Discounted price if discount_pct set, else original. Rounded to integer rupiah. */
export function effectivePrice(menu: Menu): number {
  const pct = menu.discount_pct ?? 0;
  if (pct > 0 && pct < 100) return Math.round(menu.harga_menu * (1 - pct / 100));
  return menu.harga_menu;
}

export function hasDiscount(menu: Menu): boolean {
  const pct = menu.discount_pct ?? 0;
  return pct > 0 && pct < 100;
}
