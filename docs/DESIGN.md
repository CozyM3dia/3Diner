# Design System: 3Diner — Smart Menu 3D/AR

## 1. Visual Theme & Atmosphere

A premium, tactile food-tech interface — confident and warm like a high-end restaurant's physical menu, elevated by spatial depth cues from the 3D/AR product. Density 4 (Daily App Balanced): generous white space with structured content rhythm. Variance 7 (Offset Asymmetric): editorial layout shifts, staggered card grids, no boring symmetry. Motion 6 (Fluid CSS): spring-physics transitions that feel weighty and deliberate. 

The atmosphere is "night market meets design studio" — deep navy backgrounds give depth, warm orange punctuates action and appetite. Grain overlay on hero sections adds analog warmth. The UI should feel like a boutique F&B brand's digital presence, not a generic food delivery clone.

This is a MOBILE-FIRST app (375–430px). No desktop layout needed. Touch-first, thumb-zone aware.

## 2. Color Palette & Roles

- **Deep Navy** (#022C60) — primary text, navbars, strong structural elements
- **Midnight Navy** (#002355) — dark overlays, footer backgrounds
- **Muted Navy** (#51698F) — secondary text, metadata, disabled states
- **Paper White** (#F6F8FB) — primary app background surface
- **Pure Surface** (#FDFDFD) — card fills, input fields, modal backgrounds
- **Soft Surface** (#E0E7EE) — skeleton loaders, dividers, inactive tabs
- **Whisper Border** (#CFD9E4) — 1px card outlines, separator lines
- **Signal Orange** (#FD5002) — PRIMARY ACCENT. CTAs, "Lihat 3D" badges, active states, focus rings. This is the single accent. Use sparingly for maximum impact.
- **Orange Warm** (#FC6A41) — hover state of orange CTA, gradient end
- **Orange Blush** (#FDD8C3) — light tint background for badge chips, tag fills

## 3. Typography Rules

- **Display / Hero Headlines:** Plus Jakarta Sans, weight 700–800. Track-tight (-0.03em). Use for dish names in hero positions and cafe identity. Scale: 28px–40px max on mobile.
- **Section Headers:** Plus Jakarta Sans, weight 600–700. 18px–22px. Navy deep color.
- **Body / Descriptions:** Outfit, weight 400. 14px–16px. Line-height 1.6. Muted navy (#51698F) for secondary. Max 58 characters per line on mobile.
- **Price / Numeric Data:** Outfit, weight 700. Orange accent color. Numbers must always be visually prominent.
- **UI Labels / Badges / Metadata:** Outfit, weight 500. 11px–13px. Uppercase tracking for category chips.
- **BANNED:** Inter font anywhere. Generic system fonts. Pure black text (#000000) — use #022C60 navy instead.

## 4. Component Stylings

**Buttons — Primary (Order/CTA):**
- Orange (#FD5002) fill, white text, 18px border-radius
- Minimum 52px height for thumb friendliness
- Tactile: -2px translateY + shadow compression on active state
- No outer glow. No neon. Shadow tinted to orange: `0 6px 20px rgba(253,80,2,0.30)`
- Full-width in detail views, inline in cards

**Buttons — Secondary (3D View):**
- Ghost style: 1px navy border (#CFD9E4), navy text, transparent fill
- Same height as primary. Same border-radius.
- On active: navy fill (#022C60), white text

**Buttons — 3D Badge:**
- Small pill chip: orange-blush (#FDD8C3) background, orange (#FD5002) text
- "3D" or "3D + AR" label, 11px Outfit uppercase
- Sits as absolute overlay on bottom-left of menu card image

**Cards — Menu Cards:**
- Generously rounded: 16px border-radius
- Pure surface (#FDFDFD) fill with whisper border (1px #CFD9E4)
- Layered shadow: `0 4px 14px rgba(2,44,96,0.08), 0 2px 4px rgba(2,44,96,0.05)`
- Image takes 55% of card height, object-fit cover
- Price in orange, dish name in navy 600 weight
- 3D badge on image (bottom-left absolute)
- No 3-column equal grid — use 2-column asymmetric grid or single-column scroll

**Category Filter Chips:**
- Horizontal scroll row, no scrollbar visible
- Inactive: soft surface (#E0E7EE) fill, muted navy text, 99px border-radius
- Active: deep navy (#022C60) fill, white text
- 12px Outfit uppercase letter-spacing

**Inputs / Search:**
- Rounded pill: 99px border-radius for search bar
- Soft surface fill (#E0E7EE), no border in rest state
- Focus: 2px orange border ring (#FD5002)
- Search icon in muted navy, 44px min-height touch target
- Label above, no floating labels

**Bottom Navigation:**
- 5-item max. Deep navy background (#022C60)
- Active item: orange dot indicator + orange icon tint
- Icon + small label below. 56px height minimum.

**Skeletons / Loading:**
- Shimmer animation on soft surface (#E0E7EE) base
- Match exact dimensions of content being loaded
- No circular spinners. No "Loading..." text.

**3D Viewer Controls:**
- Dark overlay on bottom 30% of screen
- Floating pill buttons for AR/rotate controls
- Navy-dark (#002355) semi-transparent background with blur
- Orange accent on active/primary action button

## 5. Layout Principles

- **Mobile-first 375px base.** Single column always. No horizontal scroll.
- **Touch-zone aware:** Primary actions in bottom 40% of screen (thumb zone)
- **Asymmetric card grids:** 2-column with alternating large/small sizing, NOT equal 3-column
- **Section spacing:** 24px between major sections, 12px between related elements
- **Horizontal padding:** 16px page gutter
- **Image-forward:** Food photography dominates — UI chrome is minimal, content leads
- **Bottom sheet pattern** for filters and confirmations — no modal overlays
- **Full-height screens** use `min-h-[100dvh]` never `h-screen` (iOS Safari fix)
- **Sticky elements:** Category filter bar sticks below header; order CTA sticks above bottom nav

## 6. Motion & Interaction

- **Spring physics:** stiffness 120, damping 18 — snappy but not jarring. Like physical menu pages.
- **Card tap:** scale(0.97) on press, spring back on release. No color flash.
- **Page transitions:** Slide-left for drilling in (cafe → dish → 3D). Slide-right for back.
- **3D model entrance:** Fade-in + subtle float animation loop on 3D viewer page
- **Category switch:** Content area fades out (80ms) and fades in (200ms) with stagger on cards
- **Skeleton → content:** Opacity 0→1 with translate(0, 8px)→(0,0) stagger per card
- **AR mode:** Camera view slides up from bottom, overlaying UI with minimal chrome
- **Perpetual micro:** 3D badge on cards has subtle pulse (scale 1.0→1.05, 2s loop) to draw attention
- **Performance:** transform + opacity only. No layout animations.

## 7. Anti-Patterns (BANNED)

- No emojis anywhere in the UI
- No Inter font
- No pure black (#000000) — use Deep Navy (#022C60)
- No neon glows, outer glow shadows, or purple/blue gradient accents
- No 3-column equal card grids
- No centered hero layouts (this is mobile, use left-aligned or full-bleed)
- No generic AI copywriting: "Elevate Your Dining", "Seamless Experience", "Next-Gen Menu", "Unleash", "Revolutionary"
- No fake round numbers in copy ("100+ cafes", "99.9% satisfaction")  
- No "Scroll to explore" text or scroll arrows
- No generic placeholders ("Cafe Name", "Menu Item", "John Doe")
- No broken image placeholders — use navy placeholder with fork icon SVG
- No gradient text on headings — use solid colors with weight hierarchy instead
- No card stacking/overlapping — every element in its own spatial zone
- No custom mouse cursors
- No modal overlays for filters — use bottom sheets

## 8. Screen Inventory (MVP Customer App)

The customer app is accessed via QR code scan. No login required for customers.

**Flow:** QR Scan → Cafe Home → Menu Browse → Dish Detail → 3D Viewer → AR Mode → Order (redirect)

Screens to design:
1. Splash Screen (branded loading)
2. Onboarding Slide 1 — Value prop hero
3. Onboarding Slide 2 — 3D feature showcase
4. Onboarding Slide 3 — How to order
5. Cafe Home Page — Header, search, categories, menu grid
6. Menu Grid (category filtered)
7. Dish Detail Page — Full photo, info, 3D + Order CTAs
8. 3D Viewer Page — Immersive 3D model, rotate controls
9. AR Mode — Camera + placed dish, minimal UI
10. Empty State — Cafe inactive/not found
11. Search Results — Dish search
