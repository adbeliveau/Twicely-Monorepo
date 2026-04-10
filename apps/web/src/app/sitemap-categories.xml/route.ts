import { generateCategorySitemap } from '@twicely/commerce/seo/sitemap';

export async function GET(): Promise<Response> {
  const xml = await generateCategorySitemap();
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
