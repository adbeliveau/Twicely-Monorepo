/**
 * Xero adapter — G10.3
 * Implements AccountingAdapter using fetch() only (no SDK).
 * All config from platform_settings via getPlatformSetting().
 * Xero uses tenantId header instead of realmId in URL.
 */

import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type {
  AccountingAdapter,
  TokenResult,
  CompanyInfo,
  InvoiceData,
  ExpenseData,
  JournalEntryData,
  ExternalEntity,
} from './types';
import {
  xeroGetAuthorizationUrl,
  xeroExchangeCode,
  xeroRefreshTokens,
} from './xero-oauth';

export class XeroAdapter implements AccountingAdapter {
  readonly provider = 'XERO' as const;

  async getAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
    return xeroGetAuthorizationUrl(state, redirectUri);
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
    return xeroExchangeCode(code, redirectUri);
  }

  async refreshTokens(refreshToken: string): Promise<TokenResult> {
    return xeroRefreshTokens(refreshToken);
  }

  async getCompanyInfo(accessToken: string, tenantId: string): Promise<CompanyInfo> {
    const apiUrl = await getPlatformSetting<string>(
      'accounting.xero.apiUrl',
      'https://api.xero.com/api.xro/2.0',
    );

    const response = await fetch(`${apiUrl}/Organisation`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Xero getCompanyInfo failed (${response.status})`);
    }

    const data = await response.json() as {
      Organisations: Array<{
        Name: string;
        BaseCurrency: string;
        CountryCode: string;
      }>;
    };

    const org = data.Organisations[0];
    if (!org) throw new Error('Xero: no organisation found');

    return {
      name: org.Name,
      currency: org.BaseCurrency,
      country: org.CountryCode,
    };
  }

  async createInvoice(
    accessToken: string,
    tenantId: string,
    invoiceData: InvoiceData,
  ): Promise<ExternalEntity> {
    const apiUrl = await getPlatformSetting<string>(
      'accounting.xero.apiUrl',
      'https://api.xero.com/api.xro/2.0',
    );

    const lineItems = invoiceData.lineItems.map((item) => ({
      Description: item.description,
      Quantity: item.quantity,
      UnitAmount: item.amountCents / 100 / item.quantity,
      LineAmount: item.amountCents / 100,
    }));

    const payload = {
      Type: 'ACCREC',
      Contact: { Name: invoiceData.customerName },
      Date: invoiceData.datePaid.toISOString().split('T')[0],
      LineItems: lineItems,
      InvoiceNumber: invoiceData.reference,
      Status: 'AUTHORISED',
    };

    const response = await fetch(`${apiUrl}/Invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Xero createInvoice failed (${response.status}): ${body}`);
    }

    const data = await response.json() as {
      Invoices: Array<{ InvoiceID: string }>;
    };

    const invoiceId = data.Invoices[0]?.InvoiceID;
    if (!invoiceId) throw new Error('Xero: invoice ID missing in response');

    return {
      externalId: invoiceId,
      externalType: 'INVOICE',
    };
  }

  async createExpense(
    accessToken: string,
    tenantId: string,
    expenseData: ExpenseData,
  ): Promise<ExternalEntity> {
    const apiUrl = await getPlatformSetting<string>(
      'accounting.xero.apiUrl',
      'https://api.xero.com/api.xro/2.0',
    );

    const payload = {
      Type: 'ACCPAY',
      Contact: { Name: expenseData.vendor },
      Date: expenseData.date.toISOString().split('T')[0],
      Reference: expenseData.reference,
      LineItems: [
        {
          Description: expenseData.description,
          Quantity: 1,
          UnitAmount: expenseData.amountCents / 100,
          AccountCode: expenseData.category,
        },
      ],
      Status: 'AUTHORISED',
    };

    const response = await fetch(`${apiUrl}/Invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Xero createExpense failed (${response.status}): ${body}`);
    }

    const data = await response.json() as {
      Invoices: Array<{ InvoiceID: string }>;
    };

    const invoiceId = data.Invoices[0]?.InvoiceID;
    if (!invoiceId) throw new Error('Xero: bill ID missing in response');

    return {
      externalId: invoiceId,
      externalType: 'BILL',
    };
  }

  async createJournalEntry(
    accessToken: string,
    tenantId: string,
    entryData: JournalEntryData,
  ): Promise<ExternalEntity> {
    const apiUrl = await getPlatformSetting<string>(
      'accounting.xero.apiUrl',
      'https://api.xero.com/api.xro/2.0',
    );

    const lines = entryData.lines.map((line) => ({
      Description: entryData.memo,
      AccountCode: line.accountName,
      LineAmount: line.debitCents > 0 ? line.debitCents / 100 : -(line.creditCents / 100),
    }));

    const payload = {
      Narration: entryData.memo,
      Date: entryData.date.toISOString().split('T')[0],
      Reference: entryData.reference,
      JournalLines: lines,
    };

    const response = await fetch(`${apiUrl}/ManualJournals`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Xero createJournalEntry failed (${response.status}): ${body}`);
    }

    const data = await response.json() as {
      ManualJournals: Array<{ ManualJournalID: string }>;
    };

    const journalId = data.ManualJournals[0]?.ManualJournalID;
    if (!journalId) throw new Error('Xero: journal entry ID missing in response');

    return {
      externalId: journalId,
      externalType: 'JOURNAL_ENTRY',
    };
  }
}
