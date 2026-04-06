import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/i/', '/c/', '/st/', '/s', '/explore', '/pricing', '/p/', '/h/'],
        disallow: [
          '/api/',
          '/my/',
          '/checkout/',
          '/auth/',
          '/d/',
          '/hd/',
          '/fin/',
          '/mod/',
          '/usr/',
          '/cfg/',
          '/tx/',
          '/roles/',
          '/audit/',
          '/health/',
          '/flags/',
          '/login',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
