import { db } from '@twicely/db';
import { orderItem, listingImage } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Fetch first item + thumbnail for a list of orders.
 *
 * Returns Maps for efficient lookup:
 * - firstItemMap: orderId → { title, listingId }
 * - itemCountMap: orderId → count
 * - imageMap: listingId → thumbnail URL
 */
export async function fetchOrderItemSummaries(orderIds: string[]): Promise<{
  firstItemMap: Map<string, { title: string; listingId: string }>;
  itemCountMap: Map<string, number>;
  imageMap: Map<string, string>;
}> {
  if (orderIds.length === 0) {
    return {
      firstItemMap: new Map(),
      itemCountMap: new Map(),
      imageMap: new Map(),
    };
  }

  // Get all items for these orders
  const items = await db
    .select({
      orderId: orderItem.orderId,
      title: orderItem.title,
      listingId: orderItem.listingId,
    })
    .from(orderItem)
    .where(inArray(orderItem.orderId, orderIds));

  // Group items by order and get first item
  const firstItemMap = new Map<string, { title: string; listingId: string }>();
  const itemCountMap = new Map<string, number>();

  for (const item of items) {
    if (!firstItemMap.has(item.orderId)) {
      firstItemMap.set(item.orderId, { title: item.title, listingId: item.listingId });
    }
    itemCountMap.set(item.orderId, (itemCountMap.get(item.orderId) ?? 0) + 1);
  }

  // Get thumbnails for first items
  const listingIds = Array.from(firstItemMap.values()).map((item) => item.listingId);
  const images =
    listingIds.length > 0
      ? await db
          .select({
            listingId: listingImage.listingId,
            url: listingImage.url,
          })
          .from(listingImage)
          .where(
            and(
              eq(listingImage.isPrimary, true),
              inArray(listingImage.listingId, listingIds)
            )
          )
      : [];

  const imageMap = new Map(images.map((img) => [img.listingId, img.url]));

  return { firstItemMap, itemCountMap, imageMap };
}
