/**
 * Drizzle inferred types for all crosslister tables.
 * Re-exports InferSelectModel / InferInsertModel so the rest of the app
 * imports from here rather than directly from the schema.
 * Source: Schema §12.1-12.9
 */

import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  crosslisterAccount,
  channelProjection,
  crossJob,
  importBatch,
  importRecord,
  dedupeFingerprint,
  channelCategoryMapping,
  channelPolicyRule,
  automationSetting,
} from '@twicely/db/schema';

export type CrosslisterAccount = InferSelectModel<typeof crosslisterAccount>;
export type NewCrosslisterAccount = InferInsertModel<typeof crosslisterAccount>;

export type ChannelProjection = InferSelectModel<typeof channelProjection>;
export type NewChannelProjection = InferInsertModel<typeof channelProjection>;

export type CrossJob = InferSelectModel<typeof crossJob>;
export type NewCrossJob = InferInsertModel<typeof crossJob>;

export type ImportBatch = InferSelectModel<typeof importBatch>;
export type NewImportBatch = InferInsertModel<typeof importBatch>;

export type ImportRecord = InferSelectModel<typeof importRecord>;
export type NewImportRecord = InferInsertModel<typeof importRecord>;

export type DedupeFingerprint = InferSelectModel<typeof dedupeFingerprint>;
export type NewDedupeFingerprint = InferInsertModel<typeof dedupeFingerprint>;

export type ChannelCategoryMapping = InferSelectModel<typeof channelCategoryMapping>;
export type NewChannelCategoryMapping = InferInsertModel<typeof channelCategoryMapping>;

export type ChannelPolicyRule = InferSelectModel<typeof channelPolicyRule>;
export type NewChannelPolicyRule = InferInsertModel<typeof channelPolicyRule>;

export type AutomationSetting = InferSelectModel<typeof automationSetting>;
export type NewAutomationSetting = InferInsertModel<typeof automationSetting>;
