# Menu Detail to 3D Viewer Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a premium GSAP transition from a menu detail hero into the 3D viewer while preserving navigation, accessibility, and all current viewer behavior.

**Architecture:** A focused client link builds and animates a fixed portal before routing. The existing viewer adds a scoped entrance timeline. Both paths honor reduced motion and clean up animation state.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, GSAP 3, `@gsap/react`, Vitest, Testing Library.

## Global Constraints

- Keep the existing Poppins, navy, orange, radius, and icon system.
- Preserve a real link `href` and do not intercept modifier or non-primary clicks.
- Do not delay navigation for reduced-motion users.
- Do not alter GLB, PLY, AR, inventory, cart, or order behavior.
- Keep animated properties transform/opacity-based and clean up GSAP effects on unmount.

---

### Task 1: Animated 3D Transition Link

**Files:**
- Create: `src/components/Menu3DTransitionLink.tsx`
- Modify: `src/app/[slug]/[menu_id]/page.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/menu-3d-transition.test.tsx`

**Interfaces:**
- Consumes: `href`, `menuName`, `imageUrl`, and `heroId` from the detail page.
- Produces: an accessible link that performs an interruptible GSAP portal animation before `router.push(href)`.

- [ ] **Step 1: Write failing interaction tests**

Cover primary click animation/routing, reduced-motion immediate routing, and modifier-click preservation with mocked `gsap` and `next/navigation`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --run tests/menu-3d-transition.test.tsx`

Expected: FAIL because `Menu3DTransitionLink` does not exist.

- [ ] **Step 3: Implement the transition link and detail-page integration**

Build a fixed, aria-hidden portal from `heroId` bounds; animate it to full viewport, reveal the menu name, darken to navy, set the session transition marker, and route during the final timeline segment. Retain the original CTA dimensions, copy, icon, and href.

- [ ] **Step 4: Run the focused test and verify pass**

Run: `npm test -- --run tests/menu-3d-transition.test.tsx`

Expected: all transition tests PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(viewer): animate entry from menu detail`

### Task 2: Viewer Entrance Continuation

**Files:**
- Modify: `src/components/viewer/Viewer3DPage.tsx`
- Test: `tests/viewer-3d-entrance.test.tsx`

**Interfaces:**
- Consumes: the `3diner:viewer-transition` session marker when available.
- Produces: deterministic refs for viewer shell, header, stage, and controls with a scoped GSAP entrance timeline.

- [ ] **Step 1: Write a failing viewer entrance test**

Mock heavy viewer children and GSAP, render `Viewer3DPage`, and assert that the staged timeline targets the header, stage, and controls while reduced motion immediately sets their visible state.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --run tests/viewer-3d-entrance.test.tsx`

Expected: FAIL because the viewer has no entrance timeline.

- [ ] **Step 3: Add the scoped viewer entrance**

Use `useGSAP` with a root scope, stable element refs/data attributes, a short portal-aware stagger, and immediate visible state for reduced motion. Keep model initialization independent from the entrance timeline.

- [ ] **Step 4: Run focused and full verification**

Run: `npm test -- --run tests/viewer-3d-entrance.test.tsx`

Expected: focused tests PASS.

Run: `npm test -- --run && npx tsc --noEmit && npm run build`

Expected: all tests, type checking, and production build PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(viewer): stage 3d controls on entry`
