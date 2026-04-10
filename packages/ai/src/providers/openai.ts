/**
 * OpenAI Provider Implementation
 *
 * Uses raw fetch (NOT the openai SDK) for completions, embeddings, vision,
 * and structured output. Supports gpt-4o-mini, gpt-4o, text-embedding-3-*.
 */

import type {
  AiProvider,
  CompletionRequest,
  CompletionResponse,
  EmbedRequest,
  EmbedResponse,
  VisionRequest,
  VisionResponse,
  StructuredRequest,
  StructuredResponse,
} from '../types';
import { logger } from '@twicely/logger';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }>;
}

interface OpenAIChatResponse {
  choices: Array<{ message: { content: string | null } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
  model: string;
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage: { total_tokens: number };
  model: string;
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');
  return apiKey;
}

async function openaiRequest<T>(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const apiKey = getApiKey();
  const res = await fetch(`${OPENAI_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();

    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userPrompt },
    ];

    const body: Record<string, unknown> = {
      model: req.model,
      messages,
      max_tokens: req.maxTokens,
      temperature: req.temperature ?? 0.3,
    };

    if (req.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const data = await openaiRequest<OpenAIChatResponse>(
      '/chat/completions',
      body,
      req.abortSignal,
    );

    return {
      text: data.choices[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      model: data.model,
      latencyMs: Date.now() - start,
      cached: false,
    };
  }

  async embed(req: EmbedRequest): Promise<EmbedResponse> {
    const start = Date.now();

    const body: Record<string, unknown> = {
      model: req.model,
      input: req.inputs,
    };

    if (req.dimensions !== undefined) {
      body.dimensions = req.dimensions;
    }

    const data = await openaiRequest<OpenAIEmbeddingResponse>(
      '/embeddings',
      body,
    );

    return {
      embeddings: data.data.map((d) => d.embedding),
      model: data.model,
      totalTokens: data.usage.total_tokens,
      latencyMs: Date.now() - start,
    };
  }

  async vision(req: VisionRequest): Promise<VisionResponse> {
    const start = Date.now();

    const imageContent = req.imageUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'low' as const },
    }));

    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: req.systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: req.userPrompt },
          ...imageContent,
        ],
      },
    ];

    const body: Record<string, unknown> = {
      model: req.model,
      messages,
      max_tokens: req.maxTokens,
      temperature: req.temperature ?? 0.3,
    };

    if (req.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const data = await openaiRequest<OpenAIChatResponse>(
      '/chat/completions',
      body,
    );

    return {
      text: data.choices[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      model: data.model,
      latencyMs: Date.now() - start,
      cached: false,
    };
  }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    const start = Date.now();

    const messages: OpenAIChatMessage[] = [
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

    const body: Record<string, unknown> = {
      model: req.model,
      messages,
      max_tokens: req.maxTokens,
      temperature: 0,
      response_format: { type: 'json_object' },
    };

    const data = await openaiRequest<OpenAIChatResponse>(
      '/chat/completions',
      body,
    );

    const raw = data.choices[0]?.message?.content ?? '{}';
    const parsed = req.schema.parse(JSON.parse(raw));

    logger.debug('[openai] structured response parsed', { model: req.model });

    return {
      data: parsed,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      model: data.model,
      latencyMs: Date.now() - start,
    };
  }
}
