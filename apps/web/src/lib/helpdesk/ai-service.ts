/**
 * AI Service for helpdesk suggestion generation and reply assist.
 * Uses @anthropic-ai/sdk when available. All errors are caught gracefully.
 * Model is read from platform_settings, never hardcoded in API calls.
 * Server-side only — do NOT import in client components.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

const FALLBACK_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 500;
const TEMPERATURE = 0.3;
const TIMEOUT_MS = 5000;

// =============================================================================
// SETTINGS HELPERS
// =============================================================================

async function getSettingValue(key: string): Promise<unknown> {
  const rows = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, key))
    .limit(1);
  return rows[0]?.value;
}

async function getAiModel(): Promise<string> {
  const model = await getSettingValue('helpdesk.ai.model');
  return typeof model === 'string' ? model : FALLBACK_MODEL;
}

// =============================================================================
// CASE CONTEXT TYPE
// =============================================================================

export interface CaseContext {
  type: string;
  priority: string;
  subject: string;
  description: string | null;
  recentMessages: Array<{ direction: string; body: string }>;
  linkedEntitySummary?: string;
}

// =============================================================================
// GENERATE SUGGESTION
// =============================================================================

/**
 * Generate a suggested agent reply for a helpdesk case.
 * Returns null on any error or when feature is disabled.
 */
export async function generateSuggestion(caseContext: CaseContext): Promise<string | null> {
  try {
    const enabled = await getSettingValue('helpdesk.ai.suggestionEnabled');
    if (enabled === false) return null;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const model = await getAiModel();

    const messagesText = caseContext.recentMessages
      .slice(0, 5)
      .map((m) => `[${m.direction}] ${m.body}`)
      .join('\n');

    const contextBlock = [
      `Case Type: ${caseContext.type}`,
      `Priority: ${caseContext.priority}`,
      `Subject: ${caseContext.subject}`,
      caseContext.description ? `Description: ${caseContext.description}` : null,
      messagesText ? `Recent Messages:\n${messagesText}` : null,
      caseContext.linkedEntitySummary ? `Context: ${caseContext.linkedEntitySummary}` : null,
    ].filter(Boolean).join('\n');

    const Anthropic = await loadAnthropicSdk();
    if (!Anthropic) return null;

    const client = new Anthropic({ apiKey });

    const result = await withTimeout(
      client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: 'You are a customer support agent for Twicely, a peer-to-peer resale marketplace. Based on the case context below, draft a helpful, professional reply to the customer. Be concise. Do not make commitments the agent cannot keep. Format: plain text.',
        messages: [{ role: 'user', content: contextBlock }],
      }),
      TIMEOUT_MS
    );

    const content = result.content[0];
    if (content?.type === 'text' && content.text !== undefined) return content.text.trim();
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// ASSIST REPLY
// =============================================================================

export type AssistAction = 'REWRITE' | 'SUMMARIZE' | 'TRANSLATE_ES' | 'TRANSLATE_FR';

const ASSIST_PROMPTS: Record<AssistAction, string> = {
  REWRITE: 'Rewrite this support reply to be more professional and empathetic. Keep the same meaning.',
  SUMMARIZE: 'Summarize this support reply into 2-3 concise sentences.',
  TRANSLATE_ES: 'Translate this support reply into Spanish. Keep the professional tone.',
  TRANSLATE_FR: 'Translate this support reply into French. Keep the professional tone.',
};

/**
 * Transform an agent's draft reply using AI.
 * Returns null on any error, empty body, or when feature is disabled.
 */
export async function assistReply(body: string, action: AssistAction): Promise<string | null> {
  try {
    if (!body.trim()) return null;

    const enabled = await getSettingValue('helpdesk.ai.assistEnabled');
    if (enabled === false) return null;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const model = await getAiModel();

    const Anthropic = await loadAnthropicSdk();
    if (!Anthropic) return null;

    const client = new Anthropic({ apiKey });
    const systemPrompt = ASSIST_PROMPTS[action];

    const result = await withTimeout(
      client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: systemPrompt,
        messages: [{ role: 'user', content: body }],
      }),
      TIMEOUT_MS
    );

    const content = result.content[0];
    if (content?.type === 'text' && content.text !== undefined) return content.text.trim();
    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

type AnthropicConstructor = new (opts: { apiKey: string }) => {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      temperature: number;
      system: string;
      messages: Array<{ role: string; content: string }>;
    }) => Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
};

async function loadAnthropicSdk(): Promise<AnthropicConstructor | null> {
  try {
    const mod = await import('@anthropic-ai/sdk');
    // ESM default export
    if (typeof mod.default === 'function') return mod.default as AnthropicConstructor;
    // CJS double-wrap interop: mod.default.default
    if (mod.default && typeof mod.default === 'object') {
      const nested = (mod.default as { default?: unknown }).default;
      if (typeof nested === 'function') return nested as AnthropicConstructor;
    }
    return null;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}
