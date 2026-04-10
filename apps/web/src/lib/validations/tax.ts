/**
 * Zod validation schemas for tax info input
 * G5.1 — Tax info collection
 */

import { z } from 'zod';

/** Strip dashes and spaces, validate raw digit count */
function sanitizeTaxId(val: string): string {
  return val.replace(/[-\s]/g, '');
}

const taxIdRefinement = (val: string): boolean => /^\d{9}$/.test(sanitizeTaxId(val));
const itinRefinement = (val: string): boolean => {
  const clean = sanitizeTaxId(val);
  return /^\d{9}$/.test(clean) && clean.startsWith('9');
};

const US_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','PR','VI','GU','MP','AS','FM','MH','PW',
]);

function isZipCode(value: string): boolean {
  const parts = value.split('-');
  const isDigits = (part: string, length: number) =>
    part.length === length && Array.from(part).every((char) => char >= '0' && char <= '9');

  return (
    (parts.length === 1 && isDigits(parts[0] ?? '', 5)) ||
    (parts.length === 2 && isDigits(parts[0] ?? '', 5) && isDigits(parts[1] ?? '', 4))
  );
}

export const taxInfoSchema = z.object({
  taxIdType: z.enum(['SSN', 'EIN', 'ITIN']),
  taxId: z.string()
    .min(1, 'Tax ID is required')
    .refine((val) => {
      // We validate per-type in the superRefine below; here just check non-empty
      return val.length > 0;
    }, 'Tax ID is required'),
  legalName: z.string().min(1, 'Legal name is required').max(200),
  businessName: z.string().max(200).optional(),
  address1: z.string().min(1, 'Address is required').max(200),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().refine((val) => US_STATE_CODES.has(val.toUpperCase()), {
    message: 'Invalid US state code',
  }),
  zip: z.string().refine(isZipCode, 'Invalid ZIP code format'),
  country: z.string().default('US'),
}).strict().superRefine((data, ctx) => {
  const clean = sanitizeTaxId(data.taxId);
  if (data.taxIdType === 'SSN') {
    if (!taxIdRefinement(data.taxId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SSN must be 9 digits',
        path: ['taxId'],
      });
    }
  } else if (data.taxIdType === 'EIN') {
    if (!taxIdRefinement(data.taxId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'EIN must be 9 digits',
        path: ['taxId'],
      });
    }
  } else if (data.taxIdType === 'ITIN') {
    if (!itinRefinement(data.taxId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ITIN must be 9 digits and start with 9',
        path: ['taxId'],
      });
    }
  }
  // Clean value returned via transform — used in action
  void clean;
});

export type TaxInfoInput = z.infer<typeof taxInfoSchema>;

/** Sanitize a raw tax ID string: strip dashes and spaces, return digits only */
export function sanitizeTaxIdInput(val: string): string {
  return val.replace(/[-\s]/g, '');
}
