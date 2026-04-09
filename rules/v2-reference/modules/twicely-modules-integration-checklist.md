# Twicely Modules - Integration Checklist & Gap Analysis

## Overview

Two modules being built:
1. **Twicely Studio** - Visual page builder (like Elementor)
2. **Twicely AI** - AI features with credit billing (like Nifty/Vendoo)

Both must:
- Work as standalone modules
- Not touch core marketplace code
- Integrate seamlessly with marketplace
- Work together (AI + Studio)
- Share authentication/users
- Use marketplace database properly

---

## CHECKLIST: What Each Module Needs

### "... = Covered in spec
### "[X] = MISSING - Need to add
### ! -, = Partially covered - Need more detail

---

## TWICELY STUDIO (Page Builder)

### Core Functionality
- "... Drag-drop editor (Puck)
- "... Block components (layout, content, marketplace)
- "... Style controls (colors, spacing, typography)
- "... Page saving/loading
- "... Page publishing
- "... Templates
- "... Admin interface

### Database
- "... Pages table (studio_pages)
- "... Templates table (studio_templates)
- "... Revisions table (studio_page_revisions)
- "... Assets table (studio_assets)
- "[X] MISSING: How to reference marketplace data in pages (products, categories)

### Integration with Marketplace
- "... Catch-all route for rendering pages
- "... SDK export
- ! -, MISSING: How marketplace blocks fetch real data (ProductGrid needs products)
- "[X] MISSING: Authentication - who can edit pages?
- "[X] MISSING: How seller storefronts work (seller-specific pages)
- "[X] MISSING: How to embed Studio sections in existing marketplace pages

### Integration with AI Module
- "[X] MISSING: AI-generated page content
- "[X] MISSING: AI image enhancement in Studio
- "[X] MISSING: AI-written text blocks

---

## TWICELY AI

### Core Functionality
- "... Listing AI (title, description, category, specifics)
- "... Image AI (background removal, enhancement)
- "... Pricing AI (suggestions, market analysis)
- "... Search AI (semantic, visual, recommendations)
- "... Automation (smart offers, auto-relist, price drops)
- "... Customer service AI (chatbot, message composer)
- "... Fraud detection

### Billing
- "... Credit system
- "... Subscription plans
- "... Credit packs
- "... Usage tracking
- "... Admin billing dashboard

### Database
- "... Writes to existing marketplace fields (title, description, price)
- "... AI-specific tables (credits, usage, automation rules)
- "[X] MISSING: How to handle marketplace schema variations
- "[X] MISSING: Database connection sharing with marketplace

### Integration with Marketplace
- "... API routes (/api/ai/)
- "... Event listeners
- ! -, MISSING: Detailed hook points in marketplace
- "[X] MISSING: Authentication - how AI knows who the user is
- "[X] MISSING: How AI components render in marketplace UI
- "[X] MISSING: Error handling when AI service is down

### Integration with Studio
- "[X] MISSING: AI blocks for Studio (AI-generated content blocks)
- "[X] MISSING: AI image tools in Studio editor

---

## CRITICAL MISSING PIECES

### 1. SHARED AUTHENTICATION

Both modules need to know who the user is. They must use the marketplace's auth system.

```typescript
// MISSING: How modules access authenticated user

// The marketplace has auth (NextAuth, Clerk, custom, etc.)
// Modules need to:
// 1. Access the current user session
// 2. Check user roles/permissions
// 3. NOT implement their own auth

// Solution: Modules import auth from marketplace
import { auth, getUser, requireAuth } from '@/lib/auth'; // Marketplace auth

// Or receive user context via props/context
<AIListingForm user={currentUser} />
```

### 2. SHARED DATABASE CONNECTION

Both modules need database access but shouldn't create their own connections.

```typescript
// MISSING: How modules access database

// Solution: Modules import db from marketplace
import { db } from '@/lib/database'; // Marketplace DB connection

// Modules use the same Prisma/Drizzle client
// Modules add their own schema/migrations that extend marketplace schema
```

### 3. MARKETPLACE DATA IN STUDIO BLOCKS

Studio blocks like ProductGrid need to fetch real products.

```typescript
// MISSING: How ProductGrid block gets products

// Solution: Blocks call marketplace API or use shared data layer

// Option A: Blocks fetch via API
const ProductGridBlock = ({ categoryId, limit }) => {
 const [products, setProducts] = useState([]);

 useEffect(() => {
 // Call marketplace API (not AI API)
 fetch(`/api/products?category=${categoryId}&limit=${limit}`)
.then(res => res.json())
.then(setProducts);
 }, [categoryId, limit]);

 return <div>{products.map(p => <ProductCard product={p} />)}</div>;
};

// Option B: Blocks receive data from parent
// When page renders, marketplace injects data
```

### 4. SELLER-SPECIFIC STUDIO PAGES

Sellers should be able to customize their storefront.

```typescript
// MISSING: Seller storefront pages

// Solution: Pages can be scoped to a seller

// Database: Add seller_id to studio_pages
CREATE TABLE studio_pages (
 id UUID PRIMARY KEY,
 seller_id UUID REFERENCES users(id), // NULL = site-wide, UUID = seller page
 slug VARCHAR(255),
 //...
 UNIQUE(seller_id, slug) // Sellers can have their own /about page
);

// Routing: /seller/[sellerId]/[...slug]
// Renders seller's Studio pages
```

### 5. EMBEDDING STUDIO IN EXISTING PAGES

Sometimes you want editable sections within marketplace pages, not full Studio pages.

```typescript
// MISSING: Embeddable Studio sections

// Solution: Studio zones that can be placed in marketplace pages

// In marketplace page:
import { StudioZone } from '@/modules/twicely-studio';

export default function HomePage() {
 return (
 <div>
 {/* Editable hero section */}
 <StudioZone zoneId="homepage-hero" />

 {/* Fixed marketplace content */}
 <FeaturedCategories />

 {/* Another editable section */}
 <StudioZone zoneId="homepage-promo-banner" />

 {/* Fixed content */}
 <RecentListings />
 </div>
 );
}
```

### 6. AI COMPONENTS IN MARKETPLACE UI

How do AI buttons/widgets actually appear in the marketplace?

```typescript
// MISSING: How AI components integrate into marketplace UI

// Solution: Export components that marketplace imports where needed

// In marketplace's listing form:
import {
 AITitleButton,
 AIDescriptionButton,
 AIPriceWidget,
 AIBackgroundRemover
} from '@/modules/twicely-ai';

export function ListingForm() {
 return (
 <form>
 <div>
 <Label>Title</Label>
 <div className="flex gap-2">
 <Input name="title" value={title} onChange={...} />
 <AITitleButton
 listingId={listingId}
 onGenerated={(newTitle) => setTitle(newTitle)}
 />
 </div>
 </div>

 <div>
 <Label>Description</Label>
 <div className="flex gap-2">
 <Textarea name="description" value={description} onChange={...} />
 <AIDescriptionButton
 listingId={listingId}
 onGenerated={(newDesc) => setDescription(newDesc)}
 />
 </div>
 </div>

 <div>
 <Label>Price</Label>
 <AIPriceWidget
 listingId={listingId}
 currentPrice={price}
 onAccept={(newPrice) => setPrice(newPrice)}
 />
 </div>

 <div>
 <Label>Images</Label>
 <ImageUploader
 images={images}
 onChange={setImages}
 // AI enhancement built into uploader
 enableAIBackgroundRemoval={true}
 enableAIEnhancement={true}
 />
 </div>
 </form>
 );
}
```

### 7. AI + STUDIO INTEGRATION

Using AI features within the Studio editor.

```typescript
// MISSING: AI tools in Studio

// Solution: AI-powered blocks and tools in Studio

// AI Text Block - generates content
const AITextBlock = {
 type: 'AIText',
 fields: {
 prompt: { type: 'text', label: 'What should AI write?' },
 tone: { type: 'select', options: ['professional', 'casual', 'fun'] },
 generatedText: { type: 'textarea', label: 'Generated Text' },
 },
 render: ({ prompt, tone, generatedText }) => {
 return <div>{generatedText}</div>;
 },
 // Custom UI to generate text
 editUI: ({ prompt, tone, onChange }) => {
 const generateText = async () => {
 const result = await ai.generateText(prompt, tone);
 onChange({ generatedText: result });
 };
 return (
 <div>
 <Input value={prompt} onChange={...} />
 <Button onClick={generateText}>Generate with AI</Button>
 </div>
 );
 }
};

// AI Image Enhancement in Studio
// When user uploads image in Studio, offer AI enhancement
const ImageBlock = {
 type: 'Image',
 fields: {
 src: { type: 'text' },
 //...
 },
 // Custom image picker with AI tools
 editUI: ({ src, onChange }) => {
 return (
 <div>
 <ImagePicker value={src} onChange={...} />
 <Button onClick={() => removeBackground(src)}>
 Remove Background (1 credit)
 </Button>
 <Button onClick={() => enhanceImage(src)}>
 Enhance Image (1 credit)
 </Button>
 </div>
 );
 }
};
```

### 8. MODULE INITIALIZATION

How modules start up and register with marketplace.

```typescript
// MISSING: Module initialization/bootstrap

// Solution: Each module has an init function marketplace calls

// modules/twicely-ai/src/index.ts
export async function initTwicelyAI(config: {
 db: DatabaseClient;
 auth: AuthProvider;
 eventBus: EventEmitter;
}) {
 // Store references to marketplace services
 setDatabase(config.db);
 setAuth(config.auth);

 // Register event listeners
 config.eventBus.on('listing:created', onListingCreated);
 config.eventBus.on('listing:sold', onListingSold);
 config.eventBus.on('image:uploaded', onImageUploaded);

 // Start background workers
 await startWorkers();

 // Warm up AI models
 await warmupModels();

 console.log('Twicely AI initialized');
}

// modules/twicely-studio/src/index.ts
export async function initTwicelyStudio(config: {
 db: DatabaseClient;
 auth: AuthProvider;
}) {
 setDatabase(config.db);
 setAuth(config.auth);

 console.log('Twicely Studio initialized');
}

// In marketplace's app startup (e.g., instrumentation.ts or layout.tsx)
import { initTwicelyAI } from '@/modules/twicely-ai';
import { initTwicelyStudio } from '@/modules/twicely-studio';

export async function register() {
 await initTwicelyAI({
 db: prisma,
 auth: authProvider,
 eventBus: marketplaceEvents,
 });

 await initTwicelyStudio({
 db: prisma,
 auth: authProvider,
 });
}
```

### 9. ERROR HANDLING & FALLBACKS

What happens when AI service is down?

```typescript
// MISSING: Graceful degradation

// Solution: AI features fail gracefully, don't break marketplace

// AI buttons show error state
const AITitleButton = ({ listingId, onGenerated }) => {
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState(null);
 const { credits, hasCredits } = useCredits();

 const generate = async () => {
 setLoading(true);
 setError(null);

 try {
 const result = await ai.listing.generateTitle(listingId);
 if (result.success) {
 onGenerated(result.title);
 } else {
 setError(result.error);
 }
 } catch (err) {
 setError('AI service unavailable. Please try again later.');
 } finally {
 setLoading(false);
 }
 };

 if (!hasCredits) {
 return <Button disabled>Need credits</Button>;
 }

 return (
 <div>
 <Button onClick={generate} disabled={loading}>
 {loading ? 'Generating...': '"" AI Generate'}
 </Button>
 {error && <p className="text-red-500 text-sm">{error}</p>}
 </div>
 );
};

// Marketplace listing form works without AI
// AI is enhancement, not requirement
```

### 10. API ROUTE REGISTRATION

How module routes get added to the app.

```typescript
// MISSING: How /api/ai/* routes are registered

// Solution A: Next.js App Router - files in app/api/ai/
// Marketplace creates route files that import from module

// app/api/ai/[...path]/route.ts
import { handleAIRequest } from '@/modules/twicely-ai/api';

export async function GET(req, { params }) {
 return handleAIRequest(req, params.path);
}

export async function POST(req, { params }) {
 return handleAIRequest(req, params.path);
}

// Solution B: Module provides route handlers, marketplace mounts them

// modules/twicely-ai/src/api/routes.ts
export const aiRoutes = {
 'listing/generate-title': { POST: generateTitleHandler },
 'listing/generate-description': { POST: generateDescriptionHandler },
 'image/remove-background': { POST: removeBackgroundHandler },
 //...
};

// Marketplace mounts these however it handles routing
```

---

## UPDATED MODULE STRUCTURE

### Twicely AI - Complete Structure

```
modules/twicely-ai/
"""" src/
" """" index.ts # Main exports + init function
" "
" """" init.ts # Initialization logic
" " - setDatabase()
" " - setAuth()
" " - registerEventListeners()
" " - startWorkers()
" "
" """" config/
" " """" database.ts # Receives DB from marketplace
" " """" auth.ts # Receives auth from marketplace
" " """" settings.ts # AI-specific settings
" "
" """" api/ # API route handlers
" " """" index.ts # Main router
" " """" middleware/
" " " """" withAuth.ts # Uses marketplace auth
" " " """" withCredits.ts # Check/charge credits
" " " """" withRateLimit.ts
" " """" handlers/
" " """" listing.ts
" " """" image.ts
" " """" pricing.ts
" " """"...
" "
" """" services/ # Core AI logic
" "
" """" billing/ # Credit system
" "
" """" components/ # React components for marketplace
" " """" buttons/
" " " """" AITitleButton.tsx
" " " """" AIDescriptionButton.tsx
" " " """" AIGenerateButton.tsx
" " """" widgets/
" " " """" AIPriceWidget.tsx
" " " """" AIImageEnhancer.tsx
" " " """" CreditBalance.tsx
" " " """" MagicalListingWizard.tsx
" " """" search/
" " " """" AISearchBar.tsx
" " " """" VisualSearch.tsx
" " """" chat/
" " """" AIChatWidget.tsx
" "
" """" admin/ # Admin pages
" "
" """" hooks/ # React hooks
" " """" useCredits.ts
" " """" useAIGenerate.ts
" " """" useAIStatus.ts
" "
" """" database/
" " """" schema.ts # AI-only tables
" " """" migrations/
" "
" """" events/ # Event listeners
" """" listeners.ts
"
"""" package.json
```

### Twicely Studio - Complete Structure

```
modules/twicely-studio/
"""" src/
" """" index.ts # Main exports + init function
" "
" """" init.ts # Initialization logic
" "
" """" config/
" " """" database.ts
" " """" auth.ts
" " """" blocks.ts # Available blocks config
" "
" """" editor/ # Puck editor
" " """" Editor.tsx
" " """" config.ts
" " """"...
" "
" """" renderer/ # Page rendering
" " """" PageRenderer.tsx
" " """" StudioZone.tsx # Embeddable zones
" "
" """" blocks/
" " """" layout/
" " """" content/
" " """" marketplace/ # Blocks that use marketplace data
" " " """" ProductGrid.tsx # Fetches from /api/products
" " " """" CategoryList.tsx
" " " """" SellerProfile.tsx
" " """" ai/ # AI-powered blocks (uses AI module)
" " """" AITextBlock.tsx
" " """" AIImageBlock.tsx
" "
" """" api/
" " """" handlers/
" " """" pages.ts
" " """" templates.ts
" " """" zones.ts
" "
" """" admin/
" "
" """" database/
" " """" schema.ts
" " """" migrations/
" "
" """" hooks/
" """" useStudioPage.ts
" """" useStudioZone.ts
"
"""" package.json
```

---

## MARKETPLACE INTEGRATION POINTS

### Files Marketplace Creates/Modifies (Minimal)

```
twicely-marketplace/
"""" app/
" """" api/
" " """" ai/
" " " """" [...path]/route.ts # Mounts AI routes
" " """" studio/
" " """" [...path]/route.ts # Mounts Studio routes
" "
" """" admin/
" " """" ai/
" " " """" [[...path]]/page.tsx # Renders AI admin
" " """" studio/
" " """" [[...path]]/page.tsx # Renders Studio admin
" "
" """" editor/
" " """" [[...path]]/page.tsx # Studio editor page
" "
" """" (seller)/
" " """" listings/
" " """" new/
" " """" page.tsx # ADD: AI buttons to form
" "
" """" [...slug]/
" """" page.tsx # Catch-all for Studio pages
"
"""" lib/
" """" modules.ts # Module initialization
" """" events.ts # Event bus for modules
"
"""" components/
 """" listing-form.tsx # ADD: AI component imports
```

### Module Initialization in Marketplace

```typescript
// lib/modules.ts
import { initTwicelyAI } from '@/modules/twicely-ai';
import { initTwicelyStudio } from '@/modules/twicely-studio';
import { prisma } from './database';
import { auth } from './auth';
import { marketplaceEvents } from './events';

export async function initializeModules() {
 // Initialize AI module
 if (process.env.ENABLE_AI_MODULE === 'true') {
 await initTwicelyAI({
 db: prisma,
 auth: auth,
 eventBus: marketplaceEvents,
 config: {
 ollamaUrl: process.env.OLLAMA_URL,
 qdrantUrl: process.env.QDRANT_URL,
 meilisearchUrl: process.env.MEILISEARCH_URL,
 }
 });
 }

 // Initialize Studio module
 if (process.env.ENABLE_STUDIO_MODULE === 'true') {
 await initTwicelyStudio({
 db: prisma,
 auth: auth,
 aiModule: process.env.ENABLE_AI_MODULE === 'true'
 ? require('@/modules/twicely-ai')
: null, // Studio can use AI if available
 });
 }
}

// Call in app startup
// app/layout.tsx or instrumentation.ts
import { initializeModules } from '@/lib/modules';

// Run once on startup
initializeModules();
```

---

## ENVIRONMENT VARIABLES

```bash
#.env.local

# Module toggles
ENABLE_AI_MODULE=true
ENABLE_STUDIO_MODULE=true

# AI Services
OLLAMA_URL=http://localhost:11434
QDRANT_URL=http://localhost:6333
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_KEY=your-key

# AI Settings
AI_DEFAULT_MODEL=llama3
AI_MAX_BULK_ITEMS=100
AI_MAX_IMAGE_SIZE_MB=10

# Stripe (for AI billing)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...
```

---

## FINAL CHECKLIST

### Both Modules Must Have:

- [x] Clear initialization function
- [x] Accepts database connection from marketplace
- [x] Accepts auth provider from marketplace
- [x] Own API routes (mountable)
- [x] Own database tables (prefixed, don't conflict)
- [x] Admin interface
- [x] Exportable React components
- [x] Hooks for easy integration
- [x] Error handling / graceful degradation
- [x] Environment variable configuration

### Marketplace Must Provide:

- [x] Database connection (Prisma/Drizzle client)
- [x] Auth provider (current user, roles)
- [x] Event bus (for listening to marketplace events)
- [x] Route mounting points (/api/ai/*, /api/studio/*)
- [x] Admin page mounting points
- [x] Places to put AI buttons in UI

### Integration Between Modules:

- [x] Studio can use AI features (if AI module enabled)
- [x] AI doesn't require Studio
- [x] Studio doesn't require AI
- [x] Both share same auth
- [x] Both share same database connection

---

## WHAT TO ADD TO SPECS

### Add to Twicely AI Spec:
1. "... Module initialization function
2. "... How to receive database/auth from marketplace
3. "... Exportable React components list
4. "... Event listener registration
5. "... Error handling patterns
6. "... Environment variables list

### Add to Twicely Studio Spec:
1. "... Module initialization function
2. "... How marketplace blocks fetch data
3. "... StudioZone embeddable component
4. "... Seller-specific pages
5. "... AI integration (optional)
6. "... Environment variables list

---

## SUMMARY

The specs cover most functionality but were missing:

1. **Shared Authentication** - How modules use marketplace auth
2. **Shared Database** - How modules receive DB connection
3. **Module Initialization** - Startup/bootstrap process
4. **Real Data in Blocks** - How Studio blocks fetch marketplace data
5. **Embeddable Zones** - Putting Studio sections in existing pages
6. **AI Components Export** - What React components marketplace imports
7. **Error Handling** - Graceful degradation when AI is down
8. **Cross-Module Integration** - Studio using AI features
9. **Environment Configuration** - All env vars needed

All of these are now documented in this checklist and should be added to the main specs.
