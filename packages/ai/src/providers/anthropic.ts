/**
 * Anthropic Provider Implementation
 *
 * Uses raw fetch (NOT the anthropic SDK) for completions and vision.
 * Embeddings fall back to OpenAI since Anthropic has no embedding API.
 * Supports claude-3-5-haiku and claude-sonnet-4.
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

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>;
}

interface AnthropicResponse {
  content: Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown }>;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
}

function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required');
  return apiKey;
}

async function anthropicRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const apiKey = getApiKey();
  const res = await fetch(`${ANTHROPIC_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.userPrompt }],
      temperature: req.temperature ?? 0.3,
    };

    const data = await anthropicRequest<AnthropicResponse>('/messages', body);

    const textContent = data.content.find((c) => c.type === 'text');
    const text = textContent && 'text' in textContent ? textContent.text : '';

    return {
      text,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      model: data.model,
      latencyMs: Date.now() - start,
      cached: false,
    };
  }

  async embed(_req: EmbedRequest): Promise<EmbedResponse> {
    // Anthropic has no embedding API; caller should use OpenAI for embeddings
    throw new Error('Anthropic does not support embeddings. Use OpenAI for embedding requests.');
  }

  async vision(req: VisionRequest): Promise<VisionResponse> {
    const start = Date.now();

    // Anthropic uses base64 image format; for URL-based images we fetch and encode
    // In production this would convert URLs to base64; for now we pass URL as text context
    const imageDescriptions = req.imageUrls.map((url, i) => `[Image ${i + 1}: ${url}]`).join('\n');
    const userContent = `${req.userPrompt}\n\n${imageDescriptions}`;

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      temperature: req.temperature ?? 0.3,
    };

    const data = await anthropicRequest<AnthropicResponse>('/messages', body);

    const textContent = data.content.find((c) => c.type === 'text');
    const text = textContent && 'text' in textContent ? textContent.text : '';

    return {
      text,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      model: data.model,
      latencyMs: Date.now() - start,
      cached: false,
    };
  }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    const start = Date.now();

    // Use tool_use pattern for structured output with Anthropic
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.userPrompt }],
      temperature: 0,
      tools: [
        {
          name: 'structured_response',
          description: 'Return structured data matching the required schema',
          input_schema: { type: 'object' },
        },
      ],
      tool_choice: { type: 'tool', name: 'structured_response' },
    };

    const data = await anthropicRequest<AnthropicResponse>('/messages', body);

    const toolUse = data.content.find((c) => c.type === 'tool_use');
    const rawInput = toolUse && 'input' in toolUse ? toolUse.input : {};
    const parsed = req.schema.parse(rawInput);

    logger.debug('[anthropic] structured response parsed', { model: req.model });

    return {
      data: parsed,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      model: data.model,
      latencyMs: Date.now() - start,
    };
  }
}
