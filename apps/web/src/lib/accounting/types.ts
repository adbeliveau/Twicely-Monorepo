/**
 * Abstract adapter interface and shared types for QB/Xero integrations — G10.3
 */

export interface AccountingAdapter {
  readonly provider: 'QUICKBOOKS' | 'XERO';

  // OAuth
  getAuthorizationUrl(state: string, redirectUri: string): Promise<string>;
  exchangeCode(code: string, redirectUri: string): Promise<TokenResult>;
  refreshTokens(refreshToken: string): Promise<TokenResult>;

  // Company info
  getCompanyInfo(accessToken: string, realmId: string): Promise<CompanyInfo>;

  // Sync operations
  createInvoice(accessToken: string, realmId: string, data: InvoiceData): Promise<ExternalEntity>;
  createExpense(accessToken: string, realmId: string, data: ExpenseData): Promise<ExternalEntity>;
  createJournalEntry(accessToken: string, realmId: string, data: JournalEntryData): Promise<ExternalEntity>;

  // Verify webhook (if provider supports)
  verifyWebhook?(payload: string, signature: string): boolean;
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  realmId?: string;    // QB-specific
  tenantId?: string;   // Xero-specific
}

export interface CompanyInfo {
  name: string;
  currency: string;
  country: string;
}

export interface InvoiceData {
  customerName: string;
  lineItems: { description: string; amountCents: number; quantity: number }[];
  datePaid: Date;
  reference: string;   // Twicely order ID
}

export interface ExpenseData {
  vendor: string;
  category: string;
  amountCents: number;
  date: Date;
  description: string;
  reference: string;
}

export interface JournalEntryData {
  memo: string;
  lines: { accountName: string; debitCents: number; creditCents: number }[];
  date: Date;
  reference: string;
}

export interface ExternalEntity {
  externalId: string;
  externalType: string;
  url?: string;
}
