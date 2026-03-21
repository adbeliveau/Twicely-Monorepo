import { z } from 'zod';

export const transactionHistorySchema = z
  .object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
    type: z
      .enum([
        'ORDER_PAYMENT_CAPTURED',
        'ORDER_TF_FEE',
        'ORDER_BOOST_FEE',
        'ORDER_STRIPE_PROCESSING_FEE',
        'INSERTION_FEE',
        'SUBSCRIPTION_CHARGE',
        'FINANCE_SUBSCRIPTION_CHARGE',
        'PAYOUT_SENT',
        'PAYOUT_FAILED',
        'PAYOUT_REVERSED',
        'REFUND_FULL',
        'REFUND_PARTIAL',
        'REFUND_TF_REVERSAL',
        'REFUND_BOOST_REVERSAL',
        'REFUND_STRIPE_REVERSAL',
        'SHIPPING_LABEL_PURCHASE',
        'SHIPPING_LABEL_REFUND',
        'MANUAL_CREDIT',
        'MANUAL_DEBIT',
        'RESERVE_HOLD',
        'RESERVE_RELEASE',
        'LOCAL_TRANSACTION_FEE',
        'AUTH_FEE_BUYER',
        'AUTH_FEE_SELLER',
      ])
      .optional(),
    typeGroup: z
      .enum(['ALL', 'SALES', 'FEES', 'PAYOUTS', 'REFUNDS', 'OTHER'])
      .optional(),
  })
  .strict();

export const dashboardPeriodSchema = z
  .object({
    days: z.number().int().positive().max(365).default(30),
  })
  .strict();

export type TransactionHistoryInput = z.infer<typeof transactionHistorySchema>;
export type DashboardPeriodInput = z.infer<typeof dashboardPeriodSchema>;

// 16 preset expense categories from Financial Center Canonical section 3 / Platform Settings section 9
export const EXPENSE_CATEGORIES = [
  'Shipping Supplies',
  'Packaging',
  'Equipment',
  'Software/Subscriptions',
  'Mileage',
  'Storage/Rent',
  'Sourcing Trips',
  'Photography',
  'Authentication',
  'Platform Fees',
  'Postage',
  'Returns/Losses',
  'Marketing',
  'Office Supplies',
  'Professional Services',
  'Other',
] as const;

export const createExpenseSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES),
    amountCents: z.number().int().positive(),
    vendor: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
    expenseDate: z.string().datetime(),
    isRecurring: z.boolean().default(false),
    recurringFrequency: z.enum(['WEEKLY', 'MONTHLY', 'ANNUAL']).optional(),
    recurringEndDate: z.string().datetime().optional(),
    receiptUrl: z.string().url().optional(),
  })
  .strict()
  .refine(
    (data) => !data.isRecurring || data.recurringFrequency,
    {
      message: 'Recurring frequency required when expense is recurring',
      path: ['recurringFrequency'],
    },
  );

export const updateExpenseSchema = z
  .object({
    id: z.string().cuid2(),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    amountCents: z.number().int().positive().optional(),
    vendor: z.string().max(200).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    expenseDate: z.string().datetime().optional(),
    isRecurring: z.boolean().optional(),
    recurringFrequency: z.enum(['WEEKLY', 'MONTHLY', 'ANNUAL']).optional().nullable(),
    recurringEndDate: z.string().datetime().optional().nullable(),
    receiptUrl: z.string().url().optional().nullable(),
  })
  .strict();

export const deleteExpenseSchema = z
  .object({
    id: z.string().cuid2(),
  })
  .strict();

export const listExpensesSchema = z
  .object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    sortBy: z.enum(['expenseDate', 'amountCents', 'category', 'createdAt']).default('expenseDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type DeleteExpenseInput = z.infer<typeof deleteExpenseSchema>;
export type ListExpensesInput = z.infer<typeof listExpensesSchema>;

export const createMileageSchema = z
  .object({
    description: z.string().min(1).max(500),
    miles: z.number().positive().max(10000),
    tripDate: z.string().datetime(),
  })
  .strict();

export const updateMileageSchema = z
  .object({
    id: z.string().cuid2(),
    description: z.string().min(1).max(500).optional(),
    miles: z.number().positive().max(10000).optional(),
    tripDate: z.string().datetime().optional(),
  })
  .strict();

export const deleteMileageSchema = z
  .object({
    id: z.string().cuid2(),
  })
  .strict();

export const listMileageSchema = z
  .object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    sortBy: z.enum(['tripDate', 'miles', 'deductionCents', 'createdAt']).default('tripDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export type CreateMileageInput = z.infer<typeof createMileageSchema>;
export type UpdateMileageInput = z.infer<typeof updateMileageSchema>;
export type DeleteMileageInput = z.infer<typeof deleteMileageSchema>;
export type ListMileageInput = z.infer<typeof listMileageSchema>;

// D4.3 Report generation schemas

export const REPORT_TYPES = ['PNL', 'BALANCE_SHEET', 'CASH_FLOW'] as const;
export const REPORT_FORMATS = ['JSON', 'CSV', 'PDF'] as const;

export const generateReportSchema = z
  .object({
    reportType: z.enum(REPORT_TYPES),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    format: z.enum(REPORT_FORMATS).default('JSON'),
  })
  .strict()
  .refine(
    (data) => new Date(data.periodStart) < new Date(data.periodEnd),
    { message: 'Period start must be before period end', path: ['periodStart'] },
  );

export const listReportsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(50).default(10),
    reportType: z.enum(REPORT_TYPES).optional(),
  })
  .strict();

export const deleteReportSchema = z
  .object({
    id: z.string().cuid2(),
  })
  .strict();

export const getReportSchema = z
  .object({
    id: z.string().cuid2(),
  })
  .strict();

export const cogsSummarySchema = z
  .object({
    days: z.number().int().positive().max(365).default(30),
  })
  .strict();

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
export type ListReportsInput = z.infer<typeof listReportsSchema>;
export type DeleteReportInput = z.infer<typeof deleteReportSchema>;
export type GetReportInput = z.infer<typeof getReportSchema>;
export type CogsSummaryInput = z.infer<typeof cogsSummarySchema>;
