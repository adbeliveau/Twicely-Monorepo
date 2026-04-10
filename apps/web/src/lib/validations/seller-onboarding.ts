import { z } from 'zod';

const US_STATE_CODES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','PR','VI','GU','AS','MP',
] as const;

export const RESERVED_STORE_SLUGS = [
  'admin', 'api', 'help', 'support', 'about', 'settings', 'auth',
  'checkout', 'cart', 'search', 'pricing', 'twicely', 'staff', 'hub',
  'my', 'app', 'static', 'public', 'assets', 'images',
] as const;

function isDigits(value: string, length: number): boolean {
  return value.length === length && Array.from(value).every((char) => char >= '0' && char <= '9');
}

function isEin(value: string): boolean {
  const parts = value.split('-');
  return parts.length === 2 && isDigits(parts[0] ?? '', 2) && isDigits(parts[1] ?? '', 7);
}

function isZipCode(value: string): boolean {
  const parts = value.split('-');
  return (
    (parts.length === 1 && isDigits(parts[0] ?? '', 5)) ||
    (parts.length === 2 && isDigits(parts[0] ?? '', 5) && isDigits(parts[1] ?? '', 4))
  );
}

function isStoreSlug(value: string): boolean {
  return Array.from(value).every(
    (char) => (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === '-',
  );
}

export const businessInfoSchema = z.object({
  businessName: z.string().min(2).max(100),
  businessType: z.enum(['SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP']),
  ein: z.string().refine(isEin).optional().or(z.literal('')),
  address1: z.string().min(1).max(200),
  address2: z.string().max(200).optional().or(z.literal('')),
  city: z.string().min(1).max(100),
  state: z.enum(US_STATE_CODES),
  zip: z.string().refine(isZipCode),
  country: z.string().default('US'),
  phone: z.string().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
}).strict();

export const storeNameSchema = z.object({
  storeName: z.string().min(2).max(50),
  storeSlug: z.string().min(2).max(30)
    .refine(isStoreSlug, 'Store URL must contain only lowercase letters, numbers, and hyphens')
    .refine((slug) => !RESERVED_STORE_SLUGS.includes(slug as typeof RESERVED_STORE_SLUGS[number]), {
      message: 'This store URL is reserved',
    }),
}).strict();

export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;
export type StoreNameInput = z.infer<typeof storeNameSchema>;
