'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Textarea } from '@twicely/ui/textarea';
import { Checkbox } from '@twicely/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@twicely/ui/select';
import { EXPENSE_CATEGORIES } from '@/lib/validations/finance-center';
import { createExpenseAction, updateExpenseAction } from '@/lib/actions/finance-center-expenses';
import { ReceiptUpload } from './receipt-upload';
import type { ExpenseRow } from '@/lib/queries/finance-center';
import type { ReceiptOcrResult } from '@twicely/finance/receipt-ocr';

interface ExpenseFormProps {
  expense?: ExpenseRow;
  onSuccess: () => void;
  onCancel: () => void;
}

function formatDateForInput(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

function centsToDollarString(cents: number): string {
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainder = Math.abs(cents) % 100;
  return `${dollars}.${remainder.toString().padStart(2, '0')}`;
}

function dollarStringToCents(value: string): number | null {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return null;
  return Math.round(num * 100);
}

export function ExpenseForm({ expense, onSuccess, onCancel }: ExpenseFormProps) {
  const isEdit = !!expense;
  const today = formatDateForInput(new Date());
  const [category, setCategory] = useState<string>(expense?.category ?? '');
  const [amountStr, setAmountStr] = useState<string>(
    expense ? centsToDollarString(expense.amountCents) : '',
  );
  const [vendor, setVendor] = useState(expense?.vendor ?? '');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [expenseDate, setExpenseDate] = useState(
    expense ? formatDateForInput(expense.expenseDate) : today,
  );
  const [isRecurring, setIsRecurring] = useState(expense?.isRecurring ?? false);
  const [recurringFrequency, setRecurringFrequency] = useState<string>(
    expense?.recurringFrequency ?? '',
  );
  const [recurringEndDate, setRecurringEndDate] = useState(
    expense?.recurringEndDate ? formatDateForInput(expense.recurringEndDate) : '',
  );
  const [receiptUrl, setReceiptUrl] = useState<string | null>(expense?.receiptUrl ?? null);
  const [ocrSuggestions, setOcrSuggestions] = useState<ReceiptOcrResult | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReceiptUpload(file: File) {
    setUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'receipt');
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const json = await res.json() as { success: boolean; image?: { url?: string }; error?: string };
      if (json.success && json.image?.url) {
        setReceiptUrl(json.image.url);
        setOcrSuggestions(null);
      } else {
        setError(json.error ?? 'Receipt upload failed');
      }
    } finally {
      setUploadingReceipt(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountCents = dollarStringToCents(amountStr);
    if (!amountCents) { setError('Amount must be a positive number'); return; }
    if (!category) { setError('Category is required'); return; }
    const expenseDateIso = new Date(expenseDate).toISOString();
    const recurringEndDateIso =
      isRecurring && recurringEndDate ? new Date(recurringEndDate).toISOString() : undefined;
    const recurringFreqTyped = isRecurring && recurringFrequency
      ? (recurringFrequency as 'WEEKLY' | 'MONTHLY' | 'ANNUAL')
      : null;
    setLoading(true);
    try {
      if (isEdit && expense) {
        const result = await updateExpenseAction({
          id: expense.id,
          category: category as typeof EXPENSE_CATEGORIES[number],
          amountCents, vendor: vendor || null, description: description || null,
          expenseDate: expenseDateIso, isRecurring,
          recurringFrequency: recurringFreqTyped,
          recurringEndDate: recurringEndDateIso ?? null,
          receiptUrl: receiptUrl ?? null,
        });
        if (!result.success) { setError(result.error); return; }
        if (result.expense.receiptDataJson) {
          setOcrSuggestions(result.expense.receiptDataJson as ReceiptOcrResult);
        }
      } else {
        const result = await createExpenseAction({
          category: category as typeof EXPENSE_CATEGORIES[number],
          amountCents, vendor: vendor || undefined, description: description || undefined,
          expenseDate: expenseDateIso, isRecurring,
          recurringFrequency: recurringFreqTyped ?? undefined,
          recurringEndDate: recurringEndDateIso,
          receiptUrl: receiptUrl ?? undefined,
        });
        if (!result.success) { setError(result.error); return; }
        if (result.expense.receiptDataJson) {
          setOcrSuggestions(result.expense.receiptDataJson as ReceiptOcrResult);
          return;
        }
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-1">
        <Label htmlFor="category">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="amount">Amount</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <Input id="amount" type="number" step="0.01" min="0.01" placeholder="0.00"
            value={amountStr} onChange={(e) => setAmountStr(e.target.value)} className="pl-7" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="vendor">Vendor (optional)</Label>
        <Input id="vendor" type="text" maxLength={200} value={vendor}
          onChange={(e) => setVendor(e.target.value)} placeholder="e.g. USPS, Office Depot" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" maxLength={1000} value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief notes about this expense" rows={3} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="expenseDate">Date</Label>
        <Input id="expenseDate" type="date" value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)} />
      </div>
      <ReceiptUpload
        receiptUrl={receiptUrl}
        ocrSuggestions={ocrSuggestions}
        uploading={uploadingReceipt}
        onUpload={handleReceiptUpload}
        onRemove={() => { setReceiptUrl(null); setOcrSuggestions(null); }}
        onApplyVendor={(v) => setVendor(v)}
        onApplyAmount={(cents) => setAmountStr(centsToDollarString(cents))}
        onApplyDate={(d) => setExpenseDate(d.slice(0, 10))}
        onApplyCategory={(cat) => setCategory(cat)}
      />
      <div className="flex items-center gap-2">
        <Checkbox id="isRecurring" checked={isRecurring}
          onCheckedChange={(checked) => setIsRecurring(!!checked)} />
        <Label htmlFor="isRecurring" className="cursor-pointer">Recurring expense</Label>
      </div>
      {isRecurring && (
        <div className="space-y-4 pl-6 border-l-2 border-muted">
          <div className="space-y-1">
            <Label htmlFor="recurringFrequency">Frequency</Label>
            <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
              <SelectTrigger id="recurringFrequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="ANNUAL">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="recurringEndDate">End date (optional)</Label>
            <Input id="recurringEndDate" type="date" value={recurringEndDate}
              onChange={(e) => setRecurringEndDate(e.target.value)} />
          </div>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading || uploadingReceipt}>
          {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Add expense'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        {ocrSuggestions && (
          <Button type="button" variant="outline" onClick={onSuccess}>Done</Button>
        )}
      </div>
    </form>
  );
}
