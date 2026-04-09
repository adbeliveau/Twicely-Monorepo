# PHASE V4-16: AI Module Install

**Canonical:** `30_AI_MODULE.md`
**Depends On:** None (foundation package)
**Blocked By:** Nothing
**Estimated Tests:** 85+

---

## Step 1: Package Scaffold

### 1.1 Create package.json

**File:** `packages/ai/package.json`

```json
{
  "name": "@twicely/ai",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./*": "./src/*.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@twicely/db": "workspace:*",
    "@twicely/utils": "workspace:*",
    "openai": "^4.73.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20"
  }
}
```

### 1.2 Create tsconfig.json

**File:** `packages/ai/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### 1.3 Create vitest.config.ts

**File:** `packages/ai/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    setupFiles: [],
  },
});
```

### 1.4 Run

```bash
pnpm install
npx turbo typecheck --filter=@twicely/ai
```

---

## Step 2: Types & Provider Interface

### 2.1 Core Types

**File:** `packages/ai/src/types.ts`

```ts
import type { ZodSchema } from 'zod';

export interface CompletionRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
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
  dimensions?: number;
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
  imageUrls: string[];
  maxTokens: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface VisionResponse extends CompletionResponse {}

export interface StructuredRequest<T> {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: ZodSchema<T>;
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

export type AiFeature =
  | 'autofill'
  | 'description'
  | 'categorize'
  | 'pricing'
  | 'image-analysis'
  | 'authentication'
  | 'helpdesk'
  | 'fraud'
  | 'embeddings'
  | 'receipt-ocr'
  | 'nl-query'
  | 'autocomplete';
```

### 2.2 Provider Interface

**File:** `packages/ai/src/provider.ts`

```ts
import type {
  CompletionRequest, CompletionResponse,
  EmbedRequest, EmbedResponse,
  VisionRequest, VisionResponse,
  StructuredRequest, StructuredResponse,
} from './types';

export interface AiProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  embed(req: EmbedRequest): Promise<EmbedResponse>;
  vision(req: VisionRequest): Promise<VisionResponse>;
  structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>>;
}
```

### 2.3 Provider Factory

**File:** `packages/ai/src/resolve-provider.ts`

```ts
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { AiProvider } from './provider';

let cachedProvider: AiProvider | null = null;

export async function resolveProvider(): Promise<AiProvider> {
  if (cachedProvider) return cachedProvider;
  const name = await getPlatformSetting<string>('ai.provider', 'openai');
  switch (name) {
    case 'openai': {
      const { OpenAiProvider } = await import('./providers/openai');
      cachedProvider = new OpenAiProvider();
      return cachedProvider;
    }
    default:
      throw new Error(`Unknown AI provider: ${name}`);
  }
}

export function resetProvider(): void {
  cachedProvider = null;
}
```

**Tests:** 3 tests (resolve openai, unknown provider throws, reset clears cache)

---

## Step 3: OpenAI Provider

**File:** `packages/ai/src/providers/openai.ts`

```ts
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { AiProvider } from '../provider';
import type {
  CompletionRequest, CompletionResponse,
  EmbedRequest, EmbedResponse,
  VisionRequest, VisionResponse,
  StructuredRequest, StructuredResponse,
} from '../types';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is required');
    this.client = new OpenAI({ apiKey });
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();
    const res = await this.client.chat.completions.create({
      model: req.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      max_tokens: req.maxTokens,
      temperature: req.temperature ?? 0.3,
      response_format: req.jsonMode ? { type: 'json_object' } : undefined,
    });
    return {
      text: res.choices[0]?.message?.content ?? '',
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
      model: res.model,
      latencyMs: Date.now() - start,
      cached: false,
    };
  }

  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    const start = Date.now();
    const res = await this.client.embeddings.create({
      model: req.model,
      input: req.inputs,
      dimensions: req.dimensions,
    });
    return {
      embeddings: res.data.map((d) => d.embedding),
      model: res.model,
      totalTokens: res.usage.total_tokens,
      latencyMs: Date.now() - start,
    };
  }

  async vision(req: VisionRequest): Promise<VisionResponse> {
    const start = Date.now();
    const imageContent = req.imageUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'low' as const },
    }));
    const res = await this.client.chat.completions.create({
      model: req.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: req.userPrompt },
            ...imageContent,
          ],
        },
      ],
      max_tokens: req.maxTokens,
      temperature: req.temperature ?? 0.3,
      response_format: req.jsonMode ? { type: 'json_object' } : undefined,
    });
    return {
      text: res.choices[0]?.message?.content ?? '',
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
      model: res.model,
      latencyMs: Date.now() - start,
      cached: false,
    };
  }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    const start = Date.now();
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: req.systemPrompt },
    ];
    if (req.imageUrls?.length) {
      const imageContent = req.imageUrls.map((url) => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'low' as const },
      }));
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: req.userPrompt },
          ...imageContent,
        ],
      });
    } else {
      messages.push({ role: 'user', content: req.userPrompt });
    }
    const res = await this.client.chat.completions.create({
      model: req.model,
      messages,
      max_tokens: req.maxTokens,
      response_format: zodResponseFormat(req.schema, 'response'),
    });
    const raw = res.choices[0]?.message?.content ?? '{}';
    const data = req.schema.parse(JSON.parse(raw));
    return {
      data,
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
      model: res.model,
      latencyMs: Date.now() - start,
    };
  }
}
```

**Tests:** 8 tests (complete happy, embed happy, vision happy, structured happy, missing API key throws, JSON mode, error propagation, multi-image vision)

---

## Step 4: Cache, Circuit Breaker, Rate Limiter

### 4.1 Cache

**File:** `packages/ai/src/cache.ts`

Signature:
```ts
export async function getCached(type: 'embed' | 'completion' | 'vision', key: string): Promise<string | null>;
export async function setCached(type: 'embed' | 'completion' | 'vision', key: string, value: string, ttlSeconds: number): Promise<void>;
export function cacheKey(type: string, ...parts: string[]): string;
```

Implementation: Valkey GET/SET with `ai:cache:{type}:{sha256(parts)}` key pattern. Falls back to null (no cache) if Valkey unavailable.

**Tests:** 5 tests (get/set, TTL, Valkey down returns null, key generation, type isolation)

### 4.2 Circuit Breaker

**File:** `packages/ai/src/circuit-breaker.ts`

Signature:
```ts
export class CircuitBreaker {
  constructor(opts: { failureThreshold: number; resetTimeoutMs: number });
  async execute<T>(fn: () => Promise<T>): Promise<T>;  // throws AiUnavailableError if open
  get state(): 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  reset(): void;
}
export class AiUnavailableError extends Error {}
```

**Tests:** 6 tests (closed pass-through, opens after threshold, half-open probe, resets on success, AiUnavailableError type, concurrent calls while open)

### 4.3 Rate Limiter

**File:** `packages/ai/src/rate-limiter.ts`

Signature:
```ts
export async function checkRateLimit(feature: AiFeature, userId: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }>;
export async function getRateLimitConfig(feature: AiFeature): Promise<{ limit: number; windowSeconds: number }>;
```

Valkey INCR with TTL on key `ai:rate:{feature}:{userId}:{window}`. Config from platform_settings.

**Tests:** 5 tests (allowed, exhausted, window reset, unknown feature, Valkey down allows)

### 4.4 Usage Logger

**File:** `packages/ai/src/usage-log.ts`

Signature:
```ts
export async function logUsage(entry: {
  feature: AiFeature;
  userId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cached: boolean;
  error?: string;
}): Promise<void>;

export async function getMonthlyUsage(): Promise<{ inputTokens: number; outputTokens: number; costMicros: number }>;
```

**Tests:** 4 tests (log writes, monthly aggregation, cost calculation, fire-and-forget on error)

### 4.5 Cost Estimator

**File:** `packages/ai/src/cost-estimator.ts`

```ts
// Pricing per 1M tokens in microdollars
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini':              { input: 150_000, output: 600_000 },
  'gpt-4o':                   { input: 2_500_000, output: 10_000_000 },
  'text-embedding-3-small':   { input: 20_000, output: 0 },
};

export function estimateCostMicros(model: string, inputTokens: number, outputTokens: number): number;
```

**Tests:** 3 tests (known model, unknown model returns 0, edge cases)

---

## Step 5: Feature Implementations

### 5.1 Embeddings

**File:** `packages/ai/src/embeddings.ts`

```ts
import { resolveProvider } from './resolve-provider';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { getCached, setCached, cacheKey } from './cache';
import { logUsage } from './usage-log';

export async function embedTexts(texts: string[], dimensions?: number): Promise<number[][]> {
  const provider = await resolveProvider();
  const model = await getPlatformSetting<string>('ai.model.embedding', 'text-embedding-3-small');
  const dims = dimensions ?? await getPlatformSetting<number>('ai.model.embeddingDimensions', 512);

  // Check cache for each text
  const results: (number[] | null)[] = await Promise.all(
    texts.map(async (t) => {
      const cached = await getCached('embed', cacheKey('embed', model, String(dims), t));
      return cached ? JSON.parse(cached) : null;
    })
  );

  const uncachedIndices = results.map((r, i) => r === null ? i : -1).filter((i) => i >= 0);
  if (uncachedIndices.length > 0) {
    const uncachedTexts = uncachedIndices.map((i) => texts[i]!);
    const res = await provider.embed({ model, inputs: uncachedTexts, dimensions: dims });

    const ttl = await getPlatformSetting<number>('ai.cache.embeddingTtlSeconds', 604800);
    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j]!;
      results[idx] = res.embeddings[j]!;
      void setCached('embed', cacheKey('embed', model, String(dims), texts[idx]!), JSON.stringify(res.embeddings[j]), ttl);
    }

    void logUsage({
      feature: 'embeddings', model,
      inputTokens: res.totalTokens, outputTokens: 0,
      latencyMs: res.latencyMs, cached: false,
    });
  }

  return results as number[][];
}

export async function embedQuery(query: string, dimensions?: number): Promise<number[]> {
  const [embedding] = await embedTexts([query], dimensions);
  return embedding!;
}
```

**Tests:** 6 tests (single text, batch, cache hit, cache miss, mixed cached/uncached, usage logged)

### 5.2 Autofill

**File:** `packages/ai/src/autofill.ts`

```ts
import { z } from 'zod';
import { resolveProvider } from './resolve-provider';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { checkRateLimit } from './rate-limiter';
import { logUsage } from './usage-log';
import { AUTOFILL_SYSTEM_PROMPT } from './prompts/autofill-system';

const AutofillSchema = z.object({
  title: z.string(),
  description: z.string(),
  brand: z.string().nullable(),
  condition: z.string(),
  categorySlug: z.string(),
  attributes: z.record(z.string()),
  tags: z.array(z.string()),
  confidence: z.number(),
});

export type AutofillResult = z.infer<typeof AutofillSchema>;

export interface AutofillRequest {
  imageUrls: string[];
  categoryHint?: string;
  existingTitle?: string;
  userId: string;
}

export async function autofillFromImages(req: AutofillRequest): Promise<AutofillResult> {
  const enabled = await getPlatformSetting<boolean>('ai.autofill.enabled', true);
  if (!enabled) throw new Error('AI autofill is disabled');

  const { allowed } = await checkRateLimit('autofill', req.userId);
  if (!allowed) throw new Error('Monthly autofill limit reached');

  const model = await getPlatformSetting<string>('ai.model.vision', 'gpt-4o-mini');
  const maxTokens = await getPlatformSetting<number>('ai.autofill.maxTokens', 2048);
  const provider = await resolveProvider();

  const userPrompt = [
    req.existingTitle ? `Current title: ${req.existingTitle}` : '',
    req.categoryHint ? `Category hint: ${req.categoryHint}` : '',
    'Analyze the images and fill in listing details.',
  ].filter(Boolean).join('\n');

  const res = await provider.structured<AutofillResult>({
    model,
    systemPrompt: AUTOFILL_SYSTEM_PROMPT,
    userPrompt,
    schema: AutofillSchema,
    maxTokens,
    imageUrls: req.imageUrls.slice(0, 8),
  });

  void logUsage({
    feature: 'autofill', userId: req.userId, model,
    inputTokens: res.inputTokens, outputTokens: res.outputTokens,
    latencyMs: res.latencyMs, cached: false,
  });

  return res.data;
}
```

**Tests:** 6 tests (happy path, disabled, rate limited, max 8 images, usage logged, provider error)

### 5.3 Description Generation

**File:** `packages/ai/src/description.ts`

Signature:
```ts
export interface DescriptionRequest {
  title: string;
  brand?: string;
  condition?: string;
  categoryName?: string;
  attributes?: Record<string, string>;
  imageUrls?: string[];
  tone?: 'professional' | 'casual' | 'luxury';
  userId: string;
}
export interface DescriptionResult {
  description: string;
  suggestedTags: string[];
  inputTokens: number;
  outputTokens: number;
}
export async function generateDescription(req: DescriptionRequest): Promise<DescriptionResult>;
```

Uses `ai.model.completionDefault` if no images, `ai.model.vision` if images provided. Max length from `ai.description.maxLength`.

**Tests:** 5 tests (text-only, with images, tone variants, max length enforced, rate limited)

### 5.4 Smart Categorization

**File:** `packages/ai/src/categorize.ts`

Signature:
```ts
export interface CategorizationRequest {
  title: string;
  description?: string;
  imageUrl?: string;
  brand?: string;
}
export interface CategorySuggestion {
  categoryId: string;
  categoryPath: string;
  confidence: number;
}
export async function suggestCategories(req: CategorizationRequest): Promise<CategorySuggestion[]>;
```

Returns top 3 suggestions. Uses structured output with zod schema. Category list injected from DB at call time (passed as context in system prompt).

**Tests:** 4 tests (text-only, with image, returns top 3, empty input)

### 5.5 Price Suggestion

**File:** `packages/ai/src/pricing.ts`

Signature:
```ts
export interface PriceSuggestionRequest {
  title: string;
  categoryId: string;
  brand?: string;
  condition: string;
  imageUrl?: string;
  marketData?: { medianCents: number; lowCents: number; highCents: number; sampleSize: number };
}
export interface PriceSuggestionResult {
  suggestedPriceCents: number;
  lowCents: number;
  highCents: number;
  marketMedianCents: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  sampleSize: number;
}
export async function suggestPrice(req: PriceSuggestionRequest): Promise<PriceSuggestionResult>;
```

If `marketData` provided and `sampleSize >= ai.pricing.minSampleSize`, returns market data directly without AI call. AI call only when data is sparse.

**Tests:** 5 tests (market data sufficient, market data sparse triggers AI, no market data, integer cents enforced, reasoning present)

### 5.6 Remaining Features

Each file follows the same pattern. Exact signatures in canonical 30_AI_MODULE.md sections 4.5-4.8, 4.10.

| File | Tests |
|---|---|
| `packages/ai/src/image-analysis.ts` | 4 (quality, duplicate, policy, watermark) |
| `packages/ai/src/authentication.ts` | 5 (authenticated, counterfeit, inconclusive, unsupported category, premium model used) |
| `packages/ai/src/helpdesk.ts` | 5 (suggest reply, assist reply, disabled toggle, KB grounding, rate limited) |
| `packages/ai/src/fraud.ts` | 4 (listing fraud, message phishing, review fake, action mapping) |
| `packages/ai/src/receipt-ocr.ts` | 4 (happy path, bad URL rejected, integer cents, missing provider graceful) |

---

## Step 6: System Prompts

**Directory:** `packages/ai/src/prompts/`

Each file exports a `const` string. No logic, pure prompt text.

| File | Content Focus |
|---|---|
| `autofill-system.ts` | "You are a product listing assistant for a peer-to-peer resale marketplace..." |
| `description-system.ts` | "Generate a compelling listing description for a resale item..." |
| `categorize-system.ts` | "Given item details, select the best matching category..." |
| `pricing-system.ts` | "Given item details and market data, suggest a competitive price..." |
| `authentication-system.ts` | "You are an expert luxury goods authenticator..." |
| `helpdesk-system.ts` | "You are a customer support assistant for Twicely marketplace..." |
| `fraud-system.ts` | "Analyze the following content for potential fraud signals..." |

No tests needed for pure prompt constants.

---

## Step 7: Database Schema

### 7.1 Schema File

**File:** `packages/db/src/schema/ai-usage.ts`

```ts
import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';

export const aiUsageLog = pgTable('ai_usage_log', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  feature:      text('feature').notNull(),
  userId:       text('user_id').references(() => user.id, { onDelete: 'set null' }),
  model:        text('model').notNull(),
  inputTokens:  integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  latencyMs:    integer('latency_ms').notNull(),
  cached:       boolean('cached').notNull().default(false),
  error:        text('error'),
  costMicros:   integer('cost_micros').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  featureCreatedIdx: index('ai_usage_feature_created').on(table.feature, table.createdAt),
  userCreatedIdx:    index('ai_usage_user_created').on(table.userId, table.createdAt),
}));
```

### 7.2 Add to schema index

Add `export * from './ai-usage';` to `packages/db/src/schema/index.ts`.

### 7.3 Migration

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Step 8: Platform Settings Seed

**File:** `packages/db/src/seed/seed-ai-module.ts`

Add all keys from canonical 30_AI_MODULE.md section 7. Import and call from `packages/db/src/seed.ts`.

---

## Step 9: Validation

```bash
pnpm install
npx turbo typecheck                    # 25/25 packages pass (new: @twicely/ai)
npx turbo test --filter=@twicely/ai    # 85+ tests pass
npx turbo test                         # 9838+ baseline preserved
```

---

## Deliverables Checklist

- [ ] `packages/ai/package.json` + `tsconfig.json` + `vitest.config.ts`
- [ ] `packages/ai/src/types.ts` — all request/response types
- [ ] `packages/ai/src/provider.ts` — AiProvider interface
- [ ] `packages/ai/src/resolve-provider.ts` — provider factory
- [ ] `packages/ai/src/providers/openai.ts` — OpenAI implementation
- [ ] `packages/ai/src/cache.ts` — Valkey caching
- [ ] `packages/ai/src/circuit-breaker.ts` — circuit breaker
- [ ] `packages/ai/src/rate-limiter.ts` — per-feature rate limiting
- [ ] `packages/ai/src/usage-log.ts` — usage logging
- [ ] `packages/ai/src/cost-estimator.ts` — cost estimation
- [ ] `packages/ai/src/embeddings.ts` — embedding generation
- [ ] `packages/ai/src/autofill.ts` — listing autofill
- [ ] `packages/ai/src/description.ts` — description generation
- [ ] `packages/ai/src/categorize.ts` — smart categorization
- [ ] `packages/ai/src/pricing.ts` — price suggestion
- [ ] `packages/ai/src/image-analysis.ts` — image analysis
- [ ] `packages/ai/src/authentication.ts` — AI authentication
- [ ] `packages/ai/src/helpdesk.ts` — helpdesk assist
- [ ] `packages/ai/src/fraud.ts` — fraud signals
- [ ] `packages/ai/src/receipt-ocr.ts` — receipt OCR
- [ ] `packages/ai/src/prompts/` — 7 system prompt files
- [ ] `packages/db/src/schema/ai-usage.ts` — usage log table
- [ ] `packages/db/src/seed/seed-ai-module.ts` — platform settings
- [ ] 85+ tests passing
- [ ] Typecheck clean
- [ ] Baseline tests preserved
