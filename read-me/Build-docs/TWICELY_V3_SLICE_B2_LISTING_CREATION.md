# TWICELY V3 — Slice B2: Listing Creation

**User Story:** "As a seller, I can create a listing with photos and publish it. I can manage my listings."

**Prerequisite:** B1 complete (browse, search, categories, listing detail all working).

---

## RULES (Same as B1 — Read These Again)

1. **Do NOT install packages** unless explicitly told. Check what's available first.
2. **Do NOT create files** that aren't listed in the section. No "helpers" or "utils" you invented.
3. **Do NOT add API routes** unless the section says to. Use server actions.
4. **No CSS files.** Tailwind only. No globals.css modifications.
5. **No hardcoded demo data.** Data comes from the database via Drizzle queries.
6. **No `as any`.** No `@ts-ignore`. No `as unknown as T`. Fix the type.
7. **No file over 300 lines.** Split it.
8. **Server Components by default.** Only add `'use client'` when you need interactivity (forms, click handlers, useState).
9. **Do NOT skip ahead.** Complete the section, show verification, STOP.
10. **Do NOT invent fields or columns.** The schema is defined. Use what exists.
11. **Do NOT create Typesense integrations.** B2 doesn't touch search.
12. **Do NOT build crosslister features.** No platform tabs, no channel projections.
13. **URL patterns:** `/my/selling/*` for all seller dashboard pages. Not `/dashboard`, not `/seller`.
14. **Seller activation:** Creating the first listing automatically creates the sellerProfile and sets user.isSeller = true. There is no separate "become a seller" page.
15. **Image upload:** Use local filesystem storage (`public/uploads/`) for dev. R2 integration comes later via the provider system.
16. **Insertion fees:** Track but don't charge in B2. Stripe integration is B3.

---

## WHAT B2 BUILDS

| Page | Route | What |
|------|-------|------|
| Selling Overview | `/my/selling` | Stats dashboard: active listings, total revenue ($0 for now), quick actions |
| My Listings | `/my/selling/listings` | Table of seller's listings, status tabs (All/Active/Draft/Paused/Sold/Ended), batch actions |
| Create Listing | `/my/selling/listings/new` | Full listing creation form with image upload |
| Edit Listing | `/my/selling/listings/[id]/edit` | Pre-populated form, same layout as create |

**Deferred to later phases:**
- Bulk CSV upload (`/my/selling/listings/bulk`) → deferred
- Rich text description editor → plain textarea for B2
- Crop/rotate image tools → deferred
- Dynamic category-driven attribute fields → basic version (brand, tags) for B2
- Shipping presets → basic weight/dimensions for B2
- Crosslist toggles → Phase F

---

## SECTION B2.1 — Seller Dashboard Layout + Selling Overview

**Creates ~5 files. Hard stop after.**

This section builds the shared seller dashboard layout and the selling overview page. Non-sellers accessing `/my/selling/*` see an "enable selling" CTA that redirects to the listing creation form.

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/app/(marketplace)/my/selling/layout.tsx` | Server Component | Sidebar nav for selling pages, seller gate check |
| 2 | `src/app/(marketplace)/my/selling/page.tsx` | Server Component | Selling overview with stats cards |
| 3 | `src/components/shared/selling-sidebar.tsx` | Client Component | Sidebar navigation for `/my/selling/*` |
| 4 | `src/lib/queries/seller.ts` | Query | getSellerProfile, getSellerStats |

### Specifications

**Seller Dashboard Layout (`layout.tsx`):**
- Check if current user is a seller (has sellerProfile)
- If not a seller: show full-page CTA — "Start selling on Twicely" heading, "Create your first listing" button linking to `/my/selling/listings/new`, benefits list (reach millions of buyers, free to start, seller tools)
- If seller: render sidebar + main content area
- Desktop: sidebar (240px) on left, content on right
- Mobile: sidebar hidden, hamburger menu or top tabs
- SEO: noindex on all `/my/*` pages

**Selling Sidebar (`selling-sidebar.tsx`):**
- Client component (needs pathname for active state)
- Links: Overview (`/my/selling`), Listings (`/my/selling/listings`), Orders (`/my/selling/orders` — disabled/greyed, B4), Analytics (`/my/selling/analytics` — disabled, D4), Finances (`/my/selling/finances` — disabled, C3)
- Active link highlighted
- Collapsed on mobile

**Selling Overview (`page.tsx`):**
- Stats cards row: Active Listings (count), Draft Listings (count), Total Views (0 for now, placeholder), Revenue This Month ($0.00, placeholder)
- Quick Actions section: "Create Listing" button, "View My Listings" link
- Recent Listings section: show last 5 listings with status badge, price, created date
- All data from `getSellerStats()` query

**Seller Queries (`seller.ts`):**
- `getSellerProfile(userId)`: returns sellerProfile or null
- `getSellerStats(userId)`: returns { activeCount, draftCount, pausedCount, soldCount, endedCount, recentListings }
- Query `listing` table WHERE `ownerUserId = userId`, group by status for counts
- Recent listings: last 5 ordered by createdAt desc

### Verification

```bash
npx tsc --noEmit
pnpm lint
# Verify files exist
for f in \
  "src/app/(marketplace)/my/selling/layout.tsx" \
  "src/app/(marketplace)/my/selling/page.tsx" \
  "src/components/shared/selling-sidebar.tsx" \
  "src/lib/queries/seller.ts"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

### STOP. Do not proceed to B2.2 until Adrian approves.

---

## SECTION B2.2 — Image Upload API Route + Component

**Creates ~4 files. Hard stop after.**

This section builds image upload infrastructure. For dev, images are stored to `public/uploads/listings/`. The upload API validates files and returns URLs. The upload component provides drag-and-drop with preview and reorder.

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/app/api/upload/route.ts` | API Route | POST handler: validates image, saves to filesystem, returns URL |
| 2 | `src/components/pages/listing/image-uploader.tsx` | Client Component | Drag-and-drop zone, preview grid, reorder, delete |
| 3 | `src/lib/upload/validate.ts` | Utility | Image validation: type, size, dimensions |
| 4 | `src/types/upload.ts` | Types | UploadResult, UploadError types |

### Specifications

**Upload API Route (`route.ts`):**
- POST `/api/upload` — accepts `multipart/form-data` with `file` field
- Validates:
  - File type by magic bytes (JPEG, PNG, WebP only — NOT by extension)
  - Max file size: 20MB
  - Max dimensions: 8000x8000 (read image metadata)
  - Min dimensions: 200x200
- Saves to `public/uploads/listings/{uuid}.{ext}`
- Strips EXIF data (use sharp if available, or just save raw for now)
- Returns JSON: `{ url: "/uploads/listings/{uuid}.{ext}", id: "{uuid}" }`
- Requires authentication (check session)
- Rate limit: max 12 uploads per request context (enforced client-side for now)

**Image Validation (`validate.ts`):**
- `validateImage(file: File)`: checks type, size, returns `{ valid: boolean, error?: string }`
- Magic byte signatures for JPEG (0xFFD8FF), PNG (0x89504E47), WebP (0x52494646...57454250)
- Export MAX_FILE_SIZE, MAX_IMAGES, MIN_DIMENSION, MAX_DIMENSION constants

**Upload Types (`upload.ts`):**
```typescript
export interface UploadedImage {
  id: string;        // UUID
  url: string;       // /uploads/listings/{uuid}.{ext}
  file?: File;       // Client-side reference
  preview?: string;  // Object URL for client preview
  position: number;  // Order in gallery
}

export interface UploadResult {
  success: boolean;
  image?: UploadedImage;
  error?: string;
}
```

**Image Uploader Component (`image-uploader.tsx`):**
- Client component with `'use client'`
- Drag-and-drop zone (dashed border, "Drop images here or click to browse")
- Click to open file picker (accept="image/jpeg,image/png,image/webp")
- Multiple file select supported
- Shows upload progress per file
- Preview grid: thumbnail with position number overlay
- First image marked as "Cover Photo" with badge
- Drag to reorder (use HTML5 drag events, no external library)
- Delete button (X) on each image
- Max 12 images. Counter shows "{count}/12"
- Minimum 1 image required to publish (show warning, don't block form)
- Props: `images: UploadedImage[]`, `onChange: (images: UploadedImage[]) => void`
- Uploads happen immediately on drop/select (background upload)
- Shows error toast if validation fails

### Verification

```bash
npx tsc --noEmit
pnpm lint
mkdir -p public/uploads/listings
# Verify files exist
for f in \
  "src/app/api/upload/route.ts" \
  "src/components/pages/listing/image-uploader.tsx" \
  "src/lib/upload/validate.ts" \
  "src/types/upload.ts"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

### STOP. Do not proceed to B2.3 until Adrian approves.

---

## SECTION B2.3 — Category Picker Component

**Creates ~2 files. Hard stop after.**

The category picker is a searchable dropdown with tree fallback. The seller types and gets category suggestions. This drives which attributes appear on the form (in a later phase — for B2, category is just a selection).

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/components/pages/listing/category-picker.tsx` | Client Component | Searchable category selector with tree fallback |
| 2 | `src/lib/queries/category-search.ts` | Query | searchCategories — ILIKE search on category name/path |

### Specifications

**Category Search Query (`category-search.ts`):**
- `searchCategories(query: string, limit?: number)`: search category table by name using ILIKE
- Returns: `Array<{ id, name, slug, parentId, parentName, path, depth, isLeaf }>`
- Join to parent category to get parentName
- Only return `isActive = true` categories
- Prefer leaf categories (sort by `isLeaf DESC, depth DESC`)
- If query is empty, return top-level categories

**Category Picker (`category-picker.tsx`):**
- Client component
- Text input at top — as user types, dropdown shows matching categories
- Each result shows: category name, parent breadcrumb (e.g., "Electronics › Phones & Tablets")
- Click a result to select it
- Selected category shown as a pill with X to clear
- If no search results: "No matching categories" message
- Fallback: "Browse all categories" link that shows the full tree
- Tree view: expandable parent > child structure
- Props: `value: string | null` (category ID), `onChange: (categoryId: string | null) => void`
- Debounce search input (300ms)

### Verification

```bash
npx tsc --noEmit
pnpm lint
for f in \
  "src/components/pages/listing/category-picker.tsx" \
  "src/lib/queries/category-search.ts"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

### STOP. Do not proceed to B2.4 until Adrian approves.

---

## SECTION B2.4 — Listing Form Component

**Creates ~3 files. Hard stop after.**

The core listing creation form. This is a single-page form (not a multi-step wizard) with sections. All fields visible at once, scrollable.

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/components/pages/listing/listing-form.tsx` | Client Component | Full listing creation/edit form |
| 2 | `src/components/pages/listing/condition-select.tsx` | Client Component | Condition dropdown with descriptions |
| 3 | `src/types/listing-form.ts` | Types | ListingFormData type, validation schema |

### Specifications

**Listing Form Types (`listing-form.ts`):**
```typescript
export interface ListingFormData {
  title: string;              // Required, max 80 chars
  description: string;        // Required, max 5000 chars
  categoryId: string | null;  // Required to publish
  condition: string | null;   // Required to publish — enum value
  brand: string;              // Optional
  priceCents: number | null;  // Required to publish
  originalPriceCents: number | null;  // Optional
  cogsCents: number | null;   // Optional, seller-only
  freeShipping: boolean;
  weightOz: number | null;    // Optional
  lengthIn: number | null;    // Optional
  widthIn: number | null;     // Optional
  heightIn: number | null;    // Optional
  allowOffers: boolean;
  autoAcceptOfferCents: number | null;
  autoDeclineOfferCents: number | null;
  tags: string[];             // Max 10
  quantity: number;           // Default 1
}

export interface ListingFormErrors {
  [field: string]: string | undefined;
}

export function validateListingForm(data: ListingFormData): ListingFormErrors;
```

- `validateListingForm`: returns errors object. Required fields: title, description, categoryId, condition, priceCents (must be > 0). Title max 80 chars. Description max 5000 chars. Price must be positive. Tags max 10.

**Condition Select (`condition-select.tsx`):**
- Dropdown using shadcn Select component
- Shows all 7 conditions with short descriptions:
  - NEW_WITH_TAGS: "Brand new, tags still attached"
  - NEW_WITHOUT_TAGS: "Brand new, tags removed"
  - NEW_WITH_DEFECTS: "New but with minor flaws"
  - LIKE_NEW: "Used briefly, no visible wear"
  - VERY_GOOD: "Gently used, minor signs of wear"
  - GOOD: "Used, some visible wear"
  - ACCEPTABLE: "Heavily used but functional"
- Props: `value: string | null`, `onChange: (value: string) => void`

**Listing Form (`listing-form.tsx`):**
- Client component — large form with sections
- Receives `initialData?: Partial<ListingFormData>` for edit mode
- Receives `images: UploadedImage[]` and `onImagesChange` for image management
- Receives `onSubmit: (data: ListingFormData, status: 'DRAFT' | 'ACTIVE') => Promise<void>`
- Receives `isSubmitting: boolean`

**Form Sections (top to bottom):**
1. **Photos** — ImageUploader component (from B2.2)
2. **Category** — CategoryPicker component (from B2.3)
3. **Item Details:**
   - Title (Input, required, shows char count "{n}/80")
   - Description (Textarea, required, shows char count "{n}/5000")
   - Condition (ConditionSelect, required)
   - Brand (Input, optional)
   - Tags (tag input — type, press Enter to add, click X to remove, max 10)
4. **Pricing:**
   - Price (Input type=number, required, shows as dollars, stored as cents)
   - Original Price (Input type=number, optional, "Show 'was' price on listing")
   - Cost of Goods (Input type=number, optional, "For your records only — not shown to buyers")
5. **Offers:**
   - Allow Offers (Checkbox)
   - If checked: Auto-accept above $ (optional), Auto-decline below $ (optional)
6. **Shipping:**
   - Free Shipping (Checkbox)
   - Weight (Input, oz)
   - Dimensions (3 inputs: L × W × H in inches)
7. **Quantity:** Number input, default 1

**Form Footer:**
- Two buttons: "Save as Draft" and "Publish Listing"
- "Save as Draft" submits with status='DRAFT' (skips required validation except title)
- "Publish Listing" submits with status='ACTIVE' (full validation)
- Inline validation errors shown under each field

**Dollar ↔ Cents conversion:**
- Display as dollars in the form (e.g., "24.99")
- Convert to cents on submit: `Math.round(parseFloat(value) * 100)`
- Convert from cents on load: `(cents / 100).toFixed(2)`

### Verification

```bash
npx tsc --noEmit
pnpm lint
for f in \
  "src/components/pages/listing/listing-form.tsx" \
  "src/components/pages/listing/condition-select.tsx" \
  "src/types/listing-form.ts"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

### STOP. Do not proceed to B2.5 until Adrian approves.

---

## SECTION B2.5 — Server Actions for Listing CRUD

**Creates ~3 files. Hard stop after.**

Server actions for creating, updating, and changing listing status. These are called from the form and from the listing management page.

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/lib/actions/listings.ts` | Server Actions | createListing, updateListing, changeListingStatus |
| 2 | `src/lib/listings/slug.ts` | Utility | generateSlug from title |
| 3 | `src/lib/listings/seller-activate.ts` | Utility | ensureSellerProfile — creates sellerProfile on first listing |

### Specifications

**Slug Generator (`slug.ts`):**
- `generateSlug(title: string): string` — kebab-case, lowercase, strip special chars, max 60 chars, append random 6-char suffix for uniqueness
- Example: "iPhone 13 128GB Starlight" → "iphone-13-128gb-starlight-a7b3c2"

**Seller Activation (`seller-activate.ts`):**
- `ensureSellerProfile(userId: string): Promise<SellerProfile>`
- Check if sellerProfile exists for userId
- If not: create one with defaults (sellerType=PERSONAL, storeTier=NONE, listerTier=NONE, performanceBand=STANDARD, status=ACTIVE)
- Also set `user.isSeller = true` in user table
- Return the profile (existing or newly created)

**Listing Actions (`listings.ts`):**
- All actions use `'use server'` directive
- All actions check authentication (get session, reject if not logged in)
- All actions validate ownership (user can only modify their own listings)

**`createListing(formData: ListingFormData, images: { id: string; url: string; position: number }[], status: 'DRAFT' | 'ACTIVE')`:**
- Call `ensureSellerProfile(userId)` — creates seller profile if first listing
- Validate form data (if status=ACTIVE, run full validation)
- Generate slug from title
- Insert into `listing` table with all fields
- Insert into `listing_image` table for each image (set position 0 as isPrimary=true)
- If status=ACTIVE: set `activatedAt = now()`
- Set `availableQuantity = quantity`
- Return `{ success: true, listingId, slug }` or `{ success: false, errors }`

**`updateListing(listingId: string, formData: Partial<ListingFormData>, images?: { id: string; url: string; position: number }[])`:**
- Verify ownership
- Verify listing is DRAFT or ACTIVE or PAUSED (cannot edit SOLD/ENDED/REMOVED)
- Update listing fields
- If images provided: delete existing listing_images, insert new ones
- Update `updatedAt`
- Return `{ success: true }` or `{ success: false, errors }`

**`changeListingStatus(listingId: string, newStatus: 'ACTIVE' | 'PAUSED' | 'ENDED')`:**
- Verify ownership
- Validate state transition:
  - DRAFT → ACTIVE (requires full validation: title, description, category, condition, price, 1+ image)
  - ACTIVE → PAUSED ✓
  - ACTIVE → ENDED ✓
  - PAUSED → ACTIVE ✓
  - PAUSED → ENDED ✓
  - SOLD → (no transitions allowed)
  - ENDED → ACTIVE (relist: creates new listing or reactivates?)
  - REMOVED → (no transitions allowed)
- Set appropriate timestamp (activatedAt, pausedAt, endedAt)
- Return `{ success: true }` or `{ success: false, error }`

### Verification

```bash
npx tsc --noEmit
pnpm lint
for f in \
  "src/lib/actions/listings.ts" \
  "src/lib/listings/slug.ts" \
  "src/lib/listings/seller-activate.ts"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

### STOP. Do not proceed to B2.6 until Adrian approves.

---

## SECTION B2.6 — Create Listing Page + Edit Listing Page

**Creates ~2 files. Hard stop after.**

The actual pages that use the form component and server actions.

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/app/(marketplace)/my/selling/listings/new/page.tsx` | Page | Create listing page |
| 2 | `src/app/(marketplace)/my/selling/listings/[id]/edit/page.tsx` | Page | Edit listing page |

### Specifications

**Create Listing Page (`new/page.tsx`):**
- Requires authentication (redirect to /auth/login if not logged in)
- Title: "Create Listing | Twicely"
- SEO: noindex
- Renders the ListingForm component with no initial data
- On submit: calls `createListing` server action
- On success: redirect to `/my/selling/listings` with success toast/message
- On error: show inline errors on form

**Edit Listing Page (`[id]/edit/page.tsx`):**
- Requires authentication
- Fetch listing by ID via Drizzle query (verify ownership)
- If listing not found or not owned: redirect to `/my/selling/listings`
- If listing is SOLD or REMOVED: redirect to `/my/selling/listings` (cannot edit)
- Title: "Edit Listing | Twicely"
- SEO: noindex
- Pre-populate form with existing data
- Load existing images from listing_image table
- On submit: calls `updateListing` server action
- On success: redirect to listing detail page `/i/{slug}`

**Query needed (add to `src/lib/queries/listings.ts`):**
- `getListingForEdit(listingId: string, userId: string)`: returns listing + images, only if owned by userId. Returns null if not found, not owned, or status is SOLD/REMOVED.

### Verification

```bash
npx tsc --noEmit
pnpm lint
for f in \
  "src/app/(marketplace)/my/selling/listings/new/page.tsx" \
  "src/app/(marketplace)/my/selling/listings/[id]/edit/page.tsx"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

### STOP. Do not proceed to B2.7 until Adrian approves.

---

## SECTION B2.7 — My Listings Page

**Creates ~3 files. Hard stop after.**

The listing management table with status tabs and batch actions.

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/app/(marketplace)/my/selling/listings/page.tsx` | Page | My Listings with status tabs |
| 2 | `src/components/pages/selling/listings-table.tsx` | Client Component | Listing table with batch selection |
| 3 | `src/lib/queries/seller-listings.ts` | Query | getSellerListings with status filter + pagination |

### Specifications

**Seller Listings Query (`seller-listings.ts`):**
- `getSellerListings(userId, filters: { status?: string, page?: number, limit?: number })`
- Returns: listings with primary image, status, price, created date, view count (0 for now)
- Pagination: default 20 per page
- If status filter: only that status. If no filter: all statuses.
- Also return counts per status for the tabs

**My Listings Page (`listings/page.tsx`):**
- Requires authentication + seller check
- Title: "My Listings | Twicely"
- SEO: noindex
- Status tabs: All, Active, Draft, Paused, Sold, Ended (with count badges)
- Tab changes update URL param: `?status=ACTIVE`
- "Create Listing" button (top right, links to `/my/selling/listings/new`)
- Empty state per tab: "No [status] listings" + "Create your first listing" CTA

**Listings Table (`listings-table.tsx`):**
- Client component (needs selection state, batch actions)
- Columns: Checkbox, Image (thumbnail), Title, Price, Status (badge), Date Created, Actions
- Row click → navigate to edit page
- Checkbox for batch selection
- Actions dropdown per row: Edit, Pause/Activate (toggle based on current status), End Listing
- Batch actions toolbar (appears when rows selected): Pause Selected, End Selected
- Status badges match B1 condition badge colors:
  - ACTIVE = green, DRAFT = gray, PAUSED = yellow, SOLD = blue, ENDED = red
- Mobile: card layout instead of table (image + title + price + status badge, stacked)

### Verification

```bash
npx tsc --noEmit
pnpm lint
# Start dev server and test
pnpm dev &
sleep 10
# Check the page loads (need to be logged in as a seller)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/my/selling/listings
# Kill dev server
taskkill //F //IM node.exe
```

### STOP. Do not proceed to B2.8 until Adrian approves.

---

## SECTION B2.8 — Full Flow Test + Bug Fixes

**No new files. Integration testing and fixes.**

Test the complete B2 flow end-to-end. Fix any issues found.

### Test Flow

1. Log in as a seed seller user
2. Navigate to `/my/selling` — should show selling overview (or "Start selling" CTA if the seed user doesn't have a sellerProfile yet)
3. Navigate to `/my/selling/listings` — should show existing seed listings for that seller
4. Click "Create Listing" — form loads
5. Upload 2-3 test images (create test JPEGs if needed)
6. Fill in all required fields (title, description, category, condition, price)
7. Click "Save as Draft" — listing saved, redirect to My Listings, draft appears
8. Click draft listing → Edit page loads with pre-filled data
9. Click "Publish Listing" → status changes to ACTIVE
10. Go to homepage → new listing appears in "Recently listed"
11. Click the listing → listing detail page shows all entered data + uploaded images
12. Go back to My Listings → use status tabs (verify counts update)
13. Use "Pause" action on the active listing → status changes to PAUSED
14. Use "Activate" action → status back to ACTIVE
15. Use "End" action → listing status changes to ENDED

### Verification

```bash
echo "=== B2 FINAL AUDIT ==="

echo "--- TypeScript ---"
npx tsc --noEmit

echo "--- Lint ---"
pnpm lint

echo "--- Build ---"
pnpm build

echo "--- No 'as any' ---"
grep -r "as any" src/app src/components src/lib --include="*.ts" --include="*.tsx" | grep -v node_modules || echo "CLEAN"

echo "--- No @ts-ignore ---"
grep -r "@ts-ignore\|@ts-expect-error" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules || echo "CLEAN"

echo "--- File sizes ---"
find src/app src/components src/lib -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -20

echo "--- B2 File Inventory ---"
echo "Pages:"
find "src/app/(marketplace)/my/selling" -name "page.tsx" | sort
echo "Components:"
find src/components/pages/listing src/components/pages/selling -name "*.tsx" 2>/dev/null | sort
echo "Actions:"
find src/lib/actions -name "*.ts" | sort
echo "Queries:"
find src/lib/queries -name "*seller*" -o -name "*category-search*" | sort

echo "--- Route Health ---"
pnpm dev &
sleep 10
for route in "/my/selling" "/my/selling/listings" "/my/selling/listings/new"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$route")
  printf "%-40s %s\n" "$route" "$code"
done
taskkill //F //IM node.exe

echo "=== B2 AUDIT COMPLETE ==="
```

Save checkpoint:
```bash
tar -cf ../twicely-b2-complete.tar --exclude=node_modules --exclude=.next --exclude=.git .
```

### STOP. B2 is complete. Wait for Adrian's full approval before proceeding to B3.

---

## B2 TOTAL FILE COUNT

| Section | Files | Description |
|---------|-------|-------------|
| B2.1 | 4 | Seller layout, overview page, sidebar, seller queries |
| B2.2 | 4 | Upload API route, image uploader component, validation, types |
| B2.3 | 2 | Category picker, category search query |
| B2.4 | 3 | Listing form, condition select, form types |
| B2.5 | 3 | Server actions, slug generator, seller activation |
| B2.6 | 2 | Create page, edit page (+1 query addition) |
| B2.7 | 3 | My Listings page, listings table, seller listings query |
| B2.8 | 0 | Testing and fixes only |
| **Total** | **~21 new files** | |

---

## REFERENCE: Listing Table Schema (from TWICELY_V3_SCHEMA.md)

Key columns used in B2:

```
listing:
  id, ownerUserId, status (DRAFT|ACTIVE|PAUSED|SOLD|ENDED|REMOVED),
  title, description, categoryId, condition, brand,
  priceCents, originalPriceCents, cogsCents, currency,
  quantity, availableQuantity, soldQuantity, slug,
  allowOffers, autoAcceptOfferCents, autoDeclineOfferCents,
  shippingProfileId, weightOz, lengthIn, widthIn, heightIn, freeShipping,
  attributesJson, tags,
  activatedAt, pausedAt, endedAt, soldAt,
  createdAt, updatedAt

listing_image:
  id, listingId, url, position, altText, isPrimary,
  width, height, sizeBytes, blurHash, createdAt

seller_profile:
  id, userId, sellerType, storeTier, listerTier, hasAutomation,
  performanceBand, status, payoutsEnabled, storeName, storeSlug,
  handlingTimeDays, stripeAccountId, stripeOnboarded,
  activatedAt, createdAt, updatedAt

user:
  isSeller (boolean field)
```

---

**END OF B2 PROMPT — TWICELY_V3_SLICE_B2_LISTING_CREATION.md**
