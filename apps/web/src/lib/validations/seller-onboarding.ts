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

export const businessInfoSchema = z.object({
  businessName: z.string().min(2).max(100),
  businessType: z.enum(['SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP']),
  ein: z.string().regex(/^\d{2}-\d{7}$/).optional().or(z.literal('')),
  address1: z.string().min(1).max(200),
  address2: z.string().max(200).optional().or(z.literal('')),
  city: z.string().min(1).max(100),
  state: z.enum(US_STATE_CODES),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().default('US'),
  phone: z.string().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
}).strict();

export const storeNameSchema = z.object({
  storeName: z.string().min(2).max(50),
  storeSlug: z.string().min(2).max(30)
    .regex(/^[a-z0-9-]+$/, 'Store URL must contain only lowercase letters, numbers, and hyphens')
    .refine((slug) => !RESERVED_STORE_SLUGS.includes(slug as typeof RESERVED_STORE_SLUGS[number]), {
      message: 'This store URL is reserved',
    }),
}).strict();

export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;
export type StoreNameInput = z.infer<typeof storeNameSchema>;
