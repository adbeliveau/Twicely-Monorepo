import { describe, it, expect } from 'vitest';
import { generateRobotsTxt } from '../robots';

describe('generateRobotsTxt', () => {
  const baseUrl = 'https://twicely.co';
  const crawlDelay = 1;
  const txt = generateRobotsTxt(baseUrl, crawlDelay);

  it('allows root path', () => {
    expect(txt).toContain('Allow: /');
  });

  it('blocks /api/', () => {
    expect(txt).toContain('Disallow: /api/');
  });

  it('blocks /my/', () => {
    expect(txt).toContain('Disallow: /my/');
  });

  it('blocks /auth/', () => {
    expect(txt).toContain('Disallow: /auth/');
  });

  it('blocks /checkout/', () => {
    expect(txt).toContain('Disallow: /checkout/');
  });

  it('blocks /cart/', () => {
    expect(txt).toContain('Disallow: /cart/');
  });

  it('blocks hub routes', () => {
    expect(txt).toContain('Disallow: /d/');
    expect(txt).toContain('Disallow: /usr/');
    expect(txt).toContain('Disallow: /tx/');
    expect(txt).toContain('Disallow: /fin/');
    expect(txt).toContain('Disallow: /mod/');
    expect(txt).toContain('Disallow: /hd/');
    expect(txt).toContain('Disallow: /cfg/');
    expect(txt).toContain('Disallow: /roles/');
    expect(txt).toContain('Disallow: /audit/');
    expect(txt).toContain('Disallow: /health/');
    expect(txt).toContain('Disallow: /flags/');
    expect(txt).toContain('Disallow: /analytics/');
  });

  it('includes Sitemap directive', () => {
    expect(txt).toContain('Sitemap: https://twicely.co/sitemap.xml');
  });

  it('includes Crawl-delay', () => {
    expect(txt).toContain('Crawl-delay: 1');
  });

  it('uses configurable crawl delay', () => {
    const custom = generateRobotsTxt('https://example.com', 5);
    expect(custom).toContain('Crawl-delay: 5');
    expect(custom).toContain('Sitemap: https://example.com/sitemap.xml');
  });
});
