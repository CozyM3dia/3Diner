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
    const wibDay = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short" }).format(now)
    ] ?? 0;
    const isoDay = wibDay === 0 ? 7 : wibDay;
    if (!days.includes(String(isoDay))) return false;
  }

  // Time window filter
  const start = menu.schedule_start?.trim();
  const end = menu.schedule_end?.trim();
  if (start && end) {
    const wibH = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false, hourCycle: "h23" }).format(now), 10);
    const wibM = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", minute: "numeric" }).format(now), 10);
    const cur = `${String(wibH).padStart(2, "0")}:${String(wibM).padStart(2, "0")}`;
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
