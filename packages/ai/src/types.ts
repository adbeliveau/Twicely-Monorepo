/**
 * @twicely/ai — Core Types
 *
 * All request/response types for the AI module.
 * Provider interface, feature enum, model configs.
 */

import type { ZodSchema } from 'zod';

// ─── Feature Identifiers ────────────────────────────────────────────────────

export type AiFeature =
  | 'autofill'
  | 'description'
  | 'categorize'
  | 'pricing'
  | 'image-analysis'
  | 'visual-search'
  | 'authentication'
  | 'helpdesk'
  | 'fraud'
  | 'recommendations'
  | 'nl-query'
  | 'moderation'
  | 'embeddings'
  | 'receipt-ocr';

/** Features exempt from token budget caps (always allowed) */
export const BUDGET_EXEMPT_FEATURES: ReadonlySet<AiFeature> = new Set([
  'fraud',
  'moderation',
  'authentication',
]);

// ─── Request Types ───────────────────────────────────────────────────────────

export interface CompletionRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
  jsonMode?: boolean;
  abortSignal?: AbortSignal;
}

export interface EmbedRequest {
  model: string;
  inputs: string[];
  dimensions?: number;
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

export interface StructuredRequest<T> {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: ZodSchema<T>;
  maxTokens: number;
  imageUrls?: string[];
}

// ─── Response Types ──────────────────────────────────────────────────────────

export interface CompletionResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
  cached: boolean;
}

export interface EmbedResponse {
  embeddings: number[][];
  model: string;
  totalTokens: number;
  latencyMs: number;
}

export interface VisionResponse extends CompletionResponse {}

export interface StructuredResponse<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
}

// ─── Provider Interface ──────────────────────────────────────────────────────

export interface AiProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  embed(req: EmbedRequest): Promise<EmbedResponse>;
  vision(req: VisionRequest): Promise<VisionResponse>;
  structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>>;
}

// ─── Model Pricing (per 1M tokens in microdollars) ───────────────────────────

export interface ModelPricing {
  input: number;
  output: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o-mini':              { input:   150_000, output:    600_000 },
  'gpt-4o':                   { input: 2_500_000, output: 10_000_000 },
  'text-embedding-3-small':   { input:    20_000, output:          0 },
  'text-embedding-3-large':   { input:   130_000, output:          0 },
  'claude-3-5-haiku-latest':  { input:   800_000, output:  4_000_000 },
  'claude-sonnet-4-20250514': { input: 3_000_000, output: 15_000_000 },
};

// ─── Error Types ─────────────────────────────────────────────────────────────

export class AiUnavailableError extends Error {
  constructor(message = 'AI provider is temporarily unavailable') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export class AiRateLimitError extends Error {
  constructor(
    public readonly feature: AiFeature,
    public readonly resetAt: Date,
  ) {
    super(`Rate limit exceeded for AI feature: ${feature}`);
    this.name = 'AiRateLimitError';
  }
}

export class AiBudgetExceededError extends Error {
  constructor(public readonly feature: AiFeature) {
    super(`Monthly AI budget exceeded for feature: ${feature}`);
    this.name = 'AiBudgetExceededError';
  }
}

export class AiDisabledError extends Error {
  constructor(public readonly feature: AiFeature) {
    super(`AI feature is disabled: ${feature}`);
    this.name = 'AiDisabledError';
  }
}
