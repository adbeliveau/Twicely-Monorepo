import { describe, it, expect } from 'vitest';

describe('SocialLinks Component Logic', () => {
  // Platform config matching
  const PLATFORM_CONFIG: Record<string, { label: string }> = {
    instagram: { label: 'Instagram' },
    twitter: { label: 'Twitter' },
    youtube: { label: 'YouTube' },
    facebook: { label: 'Facebook' },
    tiktok: { label: 'TikTok' },
    website: { label: 'Website' },
  };

  function getPlatformLabel(platform: string): string {
    return PLATFORM_CONFIG[platform.toLowerCase()]?.label ?? platform;
  }

  it('returns correct label for known platforms', () => {
    expect(getPlatformLabel('instagram')).toBe('Instagram');
    expect(getPlatformLabel('twitter')).toBe('Twitter');
    expect(getPlatformLabel('youtube')).toBe('YouTube');
    expect(getPlatformLabel('facebook')).toBe('Facebook');
    expect(getPlatformLabel('website')).toBe('Website');
  });

  it('handles case insensitive platform names', () => {
    expect(getPlatformLabel('INSTAGRAM')).toBe('Instagram');
    expect(getPlatformLabel('Twitter')).toBe('Twitter');
    expect(getPlatformLabel('YOUTUBE')).toBe('YouTube');
  });

  it('returns platform name for unknown platforms', () => {
    expect(getPlatformLabel('poshmark')).toBe('poshmark');
    expect(getPlatformLabel('depop')).toBe('depop');
    expect(getPlatformLabel('custom')).toBe('custom');
  });

  // Link filtering logic
  function filterValidLinks(links: Record<string, string>): [string, string][] {
    return Object.entries(links).filter(([, url]) => url && url.trim());
  }

  it('filters out empty string values', () => {
    const links = {
      instagram: 'https://instagram.com/test',
      twitter: '',
      youtube: '   ',
      facebook: 'https://facebook.com/test',
    };

    const result = filterValidLinks(links);
    expect(result).toHaveLength(2);
    expect(result.map(([key]) => key)).toEqual(['instagram', 'facebook']);
  });

  it('returns empty array for empty links object', () => {
    expect(filterValidLinks({})).toEqual([]);
  });

  it('returns all entries when all have valid URLs', () => {
    const links = {
      instagram: 'https://instagram.com/test',
      twitter: 'https://twitter.com/test',
    };

    const result = filterValidLinks(links);
    expect(result).toHaveLength(2);
  });
});
