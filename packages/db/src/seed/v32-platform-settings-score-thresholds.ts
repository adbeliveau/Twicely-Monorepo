/**
 * v3.2 Platform Settings — Seller Score Category-Adjusted Thresholds (Section 11.4)
 * Split from v32-platform-settings-extended.ts to keep both files under the 300-line limit.
 */

import type { PlatformSettingSeed } from './v32-platform-settings';

export const V32_SCORE_THRESHOLD_SETTINGS: PlatformSettingSeed[] = [
  // Category-Adjusted Thresholds (Section 11.4) — ELECTRONICS
  { key: 'score.threshold.ELECTRONICS.onTimeShipping.ideal', value: 0.95, type: 'number', category: 'trust', description: 'Ideal on-time shipping rate for ELECTRONICS sellers' },
  { key: 'score.threshold.ELECTRONICS.onTimeShipping.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for on-time shipping (ELECTRONICS)' },
  { key: 'score.threshold.ELECTRONICS.inadRate.ideal', value: 0.015, type: 'number', category: 'trust', description: 'Ideal INAD claim rate for ELECTRONICS sellers' },
  { key: 'score.threshold.ELECTRONICS.inadRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for INAD rate (ELECTRONICS)' },
  { key: 'score.threshold.ELECTRONICS.responseTime.ideal', value: 4, type: 'number', category: 'trust', description: 'Ideal response time in hours for ELECTRONICS sellers' },
  { key: 'score.threshold.ELECTRONICS.responseTime.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for response time (ELECTRONICS)' },
  { key: 'score.threshold.ELECTRONICS.returnRate.ideal', value: 0.04, type: 'number', category: 'trust', description: 'Ideal return rate for ELECTRONICS sellers' },
  { key: 'score.threshold.ELECTRONICS.returnRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for return rate (ELECTRONICS)' },
  { key: 'score.threshold.ELECTRONICS.cancellationRate.ideal', value: 0.015, type: 'number', category: 'trust', description: 'Ideal cancellation rate for ELECTRONICS sellers' },
  { key: 'score.threshold.ELECTRONICS.cancellationRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for cancellation rate (ELECTRONICS)' },

  // Category-Adjusted Thresholds (Section 11.4) — APPAREL_ACCESSORIES
  { key: 'score.threshold.APPAREL_ACCESSORIES.onTimeShipping.ideal', value: 0.95, type: 'number', category: 'trust', description: 'Ideal on-time shipping rate for APPAREL_ACCESSORIES sellers' },
  { key: 'score.threshold.APPAREL_ACCESSORIES.onTimeShipping.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for on-time shipping (APPAREL_ACCESSORIES)' },
  { key: 'score.threshold.APPAREL_ACCESSORIES.inadRate.ideal', value: 0.02, type: 'number', category: 'trust', description: 'Ideal INAD claim rate for APPAREL_ACCESSORIES sellers' },
  { key: 'score.threshold.APPAREL_ACCESSORIES.inadRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for INAD rate (APPAREL_ACCESSORIES)' },
  { key: 'score.threshold.APPAREL_ACCESSORIES.responseTime.ideal', value: 8, type: 'number', category: 'trust', description: 'Ideal response time in hours for APPAREL_ACCESSORIES sellers' },
  { key: 'score.threshold.APPAREL_ACCESSORIES.responseTime.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for response time (APPAREL_ACCESSORIES)' },
  { key: 'score.threshold.APPAREL_ACCESSORIES.returnRate.ideal', value: 0.03, type: 'number', category: 'trust', description: 'Ideal return rate for APPAREL_ACCESSORIES sellers' },
  { key: 'score.threshold.APPAREL_ACCESSORIES.returnRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for return rate (APPAREL_ACCESSORIES)' },
  { key: 'score.threshold.APPAREL_ACCESSORIES.cancellationRate.ideal', value: 0.015, type: 'number', category: 'trust', description: 'Ideal cancellation rate for APPAREL_ACCESSORIES sellers' },
  { key: 'score.threshold.APPAREL_ACCESSORIES.cancellationRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for cancellation rate (APPAREL_ACCESSORIES)' },

  // Category-Adjusted Thresholds (Section 11.4) — HOME_GENERAL
  { key: 'score.threshold.HOME_GENERAL.onTimeShipping.ideal', value: 0.95, type: 'number', category: 'trust', description: 'Ideal on-time shipping rate for HOME_GENERAL sellers' },
  { key: 'score.threshold.HOME_GENERAL.onTimeShipping.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for on-time shipping (HOME_GENERAL)' },
  { key: 'score.threshold.HOME_GENERAL.inadRate.ideal', value: 0.02, type: 'number', category: 'trust', description: 'Ideal INAD claim rate for HOME_GENERAL sellers' },
  { key: 'score.threshold.HOME_GENERAL.inadRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for INAD rate (HOME_GENERAL)' },
  { key: 'score.threshold.HOME_GENERAL.responseTime.ideal', value: 8, type: 'number', category: 'trust', description: 'Ideal response time in hours for HOME_GENERAL sellers' },
  { key: 'score.threshold.HOME_GENERAL.responseTime.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for response time (HOME_GENERAL)' },
  { key: 'score.threshold.HOME_GENERAL.returnRate.ideal', value: 0.03, type: 'number', category: 'trust', description: 'Ideal return rate for HOME_GENERAL sellers' },
  { key: 'score.threshold.HOME_GENERAL.returnRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for return rate (HOME_GENERAL)' },
  { key: 'score.threshold.HOME_GENERAL.cancellationRate.ideal', value: 0.015, type: 'number', category: 'trust', description: 'Ideal cancellation rate for HOME_GENERAL sellers' },
  { key: 'score.threshold.HOME_GENERAL.cancellationRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for cancellation rate (HOME_GENERAL)' },

  // Category-Adjusted Thresholds (Section 11.4) — COLLECTIBLES_LUXURY
  { key: 'score.threshold.COLLECTIBLES_LUXURY.onTimeShipping.ideal', value: 0.90, type: 'number', category: 'trust', description: 'Ideal on-time shipping rate for COLLECTIBLES_LUXURY sellers' },
  { key: 'score.threshold.COLLECTIBLES_LUXURY.onTimeShipping.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for on-time shipping (COLLECTIBLES_LUXURY)' },
  { key: 'score.threshold.COLLECTIBLES_LUXURY.inadRate.ideal', value: 0.01, type: 'number', category: 'trust', description: 'Ideal INAD claim rate for COLLECTIBLES_LUXURY sellers' },
  { key: 'score.threshold.COLLECTIBLES_LUXURY.inadRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for INAD rate (COLLECTIBLES_LUXURY)' },
  { key: 'score.threshold.COLLECTIBLES_LUXURY.responseTime.ideal', value: 4, type: 'number', category: 'trust', description: 'Ideal response time in hours for COLLECTIBLES_LUXURY sellers' },
  { key: 'score.threshold.COLLECTIBLES_LUXURY.responseTime.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for response time (COLLECTIBLES_LUXURY)' },
  { key: 'score.threshold.COLLECTIBLES_LUXURY.returnRate.ideal', value: 0.02, type: 'number', category: 'trust', description: 'Ideal return rate for COLLECTIBLES_LUXURY sellers' },
  { key: 'score.threshold.COLLECTIBLES_LUXURY.returnRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for return rate (COLLECTIBLES_LUXURY)' },
  { key: 'score.threshold.COLLECTIBLES_LUXURY.cancellationRate.ideal', value: 0.01, type: 'number', category: 'trust', description: 'Ideal cancellation rate for COLLECTIBLES_LUXURY sellers' },
  { key: 'score.threshold.COLLECTIBLES_LUXURY.cancellationRate.steepness', value: 10, type: 'number', category: 'trust', description: 'Sigmoid steepness for cancellation rate (COLLECTIBLES_LUXURY)' },
];
