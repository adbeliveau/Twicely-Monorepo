/**
 * Helpdesk AI Assist Feature
 *
 * AI-powered suggested replies, draft improvement, and auto-routing.
 */

import { z } from 'zod';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { AiFeature } from '../types';
import { AiDisabledError } from '../types';
import { resolveProvider } from '../providers/provider-resolver';
import { checkRateLimit } from '../rate-limiter';
import { checkBudget } from '../budget';
import { logUsage } from '../usage-log';
import {
  HELPDESK_SUGGEST_PROMPT,
  HELPDESK_ASSIST_PROMPT,
  HELPDESK_ROUTE_PROMPT,
} from '../prompts/helpdesk-system';

const FEATURE: AiFeature = 'helpdesk';

// ─── Suggest Reply ───────────────────────────────────────────────────────────

const SuggestResultSchema = z.object({
  suggestedReply: z.string(),
  confidence: z.number().min(0).max(1),
  referencedArticles: z.array(z.string()),
  tone: z.enum(['empathetic', 'factual', 'apologetic']),
});

export interface HelpdeskSuggestRequest {
  caseId: string;
  caseSubject: string;
  caseCategory: string;
  messageHistory: Array<{ role: 'user' | 'agent'; text: string; timestamp: string }>;
  kbArticleSlugs?: string[];
  agentId: string;
}

export interface HelpdeskSuggestResult {
  suggestedReply: string;
  confidence: number;
  referencedArticles: string[];
  tone: 'empathetic' | 'factual' | 'apologetic';
}

export async function suggestReply(req: HelpdeskSuggestRequest): Promise<HelpdeskSuggestResult> {
  // 1. Kill switch
  const suggestionEnabled = await getPlatformSetting<boolean>('helpdesk.ai.suggestionEnabled', true);
  if (!suggestionEnabled) throw new AiDisabledError(FEATURE);

  // 2. Rate limit
  const { allowed } = await checkRateLimit(FEATURE, req.agentId);
  if (!allowed) throw new Error('Daily helpdesk AI assist limit reached');

  // 3. Budget
  await checkBudget(FEATURE);

  // 4. Build prompt
  const history = req.messageHistory
    .map((m) => `[${m.role.toUpperCase()}] ${m.text}`)
    .join('\n');

  const parts = [
    `Case ID: ${req.caseId}`,
    `Subject: ${req.caseSubject}`,
    `Category: ${req.caseCategory}`,
    `\nMessage History:\n${history}`,
  ];

  if (req.kbArticleSlugs?.length) {
    parts.push(`\nRelevant KB Articles: ${req.kbArticleSlugs.join(', ')}`);
  }

  const userPrompt = parts.join('\n');

  // 5. Call provider
  const provider = await resolveProvider();
  const model = await getPlatformSetting<string>('ai.model.completionDefault', 'gpt-4o-mini');

  const res = await provider.complete({
    model,
    systemPrompt: HELPDESK_SUGGEST_PROMPT,
    userPrompt,
    maxTokens: 1024,
    temperature: 0.3,
    jsonMode: true,
  });

  const parsed = SuggestResultSchema.parse(JSON.parse(res.text));

  // 6. Log
  void logUsage({
    feature: FEATURE,
    userId: req.agentId,
    provider: provider.name,
    model: res.model,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    latencyMs: res.latencyMs,
    cached: false,
  });

  logger.debug('[ai:helpdesk] Suggested reply', { caseId: req.caseId, tone: parsed.tone });
  return parsed;
}

// ─── Assist Reply ────────────────────────────────────────────────────────────

const AssistResultSchema = z.object({
  revisedDraft: z.string(),
  changes: z.array(z.string()),
});

export interface HelpdeskAssistRequest {
  agentDraft: string;
  caseContext: string;
  instruction: string;
  agentId: string;
}

export interface HelpdeskAssistResult {
  revisedDraft: string;
  changes: string[];
}

export async function assistReply(req: HelpdeskAssistRequest): Promise<HelpdeskAssistResult> {
  // 1. Kill switch
  const assistEnabled = await getPlatformSetting<boolean>('helpdesk.ai.assistEnabled', true);
  if (!assistEnabled) throw new AiDisabledError(FEATURE);

  // 2. Rate limit
  const { allowed } = await checkRateLimit(FEATURE, req.agentId);
  if (!allowed) throw new Error('Daily helpdesk AI assist limit reached');

  // 3. Budget
  await checkBudget(FEATURE);

  const userPrompt = [
    `Agent Draft:\n${req.agentDraft}`,
    `\nCase Context:\n${req.caseContext}`,
    `\nInstruction: ${req.instruction}`,
  ].join('\n');

  const provider = await resolveProvider();
  const model = await getPlatformSetting<string>('ai.model.completionDefault', 'gpt-4o-mini');

  const res = await provider.complete({
    model,
    systemPrompt: HELPDESK_ASSIST_PROMPT,
    userPrompt,
    maxTokens: 1024,
    temperature: 0.3,
    jsonMode: true,
  });

  const parsed = AssistResultSchema.parse(JSON.parse(res.text));

  void logUsage({
    feature: FEATURE,
    userId: req.agentId,
    provider: provider.name,
    model: res.model,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    latencyMs: res.latencyMs,
    cached: false,
  });

  logger.debug('[ai:helpdesk] Assisted reply', { changes: parsed.changes.length });
  return parsed;
}

// ─── Route Case ──────────────────────────────────────────────────────────────

const RouteResultSchema = z.object({
  suggestedCategory: z.string(),
  suggestedPriority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  sentimentScore: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
});

export interface HelpdeskRouteRequest {
  subject: string;
  body: string;
  buyerHistory?: { orderCount: number; disputeCount: number };
}

export interface HelpdeskRouteResult {
  suggestedCategory: string;
  suggestedPriority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  sentimentScore: number;
  confidence: number;
}

export async function routeCase(req: HelpdeskRouteRequest): Promise<HelpdeskRouteResult> {
  // 1. Kill switch
  const enabled = await getPlatformSetting<boolean>('helpdesk.ai.routingEnabled', true);
  if (!enabled) throw new AiDisabledError(FEATURE);

  // 2. Budget
  await checkBudget(FEATURE);

  const parts = [
    `Subject: ${req.subject}`,
    `Body: ${req.body}`,
  ];
  if (req.buyerHistory) {
    parts.push(`Buyer history: ${req.buyerHistory.orderCount} orders, ${req.buyerHistory.disputeCount} disputes`);
  }

  const userPrompt = parts.join('\n');

  const provider = await resolveProvider();
  const model = await getPlatformSetting<string>('ai.model.completionDefault', 'gpt-4o-mini');

  const res = await provider.complete({
    model,
    systemPrompt: HELPDESK_ROUTE_PROMPT,
    userPrompt,
    maxTokens: 256,
    temperature: 0.1,
    jsonMode: true,
  });

  const parsed = RouteResultSchema.parse(JSON.parse(res.text));

  void logUsage({
    feature: FEATURE,
    provider: provider.name,
    model: res.model,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
    latencyMs: res.latencyMs,
    cached: false,
  });

  logger.debug('[ai:helpdesk] Routed', {
    category: parsed.suggestedCategory,
    priority: parsed.suggestedPriority,
  });

  return parsed;
}
