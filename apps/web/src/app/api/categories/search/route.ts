import { NextRequest, NextResponse } from 'next/server';
import { searchCategories } from '@/lib/queries/category-search';
import { logger } from '@twicely/logger';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') ?? '';

  try {
    const categories = await searchCategories(query);
    return NextResponse.json({ categories });
  } catch (error) {
    logger.error('Category search error', { error });
    return NextResponse.json(
      { error: 'Failed to search categories' },
      { status: 500 }
    );
  }
}
