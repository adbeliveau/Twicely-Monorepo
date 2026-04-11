'use server';

import {
  createAffiliatePromoCode as createAffiliatePromoCodeImpl,
  updateAffiliatePromoCode as updateAffiliatePromoCodeImpl,
  deleteAffiliatePromoCode as deleteAffiliatePromoCodeImpl,
} from './promo-codes-affiliate';
import {
  createPlatformPromoCode as createPlatformPromoCodeImpl,
  updatePlatformPromoCode as updatePlatformPromoCodeImpl,
  validatePromoCode as validatePromoCodeImpl,
} from './promo-codes-platform';

export async function createAffiliatePromoCode(input: unknown) {
  return createAffiliatePromoCodeImpl(input);
}

export async function updateAffiliatePromoCode(input: unknown) {
  return updateAffiliatePromoCodeImpl(input);
}

export async function deleteAffiliatePromoCode(id: string) {
  return deleteAffiliatePromoCodeImpl(id);
}

export async function createPlatformPromoCode(input: unknown) {
  return createPlatformPromoCodeImpl(input);
}

export async function updatePlatformPromoCode(input: unknown) {
  return updatePlatformPromoCodeImpl(input);
}

export async function validatePromoCode(input: unknown) {
  return validatePromoCodeImpl(input);
}
