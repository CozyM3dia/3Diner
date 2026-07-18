# 3Diner platform hardening and performance design

## Scope

Improve the 3Diner codebase, Supabase database, API security, runtime performance, operational reliability, and developer quality gates without changing the visual UI or user-facing layout.

## Goals

- Make the payment lifecycle server-authoritative and safe for production use.
- Prevent anonymous cross-tenant reads and writes in Supabase.
- Reduce unnecessary application and 3D viewer work without changing its presentation.
- Establish repeatable verification, deployment, and backup practices.

## Non-goals

- Redesigning the UI, navigation, branding, or user flow.
- Changing payment provider from Midtrans.
- Rebuilding the 3D model generation product flow.

## Security and database design

### Order and payment lifecycle

The browser will request order creation with a cafe, table, and selected menu item identifiers. A server route will load active menus for that cafe, calculate the amount from database prices and discounts, generate an unguessable server-side order ID, and create the pending order. It will then create the Midtrans charge using that computed amount.

The Midtrans webhook route will validate the provider signature, transaction status, gross amount, and order binding. It is the only path allowed to set `payment_status` to `paid` and advance an order to preparation. Duplicate notifications must be idempotent. The existing client-side manual paid confirmation will be removed or made non-authoritative while retaining the existing UI presentation.

### Supabase access model

Anonymous clients must not receive unrestricted `Orders` select or update privileges. Creation and sensitive reads will occur through server routes using the service role. If a customer needs to poll an order, the route will require an opaque, order-scoped token and return only safe fields.

Public cafe and menu data will be served from a narrow public view or RPC containing only fields required by the menu experience. Internal cafe fields such as owner ID, customer QR token, and subscription details remain inaccessible to anonymous callers.

Owner-only policies will use `(select auth.uid())`; policies will be consolidated where they are redundant. AI and Tripo routes will validate the signed-in owner/cafe relation, rate-limit calls, validate uploaded files, and persist task ownership before task status, conversion, or save operations are allowed.

The QR proxy will accept only HTTPS URLs on an explicit Midtrans QR host allowlist and reject private, loopback, link-local, or otherwise disallowed addresses.

### Schema and query changes

Migrations will add the missing foreign-key indexes for `Announcements.cafe_id` and `Cafes.owner_id`, add an analytics `(cafe_id, created_at)` index, and introduce appropriate check constraints for prices, discounts, totals, and order item structure. Migration SQL will be transactional where feasible and include safe handling for existing rows that violate a new constraint.

## Performance and code-quality design

Unused public models and duplicate brand assets will be removed only after source and production-reference verification. Purpose-built, compressed 192px and 512px PWA icons will replace the large logo used as an app icon.

The 3D viewer will keep the same UI but clamp device pixel ratio, delay expensive renderer work until the viewer is visible or requested, and release renderer, geometry, material, texture, animation, and event resources on unmount. Existing model compression will be preserved.

Next 16 configuration will be updated from the deprecated middleware convention to proxy where needed. The PWA implementation will be made internally consistent: either a verified service-worker build path is retained, or the unsupported caching plugin is removed while the installable manifest remains. Security headers will include CSP suited to current remote media and payment requirements, frame protection, MIME sniffing protection, referrer policy, permissions policy, and disabled `X-Powered-By`.

Dead environment configuration will be removed only after repository and deployment configuration references are confirmed. A supported Node version will be declared. Dependency updates and overrides will be constrained to verified compatible versions; they will not be applied merely to silence audit output.

Lint remediation will focus on unsafe type boundaries, effects, resource cleanup, and unused values in files touched by this work. Components may be decomposed internally but must preserve rendered structure and styling.

## Verification and operations

Automated tests will cover server-side order totals, invalid order input, Midtrans signature and amount validation, webhook idempotency, authorization boundaries, and database migration assumptions. CI will run type-check, lint, test, and production build.

Documentation will describe environment variables by name only, local startup, Supabase migration/deployment procedure, Vercel deployment behavior, webhook setup, and regular database plus separate Storage export/restore checks. The previously exposed Supabase secret must be rotated and its replacement configured through secure local and Vercel environment settings, never committed or sent in chat.

## Delivery order

1. Rotate the exposed secret and prepare environment configuration.
2. Ship payment/server routes, RLS, schema migration, and API boundary tests.
3. Ship performance, asset, PWA/configuration, and security-header changes.
4. Ship lint, dependency, CI, documentation, and backup-operational improvements.

Each stage is independently build- and test-verified before proceeding. No visual UI changes are in scope.
