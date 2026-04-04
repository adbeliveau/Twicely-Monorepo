'use server';

import { authorize, sub } from '@twicely/casl';
import { logger } from '@twicely/logger';
import { db } from '@twicely/db';
import { expense } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  createExpenseSchema,
  updateExpenseSchema,
  deleteExpenseSchema,
  listExpensesSchema,
} from '@/lib/validations/finance-center';
import {
  getFinanceTier,
  getExpenseList,
  getExpenseById,
  type ExpenseRow,
  type ExpenseListResult,
} from '@/lib/queries/finance-center';
import { extractReceiptData } from '@twicely/finance/receipt-ocr';

export type CreateExpenseResponse =
  | { success: true; expense: ExpenseRow }
  | { success: false; error: string };

export type UpdateExpenseResponse =
  | { success: true; expense: ExpenseRow }
  | { success: false; error: string };

export type DeleteExpenseResponse =
  | { success: true }
  | { success: false; error: string };

export type ListExpensesResponse =
  | { success: true; data: ExpenseListResult }
  | { success: false; error: string };

// Shared returning columns for insert/update mutations
const EXPENSE_RETURNING = {
  id: expense.id,
  category: expense.category,
  amountCents: expense.amountCents,
  currency: expense.currency,
  vendor: expense.vendor,
  description: expense.description,
  receiptUrl: expense.receiptUrl,
  receiptDataJson: expense.receiptDataJson,
  expenseDate: expense.expenseDate,
  isRecurring: expense.isRecurring,
  recurringFrequency: expense.recurringFrequency,
  recurringEndDate: expense.recurringEndDate,
  parentExpenseId: expense.parentExpenseId,
  createdAt: expense.createdAt,
  updatedAt: expense.updatedAt,
} as const;

/** Resolve the effective userId (owner or delegated seller). */
function resolveUserId(session: { delegationId: string | null; onBehalfOfSellerId?: string | null; userId: string }): string {
  return session.delegationId ? session.onBehalfOfSellerId! : session.userId;
}

export async function createExpenseAction(
  input: unknown,
): Promise<CreateExpenseResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('create', sub('Expense', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const financeTier = await getFinanceTier(userId);
  if (financeTier !== 'PRO') {
    return { success: false, error: 'Upgrade to Finance Pro to manage expenses' };
  }

  try {
    const { category, amountCents, vendor, description, expenseDate, isRecurring, recurringFrequency, recurringEndDate, receiptUrl } = parsed.data;

    const [inserted] = await db
      .insert(expense)
      .values({
        userId,
        category,
        amountCents,
        currency: 'USD',
        vendor: vendor ?? null,
        description: description ?? null,
        receiptUrl: receiptUrl ?? null,
        expenseDate: new Date(expenseDate),
        isRecurring,
        recurringFrequency: recurringFrequency ?? null,
        recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null,
      })
      .returning(EXPENSE_RETURNING);

    if (!inserted) return { success: false, error: 'Failed to create expense' };

    // Run OCR if receipt was provided; store result in receiptDataJson
    let finalExpense: ExpenseRow = inserted;
    if (receiptUrl && inserted.id) {
      const ocrResult = await extractReceiptData(receiptUrl);
      await db
        .update(expense)
        .set({ receiptDataJson: ocrResult })
        .where(and(eq(expense.id, inserted.id), eq(expense.userId, userId)));
      finalExpense = { ...inserted, receiptDataJson: ocrResult };
    }

    revalidatePath('/my/selling/finances');
    revalidatePath('/my/selling/finances/expenses');
    return { success: true, expense: finalExpense };
  } catch (error) {
    logger.error('[createExpenseAction] Failed to create expense', { error: String(error) });
    return { success: false, error: 'Failed to create expense' };
  }
}

export async function updateExpenseAction(
  input: unknown,
): Promise<UpdateExpenseResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('update', sub('Expense', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updateExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const financeTier = await getFinanceTier(userId);
  if (financeTier !== 'PRO') {
    return { success: false, error: 'Upgrade to Finance Pro to manage expenses' };
  }

  try {
    const { id, ...fields } = parsed.data;

    const existing = await getExpenseById(userId, id);
    if (!existing) return { success: false, error: 'Expense not found' };

    const updateValues: Partial<{
      category: string;
      amountCents: number;
      vendor: string | null;
      description: string | null;
      receiptUrl: string | null;
      receiptDataJson: unknown;
      expenseDate: Date;
      isRecurring: boolean;
      recurringFrequency: string | null;
      recurringEndDate: Date | null;
    }> = {};

    if (fields.category !== undefined) updateValues.category = fields.category;
    if (fields.amountCents !== undefined) updateValues.amountCents = fields.amountCents;
    if ('vendor' in fields) updateValues.vendor = fields.vendor ?? null;
    if ('description' in fields) updateValues.description = fields.description ?? null;
    if (fields.expenseDate !== undefined) updateValues.expenseDate = new Date(fields.expenseDate);
    if (fields.isRecurring !== undefined) updateValues.isRecurring = fields.isRecurring;
    if ('recurringFrequency' in fields) updateValues.recurringFrequency = fields.recurringFrequency ?? null;
    if ('recurringEndDate' in fields) {
      updateValues.recurringEndDate = fields.recurringEndDate ? new Date(fields.recurringEndDate) : null;
    }
    if ('receiptUrl' in fields) updateValues.receiptUrl = fields.receiptUrl ?? null;

    const [updated] = await db
      .update(expense)
      .set(updateValues)
      .where(and(eq(expense.id, id), eq(expense.userId, userId)))
      .returning(EXPENSE_RETURNING);

    if (!updated) return { success: false, error: 'Failed to update expense' };

    // Run OCR if a new receipt URL was provided
    let finalExpense: ExpenseRow = updated;
    if (fields.receiptUrl) {
      const ocrResult = await extractReceiptData(fields.receiptUrl);
      await db
        .update(expense)
        .set({ receiptDataJson: ocrResult })
        .where(and(eq(expense.id, id), eq(expense.userId, userId)));
      finalExpense = { ...updated, receiptDataJson: ocrResult };
    }

    revalidatePath('/my/selling/finances');
    revalidatePath('/my/selling/finances/expenses');
    return { success: true, expense: finalExpense };
  } catch (error) {
    logger.error('[updateExpenseAction] Failed to update expense', { error: String(error) });
    return { success: false, error: 'Failed to update expense' };
  }
}

export async function deleteExpenseAction(
  input: unknown,
): Promise<DeleteExpenseResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('delete', sub('Expense', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = deleteExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const financeTier = await getFinanceTier(userId);
  if (financeTier !== 'PRO') {
    return { success: false, error: 'Upgrade to Finance Pro to manage expenses' };
  }

  try {
    const { id } = parsed.data;

    const existing = await getExpenseById(userId, id);
    if (!existing) return { success: false, error: 'Expense not found' };

    await db
      .delete(expense)
      .where(and(eq(expense.id, id), eq(expense.userId, userId)));

    revalidatePath('/my/selling/finances');
    revalidatePath('/my/selling/finances/expenses');
    return { success: true };
  } catch (error) {
    logger.error('[deleteExpenseAction] Failed to delete expense', { error: String(error) });
    return { success: false, error: 'Failed to delete expense' };
  }
}

export async function listExpensesAction(
  input: unknown,
): Promise<ListExpensesResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = resolveUserId(session);

  if (!ability.can('read', sub('Expense', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = listExpensesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const financeTier = await getFinanceTier(userId);
  if (financeTier !== 'PRO') {
    return { success: false, error: 'Upgrade to Finance Pro to view expenses' };
  }

  try {
    const data = await getExpenseList(userId, parsed.data);
    return { success: true, data };
  } catch (error) {
    logger.error('[listExpensesAction] Failed to load expenses', { error: String(error) });
    return { success: false, error: 'Failed to load expenses' };
  }
}

