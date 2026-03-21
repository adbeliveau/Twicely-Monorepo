# TWICELY V3 — SLICE B4: Order Management

**User story:** "As a seller, I see incoming orders and mark shipped. As a buyer, I see order status."

---

## RULES (ACTIVE FOR ENTIRE B4 — NO EXCEPTIONS)

1. NO WORKAROUNDS. If something doesn't compile, fix the ROOT CAUSE. Do not create stub files, shim files, polyfills, wrapper modules, or declaration files to suppress errors.
2. NO SILENT FILE CREATION. Before creating ANY file not explicitly listed in a section, stop and tell me what you want to create and why. Wait for approval.
3. EXPLAIN EVERY FIX IN PLAIN ENGLISH. When something breaks, tell me: what broke, why it broke, and what you're going to do about it. One sentence each.
4. WHEN IN DOUBT, ASK. Do not improvise. Do not "try something." If the prompt doesn't cover the situation, stop and ask.
5. AFTER EVERY SECTION, SHOW FULL VERIFICATION OUTPUT. Don't just say "PASS" — show actual terminal output.
6. Do NOT proceed to the next section until I say "approved" or "continue." If I don't say it, STOP.
7. No `as any`. No `as unknown as T`. No `@ts-ignore`. Fix the type.
8. No file over 300 lines. Split it.
9. Use ONLY the schema columns that exist in `src/lib/db/schema/commerce.ts`. Do NOT invent columns. If you need a column, STOP and tell me.
10. Do NOT install packages without telling me first and getting approval.
11. All server actions go in `src/lib/actions/`. All queries go in `src/lib/queries/`. Business logic goes in `src/lib/commerce/`. Components go in `src/components/pages/`. Do NOT put logic in page files beyond data fetching and rendering.
12. Do NOT use `'use server'` on utility functions. Only use it on files that export server actions callable from the client.

### B4-SPECIFIC PROHIBITIONS (based on B3 mistakes)

13. Order status transitions MUST follow this state machine. Do NOT invent transitions:
    - CREATED → PAID (set by B3 checkout)
    - PAID → SHIPPED (seller marks shipped with tracking)
    - SHIPPED → DELIVERED (manual confirmation or future webhook)
    - DELIVERED → COMPLETED (auto after 3 days or buyer confirms)
    - PAID → CANCELED (seller or buyer cancels before shipment)
    - Any status → DISPUTED / REFUNDED (future phases C4/C5, NOT B4)
14. The `shipment` table is in the schema. Use it. Do NOT store shipping data only on the order table — the order has convenience fields (trackingNumber, carrierCode) but the full shipment record MUST be created in the `shipment` table.
15. Ship-by deadline: `expectedShipByAt` = `paidAt` + `handlingDueDays` business days. Set this when order transitions to PAID. B3 does NOT set it — you must set it retroactively on the "mark shipped" flow or in a query that calculates it.
16. Late shipment: if seller ships after `expectedShipByAt`, set `order.isLateShipment = true` and `shipment.lateShipment = true`.
17. Shipping mode for B4 is **manual tracking entry only** (Own Label). Shippo label purchase is Phase D or later. Do NOT integrate Shippo. The ship form asks for: carrier (dropdown: USPS/UPS/FedEx/Other), tracking number (text input). That's it.
18. Do NOT build batch shipping. Single order shipping only in B4.
19. Do NOT build shipping presets. That's Phase D.
20. Image queries MUST filter by listing IDs. Do NOT fetch all images from the table. Always use `inArray(listingImage.listingId, listingIds)`.
21. The buyer order detail page shows a shipping tracker (progress bar: Paid → Shipped → In Transit → Delivered). For B4, transitions beyond SHIPPED are manual. The tracker is a visual component, not a real-time system.
22. Seller order list MUST show "Awaiting Shipment" orders first with ship-by countdown. This is the priority view per the page registry.
23. Do NOT build the `/my/buying` overview page as a full dashboard. It's a simple page with "Recent Orders" list and a link to `/my/buying/orders`. Keep it under 80 lines.

---

## PRE-CHECKS (run these first, show output)

```bash
# TypeScript clean
npx tsc --noEmit

# Lint clean
pnpm lint

# Verify order and shipment tables exist in schema
grep -n "export const order " src/lib/db/schema/commerce.ts
grep -n "export const shipment " src/lib/db/schema/commerce.ts
grep -n "export const orderItem " src/lib/db/schema/commerce.ts

# Verify shipment is exported from schema index
grep -n "shipment" src/lib/db/schema/index.ts

# Verify order status enum values
grep -n "orderStatusEnum" src/lib/db/schema/commerce.ts

# Verify shipment status enum values
grep -n "shipmentStatusEnum" src/lib/db/schema/commerce.ts
```

If `shipment` is NOT exported from `src/lib/db/schema/index.ts`, add the export. Show me the fix.

**STOP. Show pre-check output. Do NOT start B4.1 until I approve.**

---

## B4.1: Order Queries

**Files to create:**
- `src/lib/queries/orders.ts` — Order queries for both buyer and seller views

**What this file contains:**
- `getBuyerOrders(userId, filters?)` — Paginated orders where buyerId = userId. Filterable by status (All/Active/Completed/Canceled). Returns: orderId, orderNumber, status, totalCents, createdAt, first item thumbnail + title, itemCount.
- `getSellerOrders(userId, filters?)` — Paginated orders where sellerId = userId. Filterable by status. Returns same fields plus: buyerName, expectedShipByAt, isLateShipment. **Sort: PAID orders first (awaiting shipment), then by createdAt desc.**
- `getOrderDetail(orderId, userId)` — Full order detail. Verifies userId is either buyer or seller on the order. Returns: order fields, all orderItems with listing title + image, shipment record (if exists), buyer info (name only), seller info (name, storeName).
- `getOrderItems(orderId)` — Order items with listing images. Uses `inArray` for image query.

**Type exports:**
- `BuyerOrderSummary` — Used by buyer orders list
- `SellerOrderSummary` — Used by seller orders list (extends buyer with ship-by info)
- `OrderDetailData` — Used by order detail pages

**Pagination:** Use offset-based pagination. Accept `page` (1-indexed) and `pageSize` (default 20). Return `{ items, totalCount, page, pageSize, totalPages }`.

**Verification:**
```bash
npx tsc --noEmit
pnpm lint
grep -n "getBuyerOrders\|getSellerOrders\|getOrderDetail" src/lib/queries/orders.ts
grep -n "inArray" src/lib/queries/orders.ts || echo "ERROR: No inArray for images"
wc -l src/lib/queries/orders.ts
```

If the file exceeds 300 lines, split into `orders-buyer.ts` and `orders-seller.ts`.

**STOP. Show output. Wait for approval.**

---

## B4.2: Order Status Actions

**Files to create:**
- `src/lib/actions/orders.ts` — Server actions for order status transitions
- `src/lib/commerce/shipping.ts` — Shipping business logic (NOT a server action)

**`src/lib/commerce/shipping.ts` contains:**
- `markOrderShipped(orderId, sellerId, carrier, trackingNumber)` — Business logic (NOT 'use server'):
  1. Verify order exists, sellerId matches, status is PAID
  2. Create `shipment` record with: carrier, tracking, status='PICKED_UP', fromAddressJson (from seller's default address), toAddressJson (from order.shippingAddressJson), shippedAt=now()
  3. Update order: status='SHIPPED', trackingNumber, carrierCode, shippedAt=now()
  4. Check if shippedAt > expectedShipByAt → set isLateShipment=true on both order and shipment
  5. Return { success, shipmentId, isLate }
- `cancelOrder(orderId, userId, reason)` — Cancel an order. Only works if status is PAID (not yet shipped). Sets status='CANCELED', canceledAt=now(), canceledByUserId, cancelReason, cancelInitiator (BUYER or SELLER based on who userId is).
- `markOrderDelivered(orderId, userId)` — Manual delivery confirmation. Only works if status is SHIPPED. Sets order status='DELIVERED', deliveredAt=now(). Updates shipment status='DELIVERED', deliveredAt=now().

**`src/lib/actions/orders.ts` contains (these ARE 'use server'):**
- `shipOrder(orderId, carrier, trackingNumber)` — Authenticates user, calls markOrderShipped
- `cancelOrderAction(orderId, reason)` — Authenticates user, calls cancelOrder
- `confirmDelivery(orderId)` — Authenticates user, calls markOrderDelivered

**Carrier values:** 'USPS' | 'UPS' | 'FEDEX' | 'OTHER'

**Validation:**
- Tracking number: required, 5-40 characters, alphanumeric + hyphens only
- Carrier: required, must be one of the 4 values
- Reason (cancel): required, 10-500 characters

**Verification:**
```bash
npx tsc --noEmit
pnpm lint
grep -n "'use server'" src/lib/commerce/shipping.ts && echo "ERROR: use server in commerce file" || echo "OK: no use server in shipping.ts"
grep -n "'use server'" src/lib/actions/orders.ts || echo "ERROR: missing use server in actions"
grep -n "shipment" src/lib/commerce/shipping.ts || echo "ERROR: no shipment table usage"
grep -n "isLateShipment\|lateShipment" src/lib/commerce/shipping.ts || echo "ERROR: no late shipment check"
grep -n "cancelInitiator" src/lib/commerce/shipping.ts || echo "ERROR: no cancel initiator"
```

**STOP. Show output. Wait for approval.**

---

## B4.3: Buyer Order Pages

**Files to create:**
- `src/app/(marketplace)/my/buying/page.tsx` — Buying overview (simple, under 80 lines)
- `src/app/(marketplace)/my/buying/orders/page.tsx` — My Purchases list
- `src/app/(marketplace)/my/buying/orders/[id]/page.tsx` — Buyer order detail
- `src/components/pages/orders/buyer-order-list.tsx` — Client component for order list with filters
- `src/components/pages/orders/order-status-badge.tsx` — Reusable status badge (shared by buyer + seller)
- `src/components/pages/orders/shipping-tracker.tsx` — Visual progress bar (Paid → Shipped → In Transit → Delivered)

**`/my/buying` (Buying Overview):**
- Simple page. Heading "My Purchases". Link to `/my/buying/orders`. Shows last 5 orders. If no orders: "You haven't bought anything yet" + browse CTA.
- Under 80 lines. Do NOT build a full dashboard.

**`/my/buying/orders` (My Purchases):**
- Server component fetches orders via `getBuyerOrders`
- Filter tabs: All / Active (PAID, SHIPPED) / Completed (DELIVERED, COMPLETED) / Canceled
- Paginated table/list: order number, first item thumbnail + title, date, status badge, total
- Empty state: "You haven't bought anything yet" + browse CTA
- Each row links to `/my/buying/orders/[id]`

**`/my/buying/orders/[id]` (Order Detail):**
- Server component fetches via `getOrderDetail(orderId, userId)` — must verify buyer owns this order
- Sections: order header (number, date, status badge), shipping tracker, item list (thumbnail, title, qty, price), payment summary (subtotal, shipping, tax, total), shipping address, seller info (name/store)
- Action buttons based on status:
  - SHIPPED/DELIVERED: "Confirm Delivery" button (calls confirmDelivery)
  - No return/dispute/review buttons in B4 — those are Phase C

**`order-status-badge.tsx`:**
- Maps status to color: PAID=blue, SHIPPED=orange, DELIVERED=green, COMPLETED=green, CANCELED=red, CREATED=gray
- Reusable by both buyer and seller pages

**`shipping-tracker.tsx`:**
- Horizontal progress bar with 4 steps: Ordered → Shipped → In Transit → Delivered
- Highlights current step based on order status
- Shows dates below each completed step (paidAt, shippedAt, deliveredAt)
- If CANCELED: show "Order Canceled" state instead of tracker

**Verification:**
```bash
npx tsc --noEmit
pnpm lint
test -f "src/app/(marketplace)/my/buying/page.tsx" && echo "OK" || echo "MISSING"
test -f "src/app/(marketplace)/my/buying/orders/page.tsx" && echo "OK" || echo "MISSING"
test -f "src/app/(marketplace)/my/buying/orders/[id]/page.tsx" && echo "OK" || echo "MISSING"
test -f "src/components/pages/orders/shipping-tracker.tsx" && echo "OK" || echo "MISSING"
test -f "src/components/pages/orders/order-status-badge.tsx" && echo "OK" || echo "MISSING"
wc -l src/app/\(marketplace\)/my/buying/page.tsx
```

The buying overview page MUST be under 80 lines. If it's over, you went too far.

**STOP. Show output. Wait for approval.**

---

## B4.4: Seller Order Pages

**Files to create:**
- `src/app/(marketplace)/my/selling/orders/page.tsx` — Seller orders list
- `src/app/(marketplace)/my/selling/orders/[id]/page.tsx` — Seller order detail
- `src/app/(marketplace)/my/selling/orders/[id]/ship/page.tsx` — Ship order form
- `src/components/pages/orders/seller-order-list.tsx` — Client component for seller order list
- `src/components/pages/orders/ship-order-form.tsx` — Ship form (carrier dropdown + tracking input)

**`/my/selling/orders` (Seller Orders):**
- Server component fetches via `getSellerOrders`
- **CRITICAL: "Awaiting Shipment" (status=PAID) orders shown FIRST** with orange badge and ship-by countdown
- Ship-by countdown: "Ship by Feb 20" with color coding:
  - Green: >2 days remaining
  - Yellow: 1-2 days remaining
  - Red: <1 day or overdue
  - "LATE" badge if past deadline
- Filter tabs: Awaiting Shipment / Shipped / Delivered / All / Canceled
- Each row has a "Ship" quick-action button (links to /my/selling/orders/[id]/ship)
- Empty state: "No orders yet — share your listings to get sales"

**`/my/selling/orders/[id]` (Seller Order Detail):**
- Same data as buyer detail but from seller perspective
- Shows buyer name (first name + last initial only for privacy)
- Shows buyer note if present
- Shows gift message if isGift=true
- Action buttons:
  - PAID: "Ship Order" button (links to ship page) + "Cancel Order" button
  - SHIPPED: "Mark Delivered" button (manual confirmation)
  - CANCELED: read-only, shows cancel reason

**`/my/selling/orders/[id]/ship` (Ship Order Form):**
- Gate: order must be PAID and belong to this seller. If not → redirect to order detail.
- Form fields:
  - Carrier: dropdown (USPS, UPS, FedEx, Other) — REQUIRED
  - Tracking Number: text input — REQUIRED, 5-40 chars
- Shows order summary on the right (item, buyer shipping address)
- Submit calls `shipOrder` server action
- On success: redirect to `/my/selling/orders/[id]` with success toast/message
- On error: show inline error, stay on form
- **Do NOT integrate Shippo. Do NOT show label purchase options. Manual tracking only.**

**`ship-order-form.tsx`:**
- Client component with form validation
- Carrier dropdown with 4 options
- Tracking number input with validation (5-40 chars, alphanumeric + hyphens)
- Loading state on submit button

**Verification:**
```bash
npx tsc --noEmit
pnpm lint
test -f "src/app/(marketplace)/my/selling/orders/page.tsx" && echo "OK" || echo "MISSING"
test -f "src/app/(marketplace)/my/selling/orders/[id]/page.tsx" && echo "OK" || echo "MISSING"
test -f "src/app/(marketplace)/my/selling/orders/[id]/ship/page.tsx" && echo "OK" || echo "MISSING"
grep -n "Shippo\|shippo\|SHIPPO" src/components/pages/orders/ship-order-form.tsx && echo "ERROR: Shippo found" || echo "OK: no Shippo"
grep -n "expectedShipByAt\|ship.by\|shipBy" src/components/pages/orders/seller-order-list.tsx || echo "ERROR: no ship-by deadline"
```

**STOP. Show output. Wait for approval.**

---

## B4.5: Navigation + Selling Layout Updates

**Files to modify:**
- `src/app/(marketplace)/my/selling/layout.tsx` — Add "Orders" link to seller nav
- Any shared navigation component that needs buyer "My Purchases" link

**Changes:**
- Seller nav: add "Orders" link pointing to `/my/selling/orders` (between Listings and whatever comes after)
- Buyer nav/dashboard: add "My Purchases" link pointing to `/my/buying/orders`
- Ensure both links show active state when on the respective pages

**Do NOT create new layout files. Modify existing ones only.**

**Verification:**
```bash
npx tsc --noEmit
pnpm lint
grep -n "selling/orders" src/app/\(marketplace\)/my/selling/layout.tsx || echo "ERROR: no orders link in seller nav"
```

**STOP. Show output. Wait for approval.**

---

## B4.6: Build + Smoke Test

```bash
# Full TypeScript check
npx tsc --noEmit

# Full lint
pnpm lint

# Production build
pnpm build

# Show route table from build output (copy the Route (app) section)
```

All B4 routes must appear in the build output:
- `/my/buying`
- `/my/buying/orders`
- `/my/buying/orders/[id]`
- `/my/selling/orders`
- `/my/selling/orders/[id]`
- `/my/selling/orders/[id]/ship`

If any are missing, fix before proceeding.

After build succeeds, start dev server and smoke test:
```bash
pnpm dev &
sleep 8

# Test pages compile (307 = auth redirect = expected)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/my/buying/orders
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/my/selling/orders
```

Show all output.

**After smoke test passes:**
```bash
git add -A && git commit -m "B4 complete: buyer orders, seller orders, ship order, status transitions, shipping tracker

- Buyer: purchases list with filters, order detail with shipping tracker
- Seller: orders list with awaiting-shipment priority, ship-by deadline countdown
- Ship order: manual tracking entry (carrier + tracking number)
- Status transitions: PAID→SHIPPED→DELIVERED→COMPLETED, PAID→CANCELED
- Late shipment detection on order and shipment records
- Shared components: order-status-badge, shipping-tracker

Co-Authored-By: Claude <noreply@anthropic.com>"
```

Create tar checkpoint:
```bash
cd .. && tar -cf twicely-b4-complete.tar Twicely/ && cd Twicely
ls -la ../twicely-b4-complete.tar
```

**STOP. Show all output. B4 is complete.**
