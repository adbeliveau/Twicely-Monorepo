import { describe, it, expect } from 'vitest';
import { resolveCtaRouting } from '../cta-routing';

describe('CTA routing logic', () => {
  it('routes guest to /auth/signup', () => {
    const result = resolveCtaRouting({ isAuthenticated: false, isSeller: false, sellerType: null });
    expect(result.ctaHref).toBe('/auth/signup');
    expect(result.ctaLabel).toBe('Sign up and start selling');
  });

  it('provides log in secondary CTA for guests', () => {
    const result = resolveCtaRouting({ isAuthenticated: false, isSeller: false, sellerType: null });
    expect(result.secondaryCtaHref).toBe('/auth/login');
    expect(result.secondaryCtaLabel).toBe('Log in');
  });

  it('routes authenticated non-seller to /my/selling/listings/new', () => {
    const result = resolveCtaRouting({ isAuthenticated: true, isSeller: false, sellerType: null });
    expect(result.ctaHref).toBe('/my/selling/listings/new');
    expect(result.ctaLabel).toBe('Create your first listing');
  });

  it('routes PERSONAL seller to /my/selling/listings', () => {
    const result = resolveCtaRouting({ isAuthenticated: true, isSeller: true, sellerType: 'PERSONAL' });
    expect(result.ctaHref).toBe('/my/selling/listings');
    expect(result.ctaLabel).toBe('Go to my listings');
  });

  it('routes BUSINESS seller to /my/selling', () => {
    const result = resolveCtaRouting({ isAuthenticated: true, isSeller: true, sellerType: 'BUSINESS' });
    expect(result.ctaHref).toBe('/my/selling');
    expect(result.ctaLabel).toBe('Go to selling dashboard');
  });

  it('does not show upgrade subscription CTA for guests', () => {
    const result = resolveCtaRouting({ isAuthenticated: false, isSeller: false, sellerType: null });
    expect(result.showUpgradeCta).toBe(false);
    expect(result.isBusinessSeller).toBe(false);
  });

  it('does not show upgrade subscription CTA for non-sellers', () => {
    const result = resolveCtaRouting({ isAuthenticated: true, isSeller: false, sellerType: null });
    expect(result.showUpgradeCta).toBe(false);
    expect(result.isBusinessSeller).toBe(false);
  });

  it('shows upgrade subscription CTA for BUSINESS sellers linking to /my/selling/subscription', () => {
    const result = resolveCtaRouting({ isAuthenticated: true, isSeller: true, sellerType: 'BUSINESS' });
    expect(result.showUpgradeCta).toBe(true);
    expect(result.isBusinessSeller).toBe(true);
  });

  it('does not show upgrade subscription CTA for PERSONAL sellers', () => {
    const result = resolveCtaRouting({ isAuthenticated: true, isSeller: true, sellerType: 'PERSONAL' });
    expect(result.showUpgradeCta).toBe(false);
    expect(result.isBusinessSeller).toBe(false);
  });

  it('routes seller with null sellerType (orphaned profile) to /my/selling/listings like PERSONAL', () => {
    // isSeller=true but sellerType=null — falls through to the final return block
    const result = resolveCtaRouting({ isAuthenticated: true, isSeller: true, sellerType: null });
    expect(result.ctaHref).toBe('/my/selling/listings');
    expect(result.ctaLabel).toBe('Go to my listings');
    expect(result.isBusinessSeller).toBe(false);
    expect(result.showUpgradeCta).toBe(false);
  });

  it('authenticated states have no secondary CTA', () => {
    const nonSeller = resolveCtaRouting({ isAuthenticated: true, isSeller: false, sellerType: null });
    expect(nonSeller.secondaryCtaHref).toBeUndefined();
    expect(nonSeller.secondaryCtaLabel).toBeUndefined();

    const personal = resolveCtaRouting({ isAuthenticated: true, isSeller: true, sellerType: 'PERSONAL' });
    expect(personal.secondaryCtaHref).toBeUndefined();
    expect(personal.secondaryCtaLabel).toBeUndefined();

    const business = resolveCtaRouting({ isAuthenticated: true, isSeller: true, sellerType: 'BUSINESS' });
    expect(business.secondaryCtaHref).toBeUndefined();
    expect(business.secondaryCtaLabel).toBeUndefined();
  });

  it('full result shape for guest contains all required fields', () => {
    const result = resolveCtaRouting({ isAuthenticated: false, isSeller: false, sellerType: null });
    expect(result).toMatchObject({
      ctaLabel: expect.any(String),
      ctaHref: expect.any(String),
      secondaryCtaLabel: expect.any(String),
      secondaryCtaHref: expect.any(String),
      isSeller: false,
      isBusinessSeller: false,
      showUpgradeCta: false,
    });
  });
});
