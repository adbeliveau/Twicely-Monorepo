/**
 * Crosslister channel category mappings and policy rules seed data.
 * Source: Lister Canonical Sections 27.1, 27.2
 */

import { CATEGORY_IDS } from './seed-categories';

// Channel category mappings — 3 platforms, top-level Twicely categories.
// Demonstrates the mapping pattern; production mappings are a data migration.
export const CHANNEL_CATEGORY_MAPPINGS = [
  // eBay mappings
  {
    id: 'seed-ccm-ebay-apparel',
    channel: 'EBAY',
    twicelyCategoryId: CATEGORY_IDS.apparel,
    externalCategoryId: '11450',
    externalCategoryName: 'Clothing, Shoes & Accessories',
    confidence: 0.95,
    isVerified: true,
  },
  {
    id: 'seed-ccm-ebay-electronics',
    channel: 'EBAY',
    twicelyCategoryId: CATEGORY_IDS.electronics,
    externalCategoryId: '58058',
    externalCategoryName: 'Consumer Electronics',
    confidence: 0.95,
    isVerified: true,
  },
  {
    id: 'seed-ccm-ebay-collectibles',
    channel: 'EBAY',
    twicelyCategoryId: CATEGORY_IDS.collectibles,
    externalCategoryId: '1',
    externalCategoryName: 'Collectibles',
    confidence: 0.9,
    isVerified: true,
  },
  // Poshmark mappings
  {
    id: 'seed-ccm-poshmark-womens',
    channel: 'POSHMARK',
    twicelyCategoryId: CATEGORY_IDS.womens,
    externalCategoryId: 'category_women',
    externalCategoryName: "Women's Clothing",
    confidence: 0.95,
    isVerified: true,
  },
  {
    id: 'seed-ccm-poshmark-mens',
    channel: 'POSHMARK',
    twicelyCategoryId: CATEGORY_IDS.mens,
    externalCategoryId: 'category_men',
    externalCategoryName: "Men's Clothing",
    confidence: 0.95,
    isVerified: true,
  },
  {
    id: 'seed-ccm-poshmark-shoes',
    channel: 'POSHMARK',
    twicelyCategoryId: CATEGORY_IDS.shoes,
    externalCategoryId: 'category_shoes',
    externalCategoryName: 'Shoes',
    confidence: 0.95,
    isVerified: true,
  },
  // Mercari mappings
  {
    id: 'seed-ccm-mercari-electronics',
    channel: 'MERCARI',
    twicelyCategoryId: CATEGORY_IDS.electronics,
    externalCategoryId: 'mc_electronics',
    externalCategoryName: 'Electronics',
    confidence: 0.9,
    isVerified: true,
  },
  {
    id: 'seed-ccm-mercari-apparel',
    channel: 'MERCARI',
    twicelyCategoryId: CATEGORY_IDS.apparel,
    externalCategoryId: 'mc_clothing',
    externalCategoryName: 'Clothing & Shoes',
    confidence: 0.9,
    isVerified: true,
  },
  {
    id: 'seed-ccm-mercari-home',
    channel: 'MERCARI',
    twicelyCategoryId: CATEGORY_IDS.home,
    externalCategoryId: 'mc_home',
    externalCategoryName: 'Home & Living',
    confidence: 0.9,
    isVerified: true,
  },
] as const;

// Channel policy rules — 5 rules demonstrating the pattern
export const CHANNEL_POLICY_RULES = [
  {
    id: 'seed-cpr-ebay-title-length',
    channel: 'EBAY',
    field: 'title',
    constraintJson: { maxLength: 80 },
    guidance: 'eBay titles must be 80 characters or fewer.',
    severity: 'ERROR',
    isActive: true,
  },
  {
    id: 'seed-cpr-poshmark-min-photo',
    channel: 'POSHMARK',
    field: 'images',
    constraintJson: { minCount: 1 },
    guidance: 'Poshmark listings must have at least 1 photo.',
    severity: 'ERROR',
    isActive: true,
  },
  {
    id: 'seed-cpr-ebay-item-specifics',
    channel: 'EBAY',
    field: 'itemSpecifics',
    constraintJson: { required: ['Brand', 'Condition'] },
    guidance: 'eBay requires Brand and Condition item specifics.',
    severity: 'WARN',
    isActive: true,
  },
  {
    id: 'seed-cpr-mercari-no-ext-links',
    channel: 'MERCARI',
    field: 'description',
    constraintJson: { forbidPattern: 'https?://' },
    guidance: 'Mercari prohibits external links in descriptions.',
    severity: 'ERROR',
    isActive: true,
  },
  {
    id: 'seed-cpr-depop-image-max',
    channel: 'DEPOP',
    field: 'images',
    constraintJson: { maxCount: 4 },
    guidance: 'Depop supports a maximum of 4 images per listing.',
    severity: 'ERROR',
    isActive: true,
  },
] as const;
