/**
 * Abstract AI authentication provider adapter.
 * Entrupy is the first implementation (ai-provider-factory.ts selects by name).
 * User-facing UI must never mention specific provider names — only "AI Authentication".
 */

export interface AiAuthSubmission {
  requestId: string;
  photoUrls: string[];
  category: string;
  itemTitle: string;
  itemPriceCents: number;
}

export interface AiAuthResult {
  providerRef: string;
  status: 'AUTHENTICATED' | 'INCONCLUSIVE' | 'COUNTERFEIT';
  confidence: number;
  resultJson: Record<string, unknown>;
  resultNotes: string;
}

export interface AiAuthProvider {
  readonly name: string;
  submitForAuthentication(
    submission: AiAuthSubmission
  ): Promise<{ providerRef: string; submittedAt: Date }>;
  getResult(providerRef: string): Promise<AiAuthResult | null>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseWebhookResult(payload: string): AiAuthResult;
}
