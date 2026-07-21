# 3Diner Design System

## Design Read

3Diner dashboard is a cafe operations cockpit, not a marketing page. It should be dense enough for daily work, calm enough for long sessions, and warm enough to still feel like a food product.

## Layout Principles

- Sidebar navigation remains persistent on desktop.
- Mobile navigation should collapse cleanly without horizontal overflow.
- The dashboard homepage must surface the most urgent operational status first.
- Use compact sections with clear labels and strong metric hierarchy.
- Avoid oversized hero sections inside the dashboard.
- Avoid nested cards unless the nested element is a real tool or table row.
- Use page sections as working surfaces, not decorative floating blocks.

## Dashboard Density

Target density: 7 out of 10.

Reason:

- Owner cafe needs scanning speed.
- Inventory, orders, sales, menu, and analytics must be visible without hunting.
- The UI should still breathe through spacing, dividers, and hierarchy.

## Component Principles

- Cards show one clear job: metric, chart, list, table, alert, or action.
- Tables should be readable and responsive.
- Action buttons should be obvious and scarce.
- Icons are functional, not decorative.
- Forms should be grouped by operational meaning.
- Loading states should match final layout shape.
- Empty states should explain the next useful action.
- Error states should be contextual and recoverable.

## Navigation Principles

Main modules:

- Analitik
- Penjualan
- Pesanan
- Menu
- Inventory
- Pengumuman
- Jadwal & Diskon
- Pengaturan

If inventory appears as a standalone route, it must still be visible from `/dashboard` as a section or operational alert.

## Motion Principles

- Motion should support orientation and feedback.
- Use subtle entrance, metric reveal, tab transition, and button feedback.
- Respect `prefers-reduced-motion`.
- Do not use scroll-jacking.
- Do not delay task completion with cinematic animation.
- Transform and opacity are preferred.

## Icon Rules

- Use one icon family across the dashboard.
- If the project already uses lucide, continue with lucide.
- Use consistent stroke width.
- No hand-drawn one-off SVG icons unless it is the official 3Diner logo.

## Accessibility Rules

- Maintain keyboard navigation and focus states.
- Do not rely on color alone for status.
- Keep contrast high on dark dashboard surfaces.
- Buttons must have readable text in all states.
- Inputs must show focus clearly.
- Mobile touch targets should be at least 44px high where practical.

## Mobile Dashboard Principles

- No horizontal page overflow.
- Metric cards stack or scroll only when intentionally designed.
- Tables should become cards or controlled horizontal regions.
- Long Indonesian labels must not clip.
- Sidebar must not permanently occupy the mobile viewport.

## Anti Slop Rules

- No random purple or blue AI gradients.
- No decorative blobs or orbs.
- No generic SaaS hero.
- No placeholder business names.
- No fake data replacing real data.
- No inconsistent radius scale.
- No mixed icon libraries.
- No unreadable muted text.
- No motion without purpose.
- No template visual identity replacing 3Diner.
