import { describe, it, expect } from 'vitest';
import * as schema from '@twicely/db/schema';

describe('Social & Discovery tables', () => {
  it('exports listingQuestion table', () => {
    expect(schema.listingQuestion).toBeDefined();
  });

  it('exports curatedCollection table', () => {
    expect(schema.curatedCollection).toBeDefined();
  });

  it('exports curatedCollectionItem table', () => {
    expect(schema.curatedCollectionItem).toBeDefined();
  });

  it('exports offerBundleItem table', () => {
    expect(schema.offerBundleItem).toBeDefined();
  });

  it('exports liveSession table', () => {
    expect(schema.liveSession).toBeDefined();
  });

  it('exports liveSessionProduct table', () => {
    expect(schema.liveSessionProduct).toBeDefined();
  });

  it('listing table has video fields', () => {
    expect(schema.listing.videoUrl).toBeDefined();
    expect(schema.listing.videoThumbUrl).toBeDefined();
    expect(schema.listing.videoDurationSeconds).toBeDefined();
  });
});
