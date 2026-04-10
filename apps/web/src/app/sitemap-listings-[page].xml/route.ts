import { generateListingSitemap } from '@twicely/commerce/seo/sitemap';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const match = url.pathname.match(/sitemap-listings-(\d+)\.xml/);
  const page = match ? parseInt(match[1]!, 10) : NaN;

  if (isNaN(page) || page < 1) {
    return new Response('Not Found', { status: 404 });
  }

  const xml = await generateListingSitemap(page);
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
