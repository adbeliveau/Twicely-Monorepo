# Canonical 30 — AI Module

**Status:** DRAFT (V4)
**Domain:** AI, Platform Intelligence
**Depends on:** 01 (Schema/DB), 26 (Risk/Fraud), 07 (Search AI Discovery)
**Package:** `packages/ai/`
**V2 lineage:** No direct V2 predecessor (new V4 domain)
**V3 existing code:** `packages/db/src/schema/ai.ts` (aiAutofillUsage table), scattered `helpdesk.ai.*` / `trust.authentication.*` / `finance.receiptScanning.*` platform_settings

---

## 1. Purpose

This canonical defines the **centralized AI module** (`@twicely/ai`) that powers every AI feature across the Twicely platform. All AI calls -- completions, embeddings, vision, structured extraction -- flow through this single package. No domain package may call an AI provider SDK directly.

AI is Twicely's core differentiator. Every seller interaction (listing, pricing, description, authentication) and every buyer interaction (search, discovery, recommendations, helpdesk) is augmented by AI. This canonical ensures that power is delivered through a single, cost-controlled, observable, privacy-respecting abstraction.

### 1.1 Design Goals

1. **Single provider surface** -- one abstraction, swap providers without touching consumers.
2. **Cost control by default** -- token budgets, caching, rate limits, circuit breakers.
3. **Observability** -- every call logged with model, tokens, latency, cost estimate.
4. **Testability** -- all consumers mock `@twicely/ai/*`, never raw provider SDKs.
5. **Graceful degradation** -- AI failures never block core flows (listing, checkout, search).
6. **Privacy by design** -- explicit data contracts for what is sent to providers, opt-out support.

---

## 2. Core Principles

| # | Principle |
|---|-----------|
| AI-1 | AI is **enhancement, not dependency**. Every feature must work without AI. |
| AI-2 | All AI calls flow through `@twicely/ai`. Direct provider SDK calls elsewhere are a blocking code review violation. |
| AI-3 | All model IDs, temperatures, and token limits come from `platform_settings`. Never hardcoded in consumer code. |
| AI-4 | Every AI call is logged to `ai_usage_log` with feature, model, tokens, latency, cost estimate. |
| AI-5 | Token budgets enforced. When budget is exhausted, non-critical features degrade gracefully. Critical features (fraud, content moderation) are exempt from budget caps. |
| AI-6 | No user PII is sent to AI providers unless the feature explicitly requires it. When PII is required (helpdesk context), it is redacted from logs. |
| AI-7 | Integer cents for all money values. AI cost estimates use microdollars (integer, $0.000001 units). |

---

## 3. Provider Abstraction

### 3.1 Provider Interface

```ts
// packages/ai/src/provider.ts
export interface AiProvider {
  readonly name: string;

  complete(req: CompletionRequest): Promise<CompletionResponse>;
  embed(req: EmbedRequest): Promise<EmbedResponse>;
  vision(req: VisionRequest): Promise<VisionResponse>;
  structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>>;
}
```

### 3.2 Request/Response Types

```ts
// packages/ai/src/types.ts
import type { ZodSchema } from 'zod';

export interface CompletionRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;        // default 0.3
  jsonMode?: boolean;
  abortSignal?: AbortSignal;
}

export interface CompletionResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
  cached: boolean;
}

export interface EmbedRequest {
  model: string;
  inputs: string[];
  dimensions?: number;         // for text-embedding-3-small: 512 default
}

export interface EmbedResponse {
  embeddings: number[][];
  model: string;
  totalTokens: number;
  latencyMs: number;
}

export interface VisionRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  imageUrls: string[];         // max 8 images per request
  maxTokens: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface VisionResponse extends CompletionResponse {
  /** Same shape as CompletionResponse */
}

export interface StructuredRequest<T> {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: ZodSchema<T>;       // zod schema for structured output
  maxTokens: number;
  imageUrls?: string[];
}

export interface StructuredResponse<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
}
```

### 3.3 Provider Implementations

```ts
// packages/ai/src/providers/openai.ts
// Implements AiProvider using OpenAI SDK
// - Completions: gpt-4o-mini (default), gpt-4o (premium)
// - Embeddings: text-embedding-3-small (default), text-embedding-3-large (premium)
// - Vision: gpt-4o-mini with image_url (default), gpt-4o (premium)
// - Structured: OpenAI structured outputs with json_schema response_format

// packages/ai/src/providers/anthropic.ts
// Implements AiProvider using Anthropic SDK
// - Completions: claude-3-5-haiku (default), claude-sonnet-4-20250514 (premium)
// - Vision: claude-sonnet-4-20250514 with base64 images
// - Structured: tool_use with zod schema
// - No native embedding support -- falls back to OpenAI for embeddings

// packages/ai/src/providers/local.ts (future)
// Implements AiProvider for self-hosted models (Ollama, vLLM)
// - Development/testing only
// - No embedding or vision support initially
```

### 3.4 Fallback Chain

Providers are tried in order. If the primary provider fails (429, 500, timeout), the chain falls through:

```ts
// packages/ai/src/fallback-chain.ts
export interface FallbackChainConfig {
  primary: string;             // 'openai'
  fallbacks: string[];         // ['anthropic']
  retryOnStatusCodes: number[];// [429, 500, 502, 503]
  maxRetries: number;          // 2
}

// Default chain: openai -> anthropic
// Embedding calls: openai only (no fallback -- Anthropic has no embedding API)
```

### 3.5 Model Registry

All model IDs come from `platform_settings`, never hardcoded in consumer code.

| Setting Key | Default | Purpose |
|---|---|---|
| `ai.model.completionDefault` | `gpt-4o-mini` | Standard completions (descriptions, helpdesk) |
| `ai.model.completionPremium` | `gpt-4o` | Premium completions (authentication, fraud analysis) |
| `ai.model.embedding` | `text-embedding-3-small` | All embedding generation |
| `ai.model.embeddingDimensions` | `512` | Embedding vector dimensions |
| `ai.model.vision` | `gpt-4o-mini` | Image analysis (autofill, categorization) |
| `ai.model.visionPremium` | `gpt-4o` | Premium vision (authentication, defect detection) |
| `ai.provider` | `openai` | Active primary provider name |
| `ai.provider.fallback` | `anthropic` | Fallback provider name |

### 3.6 Provider Resolution

```ts
// packages/ai/src/resolve-provider.ts
export async function resolveProvider(): Promise<AiProvider> {
  const name = await getPlatformSetting('ai.provider', 'openai');
  switch (name) {
    case 'openai': return new OpenAiProvider();
    case 'anthropic': return new AnthropicProvider();
    default: throw new Error(`Unknown AI provider: ${name}`);
  }
}
```

---

## 4. Cost Controls

### 4.1 Token Budgets

Every AI feature has a monthly token budget tracked in `ai_usage_log`.

| Setting Key | Default | Description |
|---|---|---|
| `ai.budget.monthlyInputTokens` | `50_000_000` | Platform-wide monthly input token cap |
| `ai.budget.monthlyOutputTokens` | `10_000_000` | Platform-wide monthly output token cap |
| `ai.budget.alertThresholdPct` | `80` | Alert admin at this % of budget |
| `ai.budget.hardCapEnabled` | `true` | Stop non-critical AI calls at 100% |

**Budget-exempt features** (always allowed even at 100%):
- Fraud detection (`ai.fraud.*`)
- Content moderation (`ai.moderation.*`)
- Active authentication requests (`ai.authentication.*`)

### 4.2 Per-Feature Rate Limits

Rate limits enforced via Valkey (Redis). Key pattern: `ai:rate:{feature}:{userId}`.

| Feature | Per-User Limit | Window | Setting Key |
|---|---|---|---|
| autofill | Tier-based (see 5.1) | monthly | `ai.autofill.limit{Tier}` |
| description-generate | 20/day | 24h rolling | `ai.description.dailyLimit` |
| price-suggest | 50/day | 24h rolling | `ai.pricing.dailyLimit` |
| categorize | 100/day | 24h rolling | `ai.categorize.dailyLimit` |
| helpdesk-assist | 100/day per agent | 24h rolling | `ai.helpdesk.dailyLimitPerAgent` |
| visual-search | 30/day | 24h rolling | `ai.visualSearch.dailyLimit` |
| content-moderation | unlimited | -- | -- |
| fraud-analysis | unlimited | -- | -- |

### 4.3 Caching Layer

```ts
// packages/ai/src/cache.ts
// Three-tier caching:
//
// 1. Embedding cache: Valkey hash, TTL 7 days
//    Key: ai:cache:embed:{sha256(model + text + dimensions)}
//    Value: float[] serialized as msgpack
//
// 2. Completion cache: content-hash, TTL 1 hour
//    Key: ai:cache:complete:{sha256(model + systemPrompt + userPrompt + temperature)}
//    Value: CompletionResponse JSON
//    Only caches deterministic calls (temperature <= 0.1)
//
// 3. Vision cache: content-hash, TTL 24 hours
//    Key: ai:cache:vision:{sha256(model + prompt + sorted(imageUrls))}
//    Value: VisionResponse JSON
//
// Cache bypass: set `skipCache: true` in request options
```

### 4.4 Circuit Breaker

```ts
// packages/ai/src/circuit-breaker.ts
//
// Per-provider circuit breaker (separate state for openai vs anthropic):
// - CLOSED: normal operation
// - OPEN: after 5 consecutive failures within 60s -- all calls rejected immediately
// - HALF_OPEN: after 30s cooldown, allows 1 probe request
//   - If probe succeeds: transition to CLOSED
//   - If probe fails: transition back to OPEN
//
// State stored in Valkey: ai:circuit:{providerName}
// Consumers receive AiUnavailableError, must handle gracefully
```

### 4.5 Batch Processing

For high-volume operations (embedding generation for search index, nightly fraud scan):

```ts
// packages/ai/src/batch.ts
export interface BatchRequest<T, R> {
  items: T[];
  processor: (batch: T[]) => Promise<R[]>;
  batchSize: number;           // default 50
  concurrency: number;         // default 3
  delayBetweenBatchesMs: number; // default 200 (rate limit friendly)
}

export async function processBatch<T, R>(req: BatchRequest<T, R>): Promise<R[]>;
```

### 4.6 Usage Logging

```ts
// packages/ai/src/usage-log.ts
// Every AI call writes to ai_usage_log table (see schema in section 6).
// Fields: id, feature, userId, model, inputTokens, outputTokens,
//         latencyMs, cached, error, costMicros, createdAt
//
// logAiUsage() is called in the provider wrapper, not by consumers.
// Aggregated monthly via ai_usage_monthly materialized view.
```

---

## 5. AI Features Catalog

### 5.1 Listing Autofill (G1.1)

**Domain:** Lister
**Entry:** `@twicely/ai/autofill`

Analyzes listing photos to auto-populate: title, description, brand, condition, category, size, color, material, tags.

```ts
export interface AutofillRequest {
  imageUrls: string[];         // 1-8 photos
  categoryHint?: string;       // optional category from user
  existingTitle?: string;      // if user already typed something
}

export interface AutofillResult {
  title: string;
  description: string;
  brand: string | null;
  condition: string;           // maps to condition enum
  categorySlug: string;
  attributes: Record<string, string>;  // size, color, material, etc.
  tags: string[];
  confidence: number;          // 0-1
}

export async function autofillFromImages(req: AutofillRequest): Promise<AutofillResult>;
```

**Usage limits** (from `platform_settings`, existing `ai.autofill.limit*` keys):
- No subscription: 10/month
- STARTER: 50/month
- PRO: 200/month
- POWER/ENTERPRISE: unlimited (-1)

**Tracking:** Existing `ai_autofill_usage` table (`packages/db/src/schema/ai.ts`).

**Model:** `ai.model.vision` (gpt-4o-mini default). Uses structured output with zod schema for consistent field extraction.

### 5.2 Description Generation

**Domain:** Lister
**Entry:** `@twicely/ai/description`

Generates or improves listing descriptions from title, attributes, and photos.

```ts
export interface DescriptionRequest {
  title: string;
  brand?: string;
  condition?: string;
  categoryName?: string;
  attributes?: Record<string, string>;
  imageUrls?: string[];
  tone?: 'professional' | 'casual' | 'luxury';  // default: 'professional'
  existingDescription?: string;  // for "improve" mode
  mode: 'generate' | 'improve';
}

export interface DescriptionResult {
  description: string;
  suggestedTags: string[];
  seoKeywords: string[];       // extracted keywords for SEO metadata
  inputTokens: number;
  outputTokens: number;
}

export async function generateDescription(req: DescriptionRequest): Promise<DescriptionResult>;
```

**Max length:** `ai.description.maxLength` (default 2000 chars).
**Model:** `ai.model.completionDefault` with `ai.model.vision` if imageUrls provided.

### 5.3 Smart Categorization

**Domain:** Lister
**Entry:** `@twicely/ai/categorize`

Given title + optional image, returns top-3 category matches with confidence.

```ts
export interface CategorizationRequest {
  title: string;
  description?: string;
  imageUrl?: string;
  brand?: string;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryPath: string;        // "Fashion > Women > Dresses"
  confidence: number;          // 0-1
}

export async function suggestCategories(
  req: CategorizationRequest
): Promise<CategorySuggestion[]>;
```

**Implementation:** System prompt includes the full category tree (loaded from DB at startup, cached 1 hour). Model maps input to category IDs via structured output. When an image is provided, uses vision model for better accuracy on ambiguous items.

### 5.4 Price Suggestion

**Domain:** Lister, Commerce
**Entry:** `@twicely/ai/pricing`

Combines market intelligence data (existing `market_category_summary`, `market_listing_intelligence` tables) with AI to produce pricing guidance.

```ts
export interface PriceSuggestionRequest {
  title: string;
  categoryId: string;
  brand?: string;
  condition: string;
  imageUrl?: string;
  // Market data injected by caller (not fetched internally -- avoids circular deps)
  marketData?: {
    medianPriceCents: number;
    sampleSize: number;
    recentSales: Array<{ priceCents: number; condition: string; soldAt: string }>;
  };
}

export interface PriceSuggestionResult {
  suggestedPriceCents: number;
  lowCents: number;
  highCents: number;
  marketMedianCents: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;           // human-readable explanation
  sampleSize: number;
}

export async function suggestPrice(req: PriceSuggestionRequest): Promise<PriceSuggestionResult>;
```

**Data source priority:** Market intelligence tables first (no AI call needed if sufficient data -- `ai.pricing.minSampleSize` default 5). AI call only when market data is sparse or ambiguous, to synthesize from title/brand/condition/image.

### 5.5 Image Analysis

**Domain:** Trust, Lister
**Entry:** `@twicely/ai/image-analysis`

Multi-purpose image analysis: quality check, duplicate detection, policy violation scan, watermark detection.

```ts
export interface ImageAnalysisRequest {
  imageUrls: string[];         // max 8
  checks: ('quality' | 'duplicate' | 'policy' | 'watermark' | 'condition')[];
}

export interface ImageAnalysisResult {
  quality: {
    score: number;             // 0-1
    issues: string[];          // "blurry", "dark", "low_resolution", "stock_photo"
  } | null;
  duplicateOf: string | null;  // listing ID if duplicate image detected
  policyViolations: string[] | null;  // "prohibited_item", "offensive_content", "weapons"
  hasWatermark: boolean | null;
  conditionAssessment: {
    suggestedCondition: string;   // maps to condition enum
    defectsDetected: string[];    // "stain", "tear", "pilling", "scuff"
    confidence: number;
  } | null;
}

export async function analyzeImages(req: ImageAnalysisRequest): Promise<ImageAnalysisResult>;
```

**Duplicate detection:** Generates a perceptual hash (pHash) via vision model and compares against existing listing image hashes stored in `listing_image.perceptualHash` (new column). Not an embedding comparison -- purely structural similarity.

### 5.6 Visual Search (Find Similar)

**Domain:** Search
**Entry:** `@twicely/ai/visual-search`

Image-to-listing search. User uploads a photo, system finds visually similar listings.

```ts
export interface VisualSearchRequest {
  imageUrl: string;            // uploaded image URL
  maxResults?: number;         // default 20
  categoryFilter?: string;     // optional category constraint
}

export interface VisualSearchResult {
  listings: Array<{
    listingId: string;
    similarityScore: number;   // 0-1
  }>;
  extractedAttributes: {       // what the AI "sees" in the image
    category?: string;
    brand?: string;
    color?: string;
    style?: string;
  };
}

export async function visualSearch(req: VisualSearchRequest): Promise<VisualSearchResult>;
```

**Implementation:**
1. Vision model extracts attributes from uploaded image (structured output)
2. Generate text embedding from extracted attributes
3. Query Typesense vector field for nearest neighbors (see Canonical 07)
4. Optionally: generate image embedding via CLIP-style model (future, when Typesense supports image embeddings)

### 5.7 AI Authentication

**Domain:** Trust
**Entry:** `@twicely/ai/authentication`

AI-powered item authentication for luxury goods. Supplements existing third-party Entrupy integration (see `trust.authentication.*` platform_settings).

```ts
export interface AuthenticationRequest {
  listingId: string;
  imageUrls: string[];         // multiple angles required (min 3)
  brand: string;
  categorySlug: string;        // must be in trust.authentication.aiSupportedCategories
  claimedModel?: string;
}

export type AuthenticationVerdict = 'AUTHENTICATED' | 'COUNTERFEIT' | 'INCONCLUSIVE';

export interface AuthenticationResult {
  verdict: AuthenticationVerdict;
  confidencePercent: number;   // 0-100
  findings: string[];          // human-readable evidence points
  detailChecks: Array<{
    check: string;             // "stitching_pattern", "logo_alignment", "hardware_quality"
    passed: boolean;
    note: string;
  }>;
  recommendExpertReview: boolean;
}

export async function authenticateItem(
  req: AuthenticationRequest
): Promise<AuthenticationResult>;
```

**Model:** Uses `ai.model.visionPremium` (gpt-4o) for highest accuracy.
**Notifications:** Triggers existing templates from `templates-authentication.ts`:
- `auth.ai.authenticated`
- `auth.ai.counterfeit`
- `auth.ai.inconclusive`

**Safety:** When confidence < 70%, always sets `recommendExpertReview: true`. Counterfeit verdicts at any confidence level trigger staff review queue entry.

### 5.8 Helpdesk AI Assist (G9.7)

**Domain:** Helpdesk
**Entry:** `@twicely/ai/helpdesk`

AI-powered suggested replies, auto-routing, and sentiment analysis for customer support.

```ts
// Suggested reply generation
export interface HelpdeskSuggestRequest {
  caseId: string;
  caseSubject: string;
  caseCategory: string;
  messageHistory: Array<{ role: 'user' | 'agent'; text: string; timestamp: string }>;
  kbArticleSlugs?: string[];   // relevant knowledge base articles to ground on
}

export interface HelpdeskSuggestResult {
  suggestedReply: string;
  confidence: number;
  referencedArticles: string[];
  tone: 'empathetic' | 'factual' | 'apologetic';
}

export async function suggestReply(req: HelpdeskSuggestRequest): Promise<HelpdeskSuggestResult>;

// Agent draft improvement
export interface HelpdeskAssistRequest {
  agentDraft: string;
  caseContext: string;
  instruction: string;         // "make more empathetic", "add refund policy", etc.
}

export interface HelpdeskAssistResult {
  revisedDraft: string;
  changes: string[];
}

export async function assistReply(req: HelpdeskAssistRequest): Promise<HelpdeskAssistResult>;

// Auto-routing: classify incoming case to category + priority
export interface HelpdeskRouteRequest {
  subject: string;
  body: string;
  buyerHistory?: { orderCount: number; disputeCount: number };
}

export interface HelpdeskRouteResult {
  suggestedCategory: string;
  suggestedPriority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  sentimentScore: number;      // -1 (angry) to +1 (positive)
  confidence: number;
}

export async function routeCase(req: HelpdeskRouteRequest): Promise<HelpdeskRouteResult>;
```

**Settings:** Uses existing `helpdesk.ai.*` platform_settings keys.
**Model:** `ai.model.completionDefault` (gpt-4o-mini) for cost efficiency.

### 5.9 Fraud & Risk AI Signals

**Domain:** Commerce, Trust (integrates with Canonical 26 Risk Engine)
**Entry:** `@twicely/ai/fraud`

AI-augmented fraud detection that supplements existing rule-based signals from the risk engine.

```ts
export interface FraudAnalysisRequest {
  type: 'listing' | 'message' | 'review' | 'account';
  content: string;
  metadata: Record<string, unknown>;
}

export interface FraudAnalysisResult {
  riskScore: number;           // 0-1
  signals: Array<{
    signal: string;            // "price_too_low", "phishing_link", "fake_review", "shill_bidding"
    confidence: number;
    evidence: string;
  }>;
  action: 'ALLOW' | 'FLAG' | 'BLOCK';
}

export async function analyzeFraud(req: FraudAnalysisRequest): Promise<FraudAnalysisResult>;
```

**Integration:** Results from `analyzeFraud` are fed into the risk engine via `recordRiskSignal()` from `packages/scoring/src/risk/`. The AI module does not make risk decisions -- it produces signals that the risk engine evaluates.

### 5.10 Recommendation Engine

**Domain:** Discovery
**Entry:** `@twicely/ai/recommendations`

Personalized product recommendations based on user behavior signals.

```ts
export interface RecommendationRequest {
  userId: string;
  context: 'home_feed' | 'listing_detail' | 'cart' | 'post_purchase';
  currentListingId?: string;   // for "similar items" / "you may also like"
  maxResults?: number;         // default 12
  // Behavior signals injected by caller
  signals: {
    viewedListingIds: string[];
    savedListingIds: string[];
    purchasedCategoryIds: string[];
    searchQueries: string[];
    priceRangeCents?: { min: number; max: number };
  };
}

export interface RecommendationResult {
  listings: Array<{
    listingId: string;
    score: number;
    reason: 'similar_to_viewed' | 'popular_in_category' | 'price_match' | 'trending' | 'collaborative';
  }>;
}

export async function getRecommendations(
  req: RecommendationRequest
): Promise<RecommendationResult>;
```

**Implementation:** Hybrid approach:
1. **Embedding similarity** -- user's recent views/searches are embedded, nearest neighbors from Typesense vector index
2. **Collaborative filtering** -- users who bought X also bought Y (aggregated from order data, passed in via signals)
3. **Rule-based boost** -- trending items, price-range match, same category

No AI completion call needed -- this is purely embedding + vector search + scoring.

### 5.11 Natural Language Search (Query Understanding)

**Domain:** Search (detailed in Canonical 07)
**Entry:** `@twicely/ai/query-understanding`

Transforms natural language queries into structured search intent.

```ts
export interface QueryUnderstandingRequest {
  query: string;
  userContext?: {
    recentCategories?: string[];
    preferredBrands?: string[];
  };
}

export interface QueryUnderstandingResult {
  intent: 'product_search' | 'brand_search' | 'category_browse' | 'question' | 'ambiguous';
  expandedQuery: string;       // normalized, spell-corrected
  extractedFilters: {
    category?: string;
    brand?: string;
    condition?: string;
    priceRange?: { minCents?: number; maxCents?: number };
    color?: string;
    size?: string;
  };
  synonyms: string[];          // alternative terms to boost recall
  spellCorrection: string | null;  // "did you mean?"
}

export async function understandQuery(
  req: QueryUnderstandingRequest
): Promise<QueryUnderstandingResult>;
```

**Model:** `ai.model.completionDefault` with structured output. Fast (< 200ms target) because it runs on every search.

**Caching:** Aggressive -- queries are normalized and cached. `ai:cache:query:{sha256(normalizedQuery)}`, TTL 24 hours.

### 5.12 Content Moderation AI

**Domain:** Trust
**Entry:** `@twicely/ai/moderation`

AI-powered content moderation for listings, messages, reviews, and profile content.

```ts
export interface ModerationRequest {
  type: 'listing_text' | 'listing_image' | 'message' | 'review' | 'profile';
  text?: string;
  imageUrls?: string[];
}

export interface ModerationResult {
  safe: boolean;
  violations: Array<{
    category: 'hate_speech' | 'violence' | 'sexual' | 'prohibited_item' |
              'counterfeit_claim' | 'phishing' | 'spam' | 'personal_info';
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    evidence: string;
    confidence: number;
  }>;
  action: 'ALLOW' | 'FLAG_FOR_REVIEW' | 'AUTO_REMOVE';
}

export async function moderateContent(req: ModerationRequest): Promise<ModerationResult>;
```

**Budget-exempt:** Content moderation is never throttled by token budgets.
**Action thresholds:** Configurable via `ai.moderation.autoRemoveThreshold` (default 0.95 confidence) and `ai.moderation.flagThreshold` (default 0.7).

### 5.13 Embedding Generation (for Search & Recommendations)

**Domain:** Search
**Entry:** `@twicely/ai/embeddings`

Generates embeddings for listings and queries. Used by search (Canonical 07) and recommendation engine.

```ts
export async function embedTexts(
  texts: string[],
  dimensions?: number
): Promise<number[][]>;

export async function embedQuery(
  query: string,
  dimensions?: number
): Promise<number[]>;

export async function embedImage(
  imageUrl: string,
  dimensions?: number
): Promise<number[]>;
```

**Model:** `ai.model.embedding` (text-embedding-3-small), dimensions from `ai.model.embeddingDimensions` (512).
**Caching:** Embedding results cached in Valkey for 7 days (key: `ai:cache:embed:{sha256(text)}`).
**Batch:** Use `processBatch()` for bulk embedding generation (listing reindex jobs).

### 5.14 Receipt OCR (Finance)

**Domain:** Finance
**Entry:** `@twicely/ai/receipt-ocr`

AI-backed receipt data extraction for seller expense tracking.

```ts
export interface ReceiptOcrRequest {
  imageUrl: string;
  expenseCategories: string[];
}

export interface ReceiptOcrResult {
  vendor: string | null;
  amountCents: number | null;
  date: string | null;         // ISO date
  suggestedCategory: string | null;
  lineItems: Array<{ description: string; amountCents: number }>;
  confidence: number;
  rawText: string | null;
}

export async function extractReceiptData(
  req: ReceiptOcrRequest
): Promise<ReceiptOcrResult>;
```

---

## 6. Schema (Drizzle)

### 6.1 ai_usage_log (new)

```ts
// packages/db/src/schema/ai-usage.ts
import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';

export const aiUsageLog = pgTable('ai_usage_log', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  feature:      text('feature').notNull(),        // 'autofill', 'description', 'categorize', etc.
  userId:       text('user_id').references(() => user.id, { onDelete: 'set null' }),
  model:        text('model').notNull(),
  provider:     text('provider').notNull(),        // 'openai', 'anthropic'
  inputTokens:  integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  latencyMs:    integer('latency_ms').notNull(),
  cached:       boolean('cached').notNull().default(false),
  error:        text('error'),
  costMicros:   integer('cost_micros').notNull(),  // estimated cost in microdollars ($0.000001)
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  featureCreatedIdx: index('aul_feature_created').on(table.feature, table.createdAt),
  userCreatedIdx:    index('aul_user_created').on(table.userId, table.createdAt),
  providerIdx:       index('aul_provider').on(table.provider, table.createdAt),
}));
```

### 6.2 ai_embedding_cache (new, optional persistence)

```ts
export const aiEmbeddingCache = pgTable('ai_embedding_cache', {
  contentHash:  text('content_hash').primaryKey(),  // SHA-256 of input text
  model:        text('model').notNull(),
  dimensions:   integer('dimensions').notNull(),
  embedding:    text('embedding').notNull(),         // JSON-serialized float array
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 6.3 Existing: ai_autofill_usage (preserved)

The existing `aiAutofillUsage` table in `packages/db/src/schema/ai.ts` is preserved. It tracks monthly autofill usage per user for subscription tier enforcement.

### 6.4 ai_usage_monthly (materialized view)

```sql
CREATE MATERIALIZED VIEW ai_usage_monthly AS
SELECT
  date_trunc('month', created_at) AS month,
  feature,
  provider,
  model,
  SUM(input_tokens)  AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost_micros)   AS total_cost_micros,
  COUNT(*)           AS call_count,
  COUNT(*) FILTER (WHERE cached) AS cached_count,
  COUNT(*) FILTER (WHERE error IS NOT NULL) AS error_count,
  AVG(latency_ms)::integer AS avg_latency_ms
FROM ai_usage_log
GROUP BY 1, 2, 3, 4;
```

---

## 7. Package Structure

```
packages/ai/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                   -- barrel exports
    types.ts                   -- Request/response types
    provider.ts                -- AiProvider interface definition
    resolve-provider.ts        -- Provider factory + fallback chain
    fallback-chain.ts          -- Multi-provider fallback logic
    cache.ts                   -- Valkey caching layer (embed, complete, vision)
    circuit-breaker.ts         -- Per-provider circuit breaker
    rate-limiter.ts            -- Per-feature rate limiting
    usage-log.ts               -- Token usage logging to ai_usage_log
    cost-estimator.ts          -- Estimates cost from model + tokens (microdollars)
    batch.ts                   -- Batch processing for bulk operations

    providers/
      openai.ts                -- OpenAI provider implementation
      anthropic.ts             -- Anthropic provider implementation

    autofill.ts                -- Listing autofill (5.1)
    description.ts             -- Description generation (5.2)
    categorize.ts              -- Smart categorization (5.3)
    pricing.ts                 -- Price suggestion (5.4)
    image-analysis.ts          -- Image analysis (5.5)
    visual-search.ts           -- Visual search (5.6)
    authentication.ts          -- AI authentication (5.7)
    helpdesk.ts                -- Helpdesk assist (5.8)
    fraud.ts                   -- Fraud signals (5.9)
    recommendations.ts         -- Recommendation engine (5.10)
    query-understanding.ts     -- Natural language search (5.11)
    moderation.ts              -- Content moderation (5.12)
    embeddings.ts              -- Embedding generation (5.13)
    receipt-ocr.ts             -- Receipt OCR (5.14)

    prompts/
      autofill-system.ts       -- System prompt for autofill
      description-system.ts    -- System prompt for descriptions
      categorize-system.ts     -- System prompt for categorization
      pricing-system.ts        -- System prompt for pricing
      authentication-system.ts -- System prompt for authentication
      helpdesk-system.ts       -- System prompt for helpdesk
      fraud-system.ts          -- System prompt for fraud detection
      moderation-system.ts     -- System prompt for content moderation
      query-system.ts          -- System prompt for query understanding

    __tests__/
      provider.test.ts
      cache.test.ts
      circuit-breaker.test.ts
      rate-limiter.test.ts
      batch.test.ts
      autofill.test.ts
      description.test.ts
      categorize.test.ts
      pricing.test.ts
      image-analysis.test.ts
      visual-search.test.ts
      authentication.test.ts
      helpdesk.test.ts
      fraud.test.ts
      recommendations.test.ts
      query-understanding.test.ts
      moderation.test.ts
      embeddings.test.ts
      receipt-ocr.test.ts
```

---

## 8. Dependency Rules

### 8.1 Who Depends on @twicely/ai

| Package | Features Used |
|---|---|
| `apps/web` | autofill, description, categorize, pricing, visual-search, recommendations (server actions) |
| `packages/search` | embeddings (vector indexing + query embedding), query-understanding |
| `packages/commerce` | pricing, fraud |
| `packages/notifications` | (none -- AI module calls notifications, not reverse) |
| `packages/jobs` | autofill batch, embedding batch, fraud scan cron, moderation cron |
| `packages/finance` | receipt-ocr |
| `packages/scoring` | fraud signals feed into risk engine |

### 8.2 What @twicely/ai Depends On

| Package | Reason |
|---|---|
| `@twicely/db` | Usage logging, embedding cache, platform_settings reads |
| `@twicely/utils` | Hashing (SHA-256 for cache keys), sanitization |

**Circular dep prevention:** `@twicely/ai` MUST NOT depend on `@twicely/commerce`, `@twicely/search`, `@twicely/notifications`, `@twicely/scoring`, or `@twicely/jobs`. Domain-specific context (market data, KB articles, user signals) is passed IN to AI functions as parameters, never fetched internally.

---

## 9. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes (if provider=openai) | OpenAI API key |
| `ANTHROPIC_API_KEY` | No (if provider=anthropic) | Anthropic API key |
| `AI_CACHE_URL` | No | Valkey/Redis URL for AI cache (falls back to main `VALKEY_URL`) |

No other secrets. Model selection and all configuration live in `platform_settings`.

---

## 10. Platform Settings (Complete List)

All keys prefixed with `ai.`. Added to seed via `seed-ai-module.ts`.

### 10.1 Global Settings

| Key | Default | Type | Description |
|---|---|---|---|
| `ai.enabled` | `true` | boolean | Master AI kill switch |
| `ai.provider` | `openai` | string | Active primary provider |
| `ai.provider.fallback` | `anthropic` | string | Fallback provider |
| `ai.model.completionDefault` | `gpt-4o-mini` | string | Default completion model |
| `ai.model.completionPremium` | `gpt-4o` | string | Premium completion model |
| `ai.model.embedding` | `text-embedding-3-small` | string | Embedding model |
| `ai.model.embeddingDimensions` | `512` | number | Embedding vector dimensions |
| `ai.model.vision` | `gpt-4o-mini` | string | Default vision model |
| `ai.model.visionPremium` | `gpt-4o` | string | Premium vision model |

### 10.2 Budget Settings

| Key | Default | Type | Description |
|---|---|---|---|
| `ai.budget.monthlyInputTokens` | `50000000` | number | Monthly input token budget |
| `ai.budget.monthlyOutputTokens` | `10000000` | number | Monthly output token budget |
| `ai.budget.alertThresholdPct` | `80` | number | Budget alert threshold % |
| `ai.budget.hardCapEnabled` | `true` | boolean | Hard-stop at 100% budget |

### 10.3 Cache Settings

| Key | Default | Type | Description |
|---|---|---|---|
| `ai.cache.embeddingTtlSeconds` | `604800` | number | Embedding cache TTL (7 days) |
| `ai.cache.completionTtlSeconds` | `3600` | number | Completion cache TTL (1 hour) |
| `ai.cache.visionTtlSeconds` | `86400` | number | Vision cache TTL (24 hours) |

### 10.4 Circuit Breaker Settings

| Key | Default | Type | Description |
|---|---|---|---|
| `ai.circuitBreaker.failureThreshold` | `5` | number | Consecutive failures to trip |
| `ai.circuitBreaker.resetTimeoutMs` | `30000` | number | Half-open probe delay |

### 10.5 Per-Feature Settings

| Key | Default | Type | Description |
|---|---|---|---|
| `ai.autofill.enabled` | `true` | boolean | Autofill kill switch |
| `ai.autofill.limitDefault` | `10` | number | Monthly limit (no subscription) |
| `ai.autofill.limitStarter` | `50` | number | Monthly limit (STARTER) |
| `ai.autofill.limitPro` | `200` | number | Monthly limit (PRO) |
| `ai.autofill.limitPower` | `-1` | number | Monthly limit (POWER, -1=unlimited) |
| `ai.description.maxLength` | `2000` | number | Max description chars |
| `ai.description.dailyLimit` | `20` | number | Per-user daily limit |
| `ai.pricing.minSampleSize` | `5` | number | Min market data points before AI fallback |
| `ai.pricing.dailyLimit` | `50` | number | Per-user daily limit |
| `ai.categorize.dailyLimit` | `100` | number | Per-user daily limit |
| `ai.visualSearch.dailyLimit` | `30` | number | Per-user daily limit |
| `ai.moderation.autoRemoveThreshold` | `0.95` | number | Confidence for auto-remove |
| `ai.moderation.flagThreshold` | `0.7` | number | Confidence for flag-for-review |
| `ai.helpdesk.dailyLimitPerAgent` | `100` | number | Per-agent daily limit |

### 10.6 Preserved Existing Keys

- `ai.autofill.model`, `ai.autofill.maxTokens`
- `helpdesk.ai.provider`, `helpdesk.ai.model`, `helpdesk.ai.suggestionEnabled`, `helpdesk.ai.assistEnabled`
- `trust.authentication.ai*` (all existing keys)
- `finance.receiptScanning.provider`, `finance.receiptScanning.model`

---

## 11. RBAC

All AI settings and metrics are governed by **PlatformRole** only.

| Action | Required Role |
|---|---|
| Use AI features (autofill, description, pricing, categorize) | Any authenticated user |
| Use visual search | Any authenticated user |
| View AI usage metrics/dashboard | PlatformRole.ADMIN |
| Modify AI settings/budgets | PlatformRole.ADMIN |
| Use helpdesk AI assist | PlatformRole.SUPPORT or PlatformRole.ADMIN |
| Trigger AI authentication | Any seller (listing owner) |
| View AI moderation queue | PlatformRole.MODERATION or PlatformRole.ADMIN |
| Override AI moderation decision | PlatformRole.TRUST_SAFETY or PlatformRole.ADMIN |

---

## 12. Observability

| Metric | Type | Description |
|---|---|---|
| `ai.calls.total` | counter | Total AI API calls by feature + model + provider |
| `ai.calls.latency` | histogram | Call latency by feature |
| `ai.calls.errors` | counter | Errors by feature + error type |
| `ai.tokens.input` | counter | Input tokens by feature + model |
| `ai.tokens.output` | counter | Output tokens by feature + model |
| `ai.cache.hits` | counter | Cache hits by feature |
| `ai.cache.misses` | counter | Cache misses by feature |
| `ai.circuit.state` | gauge | Circuit breaker state per provider (0=closed, 1=open, 2=half-open) |
| `ai.budget.pct` | gauge | Current month budget utilization % |
| `ai.moderation.auto_removed` | counter | Auto-removed content by category |
| `ai.moderation.flagged` | counter | Flagged-for-review content by category |

---

## 13. Privacy & Data Handling

### 13.1 Data Sent to Providers

| Feature | Data Sent | PII Risk |
|---|---|---|
| Autofill | Listing photos only | NONE |
| Description | Title, attributes, photos | NONE |
| Categorize | Title, description, photo | NONE |
| Pricing | Title, category, brand, condition | NONE |
| Image analysis | Listing photos | NONE |
| Visual search | Uploaded photo | LOW (user photo) |
| Authentication | Listing photos, brand, model | NONE |
| Helpdesk | Case subject, message history | HIGH (user messages) |
| Fraud | Content text, behavioral metadata | MEDIUM |
| Moderation | Content text, images | MEDIUM |
| Receipt OCR | Receipt image | HIGH (financial data) |

### 13.2 PII Handling Rules

1. **Helpdesk:** Strip email addresses, phone numbers, and full names from message history before sending to AI provider. Use `[EMAIL]`, `[PHONE]`, `[NAME]` placeholders.
2. **Fraud/Moderation:** Strip user IDs from content. Pass behavioral metadata only (counts, timestamps, not identifiers).
3. **Receipt OCR:** No PII stripping needed (receipt is seller's own data). Do NOT log extracted financial amounts in `ai_usage_log.error` field.

### 13.3 Opt-Out

Users can disable AI features for their account via `(hub)/my/settings/privacy`:
- `userSetting.aiAutofillEnabled` (default true)
- `userSetting.aiDescriptionEnabled` (default true)
- `userSetting.aiPricingEnabled` (default true)

Content moderation and fraud detection cannot be opted out of (platform safety).

### 13.4 Data Retention

- `ai_usage_log`: 90 days, then archived to cold storage
- `ai_embedding_cache`: 30 days (Valkey), permanent in PG (periodic cleanup of stale embeddings)
- AI provider logs: governed by provider DPA (Data Processing Agreement)

---

## 14. Graceful Degradation Rules

AI is **enhancement, not dependency**. Every feature must work without AI:

| Feature | Degraded Behavior |
|---|---|
| Autofill | User fills fields manually (existing flow) |
| Description | User writes description manually |
| Categorization | User selects category from tree |
| Price suggestion | Show market intelligence data only (no AI explanation) |
| Visual search | Fall back to text search with "upload photo" disabled |
| Authentication | Route to expert human review only |
| Helpdesk assist | Agent writes reply without suggestion |
| Fraud signals | Rule-based signals only (existing risk engine) |
| Recommendations | Popular/trending items only (no personalization) |
| Query understanding | Pass query directly to Typesense keyword search |
| Content moderation | Queue all content for manual review |
| Embeddings | Search falls back to keyword-only (existing V3 behavior) |
| Receipt OCR | Manual expense entry |

---

## 15. Testing Contract

- All AI feature tests mock the provider via `vi.mock('@twicely/ai/providers/openai')`.
- Provider tests use recorded HTTP fixtures (no live API calls in CI).
- Each feature file has a co-located test with at least: happy path, rate limit hit, provider error/circuit breaker, cache hit.
- Minimum test count target: 100+ tests across the package.

| Test Category | Min Tests |
|---|---|
| Provider abstraction + fallback chain | 8 |
| Cache (embed, complete, vision) | 10 |
| Circuit breaker (per-provider) | 6 |
| Rate limiter (per-feature) | 8 |
| Batch processing | 4 |
| Autofill | 6 |
| Description generation | 5 |
| Smart categorization | 5 |
| Price suggestion | 6 |
| Image analysis | 6 |
| Visual search | 5 |
| AI authentication | 6 |
| Helpdesk (suggest + assist + route) | 8 |
| Fraud signals | 5 |
| Recommendations | 5 |
| Query understanding | 6 |
| Content moderation | 6 |
| Embeddings | 4 |
| Receipt OCR | 4 |
| **Total** | **111** |

---

## 16. Hub Routes

| Route | Description |
|---|---|
| `(hub)/cfg/ai` | AI settings dashboard (models, budgets, feature toggles) |
| `(hub)/cfg/ai/usage` | AI usage metrics (token consumption, cost, latency charts) |
| `(hub)/mod/ai-moderation` | AI content moderation queue (flagged items) |

---

## 17. Out of Scope

- Training or fine-tuning models (use provider APIs as-is)
- Running models on-premise (local provider is dev-only placeholder)
- Real-time streaming responses (all calls are request/response)
- AI-generated pricing that auto-sets prices (suggestion only, seller confirms)
- AI chatbot for buyers (helpdesk AI is agent-assist only, not customer-facing)
- Image generation (no DALL-E / Stable Diffusion integration)

---

## 18. Final Rule

All AI interactions across the platform flow through `@twicely/ai`. Any code that calls an AI provider SDK directly (OpenAI, Anthropic, etc.) outside this package is a **blocking code review violation**.

If a new AI feature is needed, it must be added to this canonical first, then implemented in `packages/ai/src/`.
