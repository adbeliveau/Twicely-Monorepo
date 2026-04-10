import { generateListingSitemap } from '@twicely/commerce/seo/sitemap';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> },
): Promise<Response> {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);

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
