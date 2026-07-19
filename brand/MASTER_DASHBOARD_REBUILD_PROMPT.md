# Master Prompt: 3Diner Dashboard Rebuild With Efferd Dashboard 8

Use this prompt when rebuilding the full 3Diner dashboard UI/UX.

```md
You are Codex, a senior frontend/product engineer and elite UI/UX designer.

Project:
3Diner is a cafe/restaurant dashboard for managing analytics, sales, orders, menu items, 3D model engagement, announcements, schedule/discounts, settings, and inventory. The product is already functional. Your job is to rebuild the full dashboard UI/UX using @efferd/dashboard-8 as the visual foundation, while preserving every existing feature, route, server action, data flow, auth behavior, and database integration.

Brand source of truth:
Before touching dashboard UI, read every file in:

C:\Kerja\3Diner\brand

Required read order:
1. C:\Kerja\3Diner\brand\README.md
2. C:\Kerja\3Diner\brand\BRAND_IDENTITY.md
3. C:\Kerja\3Diner\brand\UI_TOKENS.md
4. C:\Kerja\3Diner\brand\DESIGN_SYSTEM.md
5. C:\Kerja\3Diner\brand\DASHBOARD_REDESIGN_DIRECTION.md

Brand assets:
- Full logo: C:\Kerja\3Diner\brand\logos\3diner-logo-full.png
- Logo mark PNG: C:\Kerja\3Diner\brand\logos\3diner-logo-mark.png
- Logo mark SVG: C:\Kerja\3Diner\brand\logos\3diner-logo-mark.svg
- Brand board: C:\Kerja\3Diner\brand\3diner-brand-board.png

Non-negotiable brand rules:
- Keep the 3Diner brand identity.
- Keep the 3Diner logo.
- Keep the 3Diner color palette.
- Navy #022C60 and #002355 are the brand structure.
- Orange #FD5002 is the primary brand accent.
- Do not replace the product with raw Efferd styling.
- Efferd dashboard 8 is layout and interaction inspiration, not the final brand.
- Do not introduce random purple, blue, beige, glassy, or generic SaaS palette decisions.
- Do not rewrite the brand voice into generic SaaS copy.

Primary goal:
Create a world-class operational dashboard for cafe owners and staff. It must feel premium, calm, dense enough for daily operations, and visually polished without looking like generic AI-generated SaaS UI.

Design foundation:
Use @efferd/dashboard-8 as the base layout language.

Interpret Efferd dashboard 8 as:
- Daily cafe operations cockpit
- Revenue and activity summary first
- Clear date-range controls
- Strong metric hierarchy
- Fast scanning
- Compact but premium cards
- Useful right-side operational alerts
- Dashboard-first UX, not landing-page UX

Mandatory install flow:
1. Install the shadcn skill if missing:
   npx skills add shadcn/ui

2. Ensure this is a shadcn project.
   - Check for components.json.
   - If missing, run:
     npx shadcn@latest init

3. Add the @efferd registry to components.json if missing:

{
  "registries": {
    "@efferd": {
      "url": "https://efferd.com/r/{style}/{name}.json",
      "headers": {
        "Authorization": "Bearer ${EFFERD_REGISTRY_TOKEN}"
      }
    }
  }
}

4. Check if EFFERD_REGISTRY_TOKEN is set.
   - Check local shell env.
   - Check .env / .env.local only if appropriate.
   - If you cannot find it, STOP.
   - Do not attempt installation.
   - Tell the user exactly:
     "You need Efferd Pro to use this block. Buy Efferd Pro at efferd.com, then copy your REGISTRY_TOKEN from efferd.com/account?tab=registry-token and paste it into your .env like this: EFFERD_REGISTRY_TOKEN='registry...'"

5. If token exists, run:
   npx shadcn@latest add @efferd/dashboard-8

After install:
- Inspect all added files.
- Summarize exactly what was added.
- Do not blindly paste Efferd output into production dashboard.
- Adapt it carefully to the existing 3Diner architecture and brand folder.

Relevant frontend design skills to apply:
- design-taste-frontend for anti-slop visual judgment
- frontend-design for polished product UI
- high-end-visual-design for premium composition
- redesign-existing-projects for preserving existing behavior
- gpt-taste if GSAP or advanced motion is used
- gsd-ui-review or equivalent final UI audit before completion
- verification-before-completion before claiming done

Important note:
design-taste-frontend is primarily for landing pages, so do not apply landing-page patterns to the dashboard. Use only its anti-slop checks: typography discipline, color consistency, spacing, contrast, responsive QA, motion restraint, and no generic AI patterns.

Non-negotiable functional rules:
- Do not break any existing dashboard function.
- Do not remove any route.
- Do not rename database fields.
- Do not change server action contracts unless required and tested.
- Do not remove existing auth/session behavior.
- Do not remove inventory.
- Do not make inventory a separate forgotten page only.
- Inventory must be accessible directly inside /dashboard.
- Existing /dashboard/inventory may remain as a focused inventory page, but the dashboard itself must show the inventory workspace or at least a complete inventory section.
- Preserve Indonesian/English localization behavior if it exists.
- Preserve Vercel/Supabase compatibility.
- Preserve mobile usability.

Existing dashboard modules that must remain represented:
1. Analytics
2. Sales
3. Orders
4. Menu
5. Announcements
6. Schedule and Discounts
7. Inventory
8. Settings

Target dashboard UX:
The dashboard should answer these questions within 5 seconds:
- How is my cafe doing today?
- Are orders coming in?
- Which menu items are performing?
- Are guests using the 3D model feature?
- Is anything operationally urgent?
- What stock do I need to restock?
- What action should I take next?

Recommended information architecture:
- Sidebar remains the main navigation.
- /dashboard becomes the main command center.
- Use Efferd dashboard 8 layout as the main visual pattern.
- Put top-level analytics first.
- Put inventory inside the same dashboard page below or beside the main analytics section.
- Use a right rail for alerts, stock warnings, pending orders, or recommended actions.
- Keep focused pages for deeper management, such as /dashboard/inventory, /dashboard/menu, /dashboard/orders.

Suggested /dashboard layout:
1. Header
   - Cafe name
   - Date range selector
   - Primary quick action
   - Optional language/account controls

2. Today Overview
   - Omzet hari ini
   - Pesanan aktif
   - Tampilan menu
   - Lihat model 3D
   - Konversi ke pesanan
   - Stok kritis

3. Main Analytics Row
   - Activity chart
   - Funnel engagement
   - Peak-hour insight

4. Operations Row
   - Pending/recent orders
   - Top menu performance
   - Recent customer actions

5. Inventory Workspace
   - Inventory summary cards
   - Critical stock strip
   - Inventory table
   - Recent stock movement panel
   - Clear action button for adding item or recording movement

6. Secondary Sections
   - Schedule and discounts status
   - Announcements preview
   - Cafe profile completeness or branding status

Visual direction:
- Dark operational dashboard is acceptable if it matches current 3Diner identity.
- Keep the orange 3Diner accent, but refine it.
- Accent should feel intentional, not loud everywhere.
- Use one primary accent color and a small semantic set:
  - Orange for primary brand/action
  - Emerald/teal for positive/healthy
  - Amber for warning
  - Red for critical
  - Blue/navy for neutral information
- Avoid purple-blue AI gradients.
- Avoid random glowing blobs.
- Avoid decorative orbs.
- Avoid fake glassmorphism everywhere.
- Avoid oversized marketing hero sections.
- Avoid card-inside-card layouts.
- Avoid empty decorative UI.
- Avoid huge typography inside dense product panels.

Data and behavior preservation:
Before editing:
- Read the dashboard route files.
- Read shared dashboard components.
- Read inventory components.
- Read server actions.
- Read Supabase helpers.
- Read tests.
- Understand existing data shape.

During redesign:
- Keep all existing data fetches working.
- Keep server/client component boundaries valid.
- Keep server actions compatible.
- Keep revalidation paths correct.
- Keep loading/empty/error states.
- Do not replace real data with static mock data.
- Temporary mock data is only allowed inside isolated preview components and must not ship to production routes.

Testing requirements:
Run:
- npm test -- --run
- npx tsc --noEmit
- npm run build
- eslint or scoped lint command used by the project
- git diff --check

Visual QA requirements:
Use browser or Playwright to check:
- /dashboard desktop
- /dashboard mobile 390px width
- /dashboard/inventory if it exists
- Sidebar navigation
- Date controls
- Inventory CTA
- No horizontal overflow
- No text clipping
- No overlapping UI
- Metric cards remain readable
- Table is usable on mobile
- Console has no serious errors

Anti AI-slop checklist:
- No generic centered SaaS hero
- No random gradients
- No purple-blue AI glow unless brand requires it
- No decorative blobs/orbs
- No repeated identical card grids everywhere
- No oversized empty whitespace in operational areas
- No tiny unreadable labels
- No low-contrast text
- No placeholder "Acme", "Jane Doe", or fake SaaS copy
- No irrelevant marketing copy inside dashboard
- No icons mixed from multiple libraries
- No inconsistent border radius
- No inconsistent accent colors
- No card inside card unless it is a real nested tool
- No broken mobile layout
- No clipped Indonesian text
- No fake data replacing real data
- No animation that blocks use
- No removed features

Definition of done:
The work is done only when:
- The brand folder has been read and followed.
- Efferd dashboard 8 is installed or the missing token block is clearly reported.
- /dashboard has been rebuilt visually using dashboard 8 as the foundation.
- The final visual result still feels like 3Diner.
- All existing dashboard features still work.
- Inventory is integrated into /dashboard.
- /dashboard/inventory remains usable if present.
- Tests pass.
- Typecheck passes.
- Build passes.
- Visual QA passes on desktop and mobile.
- Changes are committed and pushed.
- Final summary includes what changed, files touched, verification results, GitHub branch/commit/PR or merged status, and preview or production URL.
```
