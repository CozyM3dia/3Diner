# Menu Detail to 3D Viewer Transition Design

## Goal

Make the move from a menu detail page into its 3D viewer feel continuous and premium without slowing the ordering funnel or changing viewer behavior.

## Experience

The existing navy 3D call to action remains in the menu detail content. Activating it captures the hero image bounds, creates a fixed visual portal using the same dish image (or the existing branded mesh fallback), and expands that portal to the viewport with GSAP. The dish name follows with a restrained text reveal while the portal darkens into the viewer's navy environment.

Navigation begins during the final portion of the animation so route loading overlaps with motion. The destination viewer continues the visual handoff by revealing its header, canvas/loading state, and bottom controls in a short stagger. No animation waits for the 3D asset to finish loading.

## Architecture

- `Menu3DTransitionLink` is an isolated client component responsible for click interception, overlay creation, GSAP timeline cleanup, and navigation.
- The menu detail server page supplies the target URL, menu name, image URL, and a stable hero element identifier.
- `Viewer3DPage` owns only its destination entrance timeline. Existing GLB, PLY, AR, retry, and progress behavior remains unchanged.
- A session-scoped marker distinguishes an intentional animated handoff from direct viewer visits. Direct visits receive a subtle entrance rather than depending on source-page state.

## Motion Contract

- The source portal expands from the hero bounds to the full viewport in under one second.
- The motion uses transform and opacity as the primary animated properties.
- Repeated activation is locked while navigation is in progress.
- `prefers-reduced-motion: reduce` skips the portal and navigates immediately; destination content is immediately visible.
- Every GSAP context and timeline is reverted or killed on unmount.

## Accessibility and UX

- The control remains a real link with a valid `href`, preserving open-in-new-tab and no-JavaScript behavior.
- Keyboard activation follows the same path as pointer activation.
- Modifier clicks and non-primary mouse clicks are not intercepted.
- The temporary overlay is `aria-hidden` and never receives focus.
- Existing focus styling, button contrast, safe-area spacing, and touch target dimensions are preserved.

## Verification

- Component tests cover animated navigation, reduced-motion navigation, and modifier-click preservation.
- Existing inventory/order tests remain green.
- Type checking, lint for touched files, and production build must pass.
- Desktop and mobile browser checks confirm no blank frame, overflow, overlapping controls, or broken viewer interaction.
