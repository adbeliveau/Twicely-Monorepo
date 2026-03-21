import { pgTable, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { newsletterSourceEnum } from './enums';

export { newsletterSourceEnum };

export const newsletterSubscriber = pgTable('newsletter_subscriber', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  email:            text('email').notNull(),
  source:           newsletterSourceEnum('source').notNull().default('HOMEPAGE_SECTION'),
  unsubscribeToken: text('unsubscribe_token').notNull().$defaultFn(() => createId()),
  confirmedAt:      timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
  unsubscribedAt:   timestamp('unsubscribed_at', { withTimezone: true }),
  welcomeSentAt:    timestamp('welcome_sent_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailUnique:    unique('newsletter_subscriber_email_unique').on(table.email),
  tokenUnique:    unique('newsletter_subscriber_token_unique').on(table.unsubscribeToken),
  emailIdx:       index('newsletter_subscriber_email_idx').on(table.email),
  createdAtIdx:   index('newsletter_subscriber_created_at_idx').on(table.createdAt),
}));
