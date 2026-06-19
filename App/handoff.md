# 3Diner Project Handoff Documentation

This document provides a comprehensive overview of the **3Diner** project codebase, its architecture, key design decisions, and implementation details for 3D/AR rendering to assist in transitioning development to **Claude Code**.

---

## 1. Project Profile & Stack

* **Project Name:** 3Diner (3D/AR Interactive Food Menu Website)
* **Repository:** `CozyM3dia/3Dinner_Website`
* **Core Technology Stack:**
  * **Framework:** Next.js (App Router, Turbopack enabled)
  * **Languages:** TypeScript, JavaScript
  * **Frontend Library:** React 19 / React DOM 19
  * **3D Engines:** 
    * Three.js (`three`)
    * `@mkkellogg/gaussian-splats-3d` (for `.ply` Splat rendering)
    * `@google/model-viewer` (for `.glb`/`.usdz` universal rendering)
  * **Styling:** Vanilla CSS & Tailwind CSS (PostCSS v4)
  * **Database/Auth:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
  * **Deployment Platform:** Vercel

---

## 2. Key Directories & File Map

* `src/app/[slug]/[menu_id]/page.tsx`: Menu detail page which holds action buttons ("Lihat 3D Model" & "View in AR").
* `src/app/[slug]/[menu_id]/3d/page.tsx`: Server page that serves the full-screen 3D model viewer.
* `src/components/viewer/Viewer3DPage.tsx`: Client-side full-screen 3D renderer. Bypasses Gaussian Splats and mounts `<model-viewer>` if the asset URL ends in `.glb`.
* `src/components/viewer/ARSession.tsx`: Full-screen overlay launching AR. Supports WebXR (`immersive-ar`) for `.ply` splats and `.activateAR()` for `.glb` models.
* `src/lib/dummy-data.ts`: Mock database containing cafe and menu items. Includes the new test item `"Pixel Robot"` (`menu-009`) in `.glb` format.
* `src/lib/fit-camera.ts`: Calculations to fit the perspective camera bounds to the size of a loaded `.ply` splat model.
* `public/models/`: Holds static assets (`sushi.ply`, `tomatoes.ply`, and `pixellabs-robot-3332.glb`).
* `.npmrc`: Configured with `legacy-peer-deps=true` to resolve peer conflicts between `@google/model-viewer` and `three` on Vercel builds.

---

## 3. AR Implementation Architectures

The project supports two parallel pipelines based on the 3D asset format:

### A. Gaussian Splatting Pipeline (`.ply`)
* **Viewer:** Custom WebGL canvas initialized by `@mkkellogg/gaussian-splats-3d`.
* **AR Mode:** Implemented via standard WebXR `immersive-ar` session.
* **Compatibility:** Android Google Chrome with ARCore services installed. (iOS is completely unsupported).
* **Overlay Handling:** Utilizes a dedicated `uiOverlayRef` mapped to `domOverlay: { root: ... }` in WebXR options. Crucial for Android compliance (Chrome blocks camera access if DOM overlay is not defined properly).
* **Auto-Scaling:** Once the XR session starts (`sessionstart`), the splatMesh bounding box is calculated. The model is scaled down to a realistic tabletop size (~20cm) and positioned 0.5m forward and 0.3m below camera origin. The transform is fully restored to original proportions on exit (`sessionend`).

### B. Universal GLB Pipeline (`.glb`)
* **Viewer:** Powered by Google's `@google/model-viewer` web component.
* **AR Mode:** Native device triggers via `.activateAR()` method.
* **Compatibility:** Extremely high. 
  * **iOS Safari:** Automatically opens native **AR Quick Look** (needs `.usdz` specified in `ios-src`).
  * **Android Chrome:** Automatically launches **Google Scene Viewer** (or WebXR) without requiring complex browser permissions.
* **Loading Lifecycle:** The React loading screen remains active and tracks the `<model-viewer>`'s native `load` event. The "Mulai AR" trigger button only becomes active when `load` resolves, preventing silent failures.
* **TS Intrinsic Element Fix:** To prevent compilation errors on custom element tags (`<model-viewer>`) across React versions, both components declare `const ModelViewerElement = "model-viewer" as any;` and render `<ModelViewerElement />`.

---

## 4. Key Configurations & Setup Gotchas

1. **Vercel Peer Conflict Build Blocks:**
   `@google/model-viewer` has strict peer dependencies on `three` versions (e.g., `^0.182.0`). Since this project uses `three@^0.184.0`, standard `npm install` fails. The `.npmrc` file with `legacy-peer-deps=true` is mandatory to bypass this during automated build pipelines.
2. **Same-Origin Fetches for Splat Workers:**
   Chrome's worker threads block cross-origin files. The PLY data is fetched on the main thread, packed into a same-origin Blob URL using `URL.createObjectURL()`, and then fed to the Gaussian Splat viewer.
3. **iPhone AR Fallback:**
   For iPhone users to see models in AR, a `.usdz` conversion is required. The element supports this via `<ModelViewerElement ios-src="/path/to/model.usdz" />`.

---

## 5. Instant GLB-to-USDZ Conversion Guidelines

For production use, runtime conversion of GLB to USDZ on the web server is too slow (taking 3-10s) and requires extensive system tools. 
**Recommended Strategy:** 
* Pre-convert models when the cafe manager uploads them.
* Save both `.glb` (Android) and `.usdz` (iOS) in Supabase Storage.
* Render both URLs in the model-viewer element.
