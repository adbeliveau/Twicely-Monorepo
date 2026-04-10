import { describe, it, expect } from 'vitest';
import { buildSitemapXml, buildSitemapIndexXml } from '../sitemap';
import type { SitemapUrl, SitemapIndexEntry } from '../sitemap';

describe('buildSitemapXml', () => {
  it('produces valid XML with xml header and urlset root', () => {
    const urls: SitemapUrl[] = [
      { loc: 'https://twicely.co/', changefreq: 'daily', priority: 1.0 },
      { loc: 'https://twicely.co/c/shoes', lastmod: '2026-01-15', changefreq: 'weekly', priority: 0.7 },
    ];
    const xml = buildSitemapXml(urls);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://twicely.co/</loc>');
    expect(xml).toContain('<changefreq>daily</changefreq>');
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml).toContain('<lastmod>2026-01-15</lastmod>');
    expect(xml).toContain('</urlset>');
  });

  it('escapes XML special characters in URLs', () => {
    const urls: SitemapUrl[] = [
      { loc: 'https://twicely.co/s?q=shoes&brand=Nike' },
    ];
    const xml = buildSitemapXml(urls);
    expect(xml).toContain('&amp;');
    expect(xml).not.toContain('&brand');
  });

  it('handles empty URL list', () => {
    const xml = buildSitemapXml([]);
    expect(xml).toContain('<urlset');
    expect(xml).toContain('</urlset>');
  });

  it('omits optional fields when not provided', () => {
    const urls: SitemapUrl[] = [{ loc: 'https://twicely.co/' }];
    const xml = buildSitemapXml(urls);
    expect(xml).not.toContain('<lastmod>');
    expect(xml).not.toContain('<changefreq>');
    expect(xml).not.toContain('<priority>');
  });
});

describe('buildSitemapIndexXml', () => {
  it('produces valid sitemap index XML', () => {
    const sitemaps: SitemapIndexEntry[] = [
      { loc: 'https://twicely.co/sitemap-static.xml', lastmod: '2026-01-15' },
      { loc: 'https://twicely.co/sitemap-listings-1.xml' },
    ];
    const xml = buildSitemapIndexXml(sitemaps);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://twicely.co/sitemap-static.xml</loc>');
    expect(xml).toContain('<lastmod>2026-01-15</lastmod>');
    expect(xml).toContain('</sitemapindex>');
  });
});
