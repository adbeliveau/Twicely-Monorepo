'use client';

import type { Config } from '@puckeditor/core';
import { heroBlockConfig } from './puck-blocks/hero-block';
import { richTextBlockConfig } from './puck-blocks/rich-text-block';
import { imageBlockConfig } from './puck-blocks/image-block';
import { spacerBlockConfig } from './puck-blocks/spacer-block';
import { columnsBlockConfig } from './puck-blocks/columns-block';
import { featuredListingsBlockConfig } from './puck-blocks/featured-listings-block';
import { ctaButtonBlockConfig } from './puck-blocks/cta-button-block';
import { videoEmbedBlockConfig } from './puck-blocks/video-embed-block';
import { testimonialBlockConfig } from './puck-blocks/testimonial-block';
import { faqBlockConfig } from './puck-blocks/faq-block';
import { imageGalleryBlockConfig } from './puck-blocks/image-gallery-block';

export const puckConfig: Config = {
  components: {
    Hero: heroBlockConfig,
    RichText: richTextBlockConfig,
    Image: imageBlockConfig,
    Spacer: spacerBlockConfig,
    Columns: columnsBlockConfig,
    FeaturedListings: featuredListingsBlockConfig,
    CTAButton: ctaButtonBlockConfig,
    VideoEmbed: videoEmbedBlockConfig,
    Testimonial: testimonialBlockConfig,
    FAQ: faqBlockConfig,
    ImageGallery: imageGalleryBlockConfig,
  },
};
