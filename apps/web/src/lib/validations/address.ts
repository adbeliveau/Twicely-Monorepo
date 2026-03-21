import { z } from 'zod';

/**
 * US states for dropdown selection.
 */
export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
] as const;

const stateValues = US_STATES.map((s) => s.value);

/**
 * Zod schema for address form validation.
 */
export const addressSchema = z.object({
  label: z.string().max(50, 'Label must be 50 characters or less').optional(),
  name: z
    .string()
    .min(1, 'Full name is required')
    .max(100, 'Name must be 100 characters or less'),
  address1: z
    .string()
    .min(1, 'Street address is required')
    .max(200, 'Address must be 200 characters or less'),
  address2: z.string().max(200, 'Apt/Suite must be 200 characters or less').optional(),
  city: z
    .string()
    .min(1, 'City is required')
    .max(100, 'City must be 100 characters or less'),
  state: z
    .string()
    .min(1, 'State is required')
    .refine((val) => stateValues.includes(val as (typeof stateValues)[number]), {
      message: 'Please select a valid state',
    }),
  zip: z
    .string()
    .min(1, 'ZIP code is required')
    .regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)'),
  country: z.string().min(1),
  phone: z
    .string()
    .regex(/^(\+1)?[\d\s\-().]{10,}$/, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
  isDefault: z.boolean().optional(),
}).strict();

export type AddressFormData = z.infer<typeof addressSchema>;

/**
 * Zod schema for shipping address JSON stored on orders.
 */
export const shippingAddressJsonSchema = z.object({
  name: z.string(),
  address1: z.string(),
  address2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string(),
  phone: z.string().nullable(),
}).strict();

export type ShippingAddressJson = z.infer<typeof shippingAddressJsonSchema>;
