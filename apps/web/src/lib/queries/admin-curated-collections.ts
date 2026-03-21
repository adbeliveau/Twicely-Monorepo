import { db } from '@twicely/db';
import {
  curatedCollection,
  curatedCollectionItem,
  listing,
  listingImage,
  user,
} from '@twicely/db/schema';
import { eq, and, sql, isNotNull, asc, notInArray, ilike } from 'drizzle-orm';

export type AdminCollectionRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  startDate: Date | null;
  endDate: Date | null;
  sortOrder: number;
  itemCount: number;
  curatedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminCollectionItemRow = {
  id: string;
  listingId: string;
  listingTitle: string | null;
  listingSlug: string | null;
  listingPriceCents: number | null;
  listingStatus: string;
  primaryImageUrl: string | null;
  sortOrder: number;
  addedByName: string | null;
  createdAt: Date;
};

export type AdminCollectionDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  startDate: Date | null;
  endDate: Date | null;
  sortOrder: number;
  curatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  items: AdminCollectionItemRow[];
};

function buildFilterCondition(filter?: 'all' | 'published' | 'draft' | 'seasonal') {
  if (filter === 'published') return eq(curatedCollection.isPublished, true);
  if (filter === 'draft') return eq(curatedCollection.isPublished, false);
  if (filter === 'seasonal') {
    return and(isNotNull(curatedCollection.startDate), isNotNull(curatedCollection.endDate));
  }
  return undefined;
}

export async function getAdminCollections(
  page: number,
  pageSize: number,
  filter?: 'all' | 'published' | 'draft' | 'seasonal',
): Promise<{ collections: AdminCollectionRow[]; total: number }> {
  const condition = buildFilterCondition(filter);

  const itemCountSubquery = db
    .select({
      collectionId: curatedCollectionItem.collectionId,
      itemCount: sql<number>`cast(count(*) as integer)`.as('item_count'),
    })
    .from(curatedCollectionItem)
    .groupBy(curatedCollectionItem.collectionId)
    .as('item_counts');

  const baseQuery = db
    .select({
      id: curatedCollection.id,
      title: curatedCollection.title,
      slug: curatedCollection.slug,
      description: curatedCollection.description,
      coverImageUrl: curatedCollection.coverImageUrl,
      isPublished: curatedCollection.isPublished,
      startDate: curatedCollection.startDate,
      endDate: curatedCollection.endDate,
      sortOrder: curatedCollection.sortOrder,
      itemCount: sql<number>`coalesce(${itemCountSubquery.itemCount}, 0)`,
      curatedByName: user.displayName,
      createdAt: curatedCollection.createdAt,
      updatedAt: curatedCollection.updatedAt,
    })
    .from(curatedCollection)
    .leftJoin(itemCountSubquery, eq(itemCountSubquery.collectionId, curatedCollection.id))
    .leftJoin(user, eq(user.id, curatedCollection.curatedBy));

  const rows = condition
    ? await baseQuery
        .where(condition)
        .orderBy(asc(curatedCollection.sortOrder), sql`${curatedCollection.createdAt} desc`)
        .limit(pageSize)
        .offset((page - 1) * pageSize)
    : await baseQuery
        .orderBy(asc(curatedCollection.sortOrder), sql`${curatedCollection.createdAt} desc`)
        .limit(pageSize)
        .offset((page - 1) * pageSize);

  const totalQuery = db.select({ count: sql<number>`cast(count(*) as integer)` }).from(curatedCollection);
  const totalRows = condition
    ? await totalQuery.where(condition)
    : await totalQuery;

  const total = totalRows[0]?.count ?? 0;
  return { collections: rows, total };
}

export async function getAdminCollectionById(
  collectionId: string,
): Promise<AdminCollectionDetail | null> {
  const collectionRows = await db
    .select({
      id: curatedCollection.id,
      title: curatedCollection.title,
      slug: curatedCollection.slug,
      description: curatedCollection.description,
      coverImageUrl: curatedCollection.coverImageUrl,
      isPublished: curatedCollection.isPublished,
      startDate: curatedCollection.startDate,
      endDate: curatedCollection.endDate,
      sortOrder: curatedCollection.sortOrder,
      curatedBy: curatedCollection.curatedBy,
      createdAt: curatedCollection.createdAt,
      updatedAt: curatedCollection.updatedAt,
    })
    .from(curatedCollection)
    .where(eq(curatedCollection.id, collectionId));

  if (collectionRows.length === 0) return null;
  const col = collectionRows[0]!;

  const itemRows = await db
    .select({
      id: curatedCollectionItem.id,
      listingId: curatedCollectionItem.listingId,
      listingTitle: listing.title,
      listingSlug: listing.slug,
      listingPriceCents: listing.priceCents,
      listingStatus: listing.status,
      primaryImageUrl: listingImage.url,
      sortOrder: curatedCollectionItem.sortOrder,
      addedByName: user.displayName,
      createdAt: curatedCollectionItem.createdAt,
    })
    .from(curatedCollectionItem)
    .innerJoin(listing, eq(curatedCollectionItem.listingId, listing.id))
    .leftJoin(listingImage, and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true)))
    .leftJoin(user, eq(user.id, curatedCollectionItem.addedBy))
    .where(eq(curatedCollectionItem.collectionId, collectionId))
    .orderBy(asc(curatedCollectionItem.sortOrder));

  return { ...col, items: itemRows };
}

export async function searchListingsForCollection(
  query: string,
  excludeListingIds: string[],
): Promise<{
  id: string;
  title: string | null;
  slug: string | null;
  priceCents: number | null;
  primaryImageUrl: string | null;
}[]> {
  const conditions = [
    eq(listing.status, 'ACTIVE'),
    ilike(listing.title, `%${query}%`),
  ];
  if (excludeListingIds.length > 0) {
    conditions.push(notInArray(listing.id, excludeListingIds));
  }

  return db
    .select({
      id: listing.id,
      title: listing.title,
      slug: listing.slug,
      priceCents: listing.priceCents,
      primaryImageUrl: listingImage.url,
    })
    .from(listing)
    .leftJoin(listingImage, and(eq(listingImage.listingId, listing.id), eq(listingImage.isPrimary, true)))
    .where(and(...conditions))
    .limit(20);
}
