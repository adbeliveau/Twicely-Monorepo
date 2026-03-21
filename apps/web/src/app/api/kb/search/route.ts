import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@twicely/auth';
import { searchKbArticles } from '@/lib/queries/kb-articles';
import { kbSearchSchema } from '@/lib/validations/helpdesk';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') ?? '';
  const categorySlug = searchParams.get('category') ?? undefined;
  const limitRaw = searchParams.get('limit');
  const limitParsed = limitRaw ? parseInt(limitRaw, 10) : 20;

  const parsed = kbSearchSchema.safeParse({
    q,
    categorySlug,
    limit: Number.isNaN(limitParsed) ? 20 : limitParsed,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  // Determine audience from session
  let userAudience: 'ALL' | 'BUYER' | 'SELLER' | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) {
      userAudience = session.user.isSeller ? 'SELLER' : 'BUYER';
    } else {
      userAudience = null;
    }
  } catch {
    userAudience = null;
  }

  const articles = await searchKbArticles(
    parsed.data.q,
    userAudience,
    parsed.data.categorySlug,
    parsed.data.limit
  );

  return NextResponse.json({ success: true, articles });
}
