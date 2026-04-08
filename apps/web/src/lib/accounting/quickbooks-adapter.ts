/**
 * QuickBooks Online adapter — G10.3
 * Implements AccountingAdapter using fetch() only (no SDK).
 * All config from platform_settings via getPlatformSetting().
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
  qbGetAuthorizationUrl,
  qbExchangeCode,
  qbRefreshTokens,
} from './quickbooks-oauth';

export class QuickBooksAdapter implements AccountingAdapter {
  readonly provider = 'QUICKBOOKS' as const;

  async getAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
    return qbGetAuthorizationUrl(state, redirectUri);
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
    return qbExchangeCode(code, redirectUri);
  }

  async refreshTokens(refreshToken: string): Promise<TokenResult> {
    return qbRefreshTokens(refreshToken);
  }

  async getCompanyInfo(accessToken: string, realmId: string): Promise<CompanyInfo> {
    const apiUrl = await getPlatformSetting<string>(
      'accounting.quickbooks.apiUrl',
      'https://quickbooks.api.intuit.com',
    );

    const response = await fetch(
      `${apiUrl}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=65`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`QuickBooks getCompanyInfo failed (${response.status})`);
    }

    const data = await response.json() as {
      CompanyInfo: {
        CompanyName: string;
        Country: string;
        SupportedLanguages?: string;
      };
    };

    return {
      name: data.CompanyInfo.CompanyName,
      currency: 'USD',
      country: data.CompanyInfo.Country,
    };
  }

  async createInvoice(
    accessToken: string,
    realmId: string,
    invoiceData: InvoiceData,
  ): Promise<ExternalEntity> {
    const apiUrl = await getPlatformSetting<string>(
      'accounting.quickbooks.apiUrl',
      'https://quickbooks.api.intuit.com',
    );

    const lineItems = invoiceData.lineItems.map((item) => ({
      Amount: item.amountCents / 100,
      DetailType: 'SalesItemLineDetail',
      Description: item.description,
      SalesItemLineDetail: {
        Qty: item.quantity,
        UnitPrice: item.amountCents / 100 / item.quantity,
      },
    }));

    const payload = {
      Line: lineItems,
      CustomerRef: { name: invoiceData.customerName },
      TxnDate: invoiceData.datePaid.toISOString().split('T')[0],
      DocNumber: invoiceData.reference,
    };

    const response = await fetch(
      `${apiUrl}/v3/company/${realmId}/invoice?minorversion=65`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`QuickBooks createInvoice failed (${response.status}): ${body}`);
    }

    const data = await response.json() as { Invoice: { Id: string } };

    return {
      externalId: data.Invoice.Id,
      externalType: 'INVOICE',
      url: `${apiUrl}/app/invoice?txnId=${data.Invoice.Id}`,
    };
  }

  async createExpense(
    accessToken: string,
    realmId: string,
    expenseData: ExpenseData,
  ): Promise<ExternalEntity> {
    const apiUrl = await getPlatformSetting<string>(
      'accounting.quickbooks.apiUrl',
      'https://quickbooks.api.intuit.com',
    );

    const payload = {
      PaymentType: 'Cash',
      EntityRef: { name: expenseData.vendor },
      TxnDate: expenseData.date.toISOString().split('T')[0],
      PrivateNote: expenseData.description,
      DocNumber: expenseData.reference,
      Line: [
        {
          Amount: expenseData.amountCents / 100,
          DetailType: 'AccountBasedExpenseLineDetail',
          AccountBasedExpenseLineDetail: {
            AccountRef: { name: expenseData.category },
          },
        },
      ],
    };

    const response = await fetch(
      `${apiUrl}/v3/company/${realmId}/purchase?minorversion=65`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`QuickBooks createExpense failed (${response.status}): ${body}`);
    }

    const data = await response.json() as { Purchase: { Id: string } };

    return {
      externalId: data.Purchase.Id,
      externalType: 'BILL',
    };
  }

  async createJournalEntry(
    accessToken: string,
    realmId: string,
    entryData: JournalEntryData,
  ): Promise<ExternalEntity> {
    const apiUrl = await getPlatformSetting<string>(
      'accounting.quickbooks.apiUrl',
      'https://quickbooks.api.intuit.com',
    );

    const lines = entryData.lines.map((line) => ({
      Amount: (line.debitCents > 0 ? line.debitCents : line.creditCents) / 100,
      DetailType: 'JournalEntryLineDetail',
      Description: entryData.memo,
      JournalEntryLineDetail: {
        PostingType: line.debitCents > 0 ? 'Debit' : 'Credit',
        AccountRef: { name: line.accountName },
      },
    }));

    const payload = {
      TxnDate: entryData.date.toISOString().split('T')[0],
      PrivateNote: entryData.memo,
      DocNumber: entryData.reference,
      Line: lines,
    };

    const response = await fetch(
      `${apiUrl}/v3/company/${realmId}/journalentry?minorversion=65`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`QuickBooks createJournalEntry failed (${response.status}): ${body}`);
    }

    const data = await response.json() as { JournalEntry: { Id: string } };

    return {
      externalId: data.JournalEntry.Id,
      externalType: 'JOURNAL_ENTRY',
    };
  }
}
