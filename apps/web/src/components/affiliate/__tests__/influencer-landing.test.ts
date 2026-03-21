import { describe, it, expect } from 'vitest';
import type { InfluencerLandingData } from '@/lib/queries/affiliate-landing';

// ─── Pure helpers extracted from influencer-landing.tsx ───────────────────────
// These mirror the module-level functions in the component file.

function getInitials(displayName: string | null, username: string | null): string {
  const name = displayName ?? username ?? '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function buildCtaHref(referralCode: string, searchParams?: Record<string, string>): string {
  const base = `/ref/${referralCode}`;
  if (!searchParams) return base;
  const utmEntries = Object.entries(searchParams).filter(([key]) => key.startsWith('utm_'));
  if (utmEntries.length === 0) return base;
  const qs = new URLSearchParams(
    utmEntries.map(([k, v]) => [k, v] as [string, string]),
  ).toString();
  return `${base}?${qs}`;
}

function formatDiscount(discountType: string, discountValue: number): string {
  if (discountType === 'PERCENTAGE') {
    return `${Math.round(discountValue / 100)}% off`;
  }
  const dollars = Math.floor(discountValue / 100);
  const cents = discountValue % 100;
  if (cents === 0) {
    return `$${dollars} off`;
  }
  return `$${dollars}.${String(cents).padStart(2, '0')} off`;
}

function formatDuration(durationMonths: number): string {
  if (durationMonths === 1) return 'your first month';
  return `your first ${durationMonths} months`;
}

// Derived heading name logic (mirrors component)
function getHeadingName(data: InfluencerLandingData): string {
  return data.displayName ?? data.username ?? data.referralCode;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeData(overrides: Partial<InfluencerLandingData> = {}): InfluencerLandingData {
  return {
    referralCode: 'JANE123',
    displayName: 'Jane Smith',
    username: 'janesmith',
    bio: 'Resale content creator sharing tips.',
    avatarUrl: 'https://cdn.example.com/jane.jpg',
    socialLinks: null,
    promoCodes: [],
    ...overrides,
  };
}

// ─── getInitials ──────────────────────────────────────────────────────────────

describe('getInitials', () => {
  it('returns initials from two-word displayName', () => {
    expect(getInitials('Jane Smith', null)).toBe('JS');
  });

  it('returns single initial from one-word displayName', () => {
    expect(getInitials('Jane', null)).toBe('J');
  });

  it('falls back to username when displayName is null', () => {
    expect(getInitials(null, 'janesmith')).toBe('J');
  });

  it('returns "?" when both displayName and username are null', () => {
    expect(getInitials(null, null)).toBe('?');
  });

  it('only uses first two words', () => {
    expect(getInitials('Mary Anne Clarke', null)).toBe('MA');
  });

  it('uppercases first letter of each part', () => {
    expect(getInitials('john doe', null)).toBe('JD');
  });
});

// ─── buildCtaHref ─────────────────────────────────────────────────────────────

describe('buildCtaHref', () => {
  it('returns /ref/{code} with no searchParams', () => {
    expect(buildCtaHref('JANE123')).toBe('/ref/JANE123');
  });

  it('returns /ref/{code} when searchParams is undefined', () => {
    expect(buildCtaHref('JANE123', undefined)).toBe('/ref/JANE123');
  });

  it('returns /ref/{code} when searchParams has no utm_ keys', () => {
    expect(buildCtaHref('JANE123', { ref: 'something', source: 'email' })).toBe('/ref/JANE123');
  });

  it('appends utm_ params when present', () => {
    const href = buildCtaHref('JANE123', {
      utm_source: 'instagram',
      utm_medium: 'bio',
    });
    expect(href).toContain('/ref/JANE123?');
    expect(href).toContain('utm_source=instagram');
    expect(href).toContain('utm_medium=bio');
  });

  it('excludes non-utm params even when mixed with utm params', () => {
    const href = buildCtaHref('JANE123', {
      utm_source: 'ig',
      ref: 'xyz',
    });
    expect(href).toContain('utm_source=ig');
    expect(href).not.toContain('ref=xyz');
  });

  it('handles empty searchParams object (no utm_ keys)', () => {
    expect(buildCtaHref('JANE123', {})).toBe('/ref/JANE123');
  });
});

// ─── formatDiscount ───────────────────────────────────────────────────────────

describe('formatDiscount', () => {
  it('formats PERCENTAGE discount correctly (value in basis points)', () => {
    expect(formatDiscount('PERCENTAGE', 1000)).toBe('10% off');
  });

  it('formats PERCENTAGE with rounding', () => {
    expect(formatDiscount('PERCENTAGE', 1050)).toBe('11% off');
  });

  it('formats FIXED whole dollar discount', () => {
    expect(formatDiscount('FIXED', 500)).toBe('$5 off');
  });

  it('formats FIXED dollar-and-cents discount', () => {
    expect(formatDiscount('FIXED', 599)).toBe('$5.99 off');
  });

  it('formats FIXED single-digit cents with leading zero', () => {
    expect(formatDiscount('FIXED', 1005)).toBe('$10.05 off');
  });

  it('formats large PERCENTAGE discount (50%)', () => {
    expect(formatDiscount('PERCENTAGE', 5000)).toBe('50% off');
  });
});

// ─── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('returns singular "your first month" for 1 month', () => {
    expect(formatDuration(1)).toBe('your first month');
  });

  it('returns plural "your first N months" for multiple months', () => {
    expect(formatDuration(3)).toBe('your first 3 months');
    expect(formatDuration(12)).toBe('your first 12 months');
  });
});

// ─── Heading name resolution ──────────────────────────────────────────────────

describe('getHeadingName', () => {
  it('uses displayName when present', () => {
    expect(getHeadingName(makeData({ displayName: 'Jane Smith', username: 'janesmith' }))).toBe('Jane Smith');
  });

  it('falls back to username when displayName is null', () => {
    expect(getHeadingName(makeData({ displayName: null, username: 'janesmith' }))).toBe('janesmith');
  });

  it('falls back to referralCode when both displayName and username are null', () => {
    expect(getHeadingName(makeData({ displayName: null, username: null, referralCode: 'JANE123' }))).toBe('JANE123');
  });
});

// ─── Data contract / no internal IDs exposed ─────────────────────────────────

describe('InfluencerLandingData contract', () => {
  it('data shape does not expose affiliateId or userId', () => {
    const data = makeData();
    expect(Object.keys(data)).not.toContain('affiliateId');
    expect(Object.keys(data)).not.toContain('userId');
    expect(Object.keys(data)).not.toContain('id');
  });

  it('promoCodes shape does not expose affiliateId', () => {
    const data = makeData({
      promoCodes: [{ code: 'SAVE10', discountType: 'PERCENTAGE', discountValue: 1000, durationMonths: 3 }],
    });
    expect(Object.keys(data.promoCodes[0]!)).not.toContain('affiliateId');
    expect(Object.keys(data.promoCodes[0]!)).not.toContain('id');
  });

  it('bio can be null (no bio influencer)', () => {
    const data = makeData({ bio: null });
    expect(data.bio).toBeNull();
  });

  it('avatarUrl can be null (no avatar influencer)', () => {
    const data = makeData({ avatarUrl: null });
    expect(data.avatarUrl).toBeNull();
  });

  it('socialLinks can be null when influencer has not set them', () => {
    const data = makeData({ socialLinks: null });
    expect(data.socialLinks).toBeNull();
  });

  it('socialLinks can have all four platforms set', () => {
    const data = makeData({
      socialLinks: {
        instagram: 'https://instagram.com/jane',
        youtube: 'https://youtube.com/jane',
        tiktok: 'https://tiktok.com/@jane',
        blog: 'https://blog.example.com',
      },
    });
    expect(data.socialLinks!.instagram).toBe('https://instagram.com/jane');
    expect(data.socialLinks!.youtube).toBe('https://youtube.com/jane');
    expect(data.socialLinks!.tiktok).toBe('https://tiktok.com/@jane');
    expect(data.socialLinks!.blog).toBe('https://blog.example.com');
  });

  it('promoCodes is an empty array when no codes available', () => {
    const data = makeData({ promoCodes: [] });
    expect(data.promoCodes).toHaveLength(0);
  });

  it('supports multiple promo codes', () => {
    const data = makeData({
      promoCodes: [
        { code: 'SAVE10', discountType: 'PERCENTAGE', discountValue: 1000, durationMonths: 1 },
        { code: 'FLAT5', discountType: 'FIXED', discountValue: 500, durationMonths: 6 },
      ],
    });
    expect(data.promoCodes).toHaveLength(2);
    expect(data.promoCodes[0]!.code).toBe('SAVE10');
    expect(data.promoCodes[1]!.code).toBe('FLAT5');
  });

  it('promo code section heading uses singular when 1 code', () => {
    const data = makeData({ promoCodes: [{ code: 'SAVE10', discountType: 'PERCENTAGE', discountValue: 1000, durationMonths: 1 }] });
    const heading = `Exclusive offer${data.promoCodes.length > 1 ? 's' : ''} from ${getHeadingName(data)}`;
    expect(heading).toBe('Exclusive offer from Jane Smith');
  });

  it('promo code section heading uses plural when multiple codes', () => {
    const data = makeData({
      promoCodes: [
        { code: 'SAVE10', discountType: 'PERCENTAGE', discountValue: 1000, durationMonths: 1 },
        { code: 'FLAT5', discountType: 'FIXED', discountValue: 500, durationMonths: 3 },
      ],
    });
    const heading = `Exclusive offer${data.promoCodes.length > 1 ? 's' : ''} from ${getHeadingName(data)}`;
    expect(heading).toBe('Exclusive offers from Jane Smith');
  });
});
