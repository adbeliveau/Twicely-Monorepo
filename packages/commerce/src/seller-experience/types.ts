/** Bulk job operation types */
export type BulkJobType = 'IMPORT' | 'EXPORT' | 'PRICE_UPDATE' | 'RELIST' | 'END';

/** Bulk job status */
export type BulkJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/** Input for creating a bulk job */
export interface BulkJobInput {
  jobType: BulkJobType;
  totalItems?: number;
  fileUrl?: string | null;
}

/** Input for creating/updating a listing template */
export interface TemplateInput {
  name: string;
  categoryId?: string | null;
  descriptionTemplate?: string | null;
  conditionDefault?: string | null;
  shippingPresetId?: string | null;
  defaultsJson?: Record<string, unknown>;
}

/** Input for creating/updating a shipping preset */
export interface ShippingPresetInput {
  name: string;
  carrier: string;
  serviceType: string;
  weightOz?: number | null;
  lengthIn?: number | null;
  widthIn?: number | null;
  heightIn?: number | null;
  freeShippingThresholdCents?: number | null;
}

/** Input for saving a listing draft */
export interface DraftInput {
  listingId?: string | null;
  draftData: Record<string, unknown>;
  scheduledPublishAt?: Date | null;
}

/** Vacation mode type */
export type VacationMode = 'HARD_AWAY' | 'SOFT_AWAY' | 'AWAY_BUT_OPEN';

/** Input for vacation mode configuration */
export interface VacationModeInput {
  mode?: VacationMode;
  startAt?: Date | null;
  endAt?: Date | null;
  autoReplyMessage?: string | null;
}

/** Appeal type categories */
export type AppealType = 'LISTING_REMOVAL' | 'ACCOUNT_SUSPENSION' | 'FEE_DISPUTE' | 'POLICY_VIOLATION';

/** Appeal status */
export type AppealStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED';

/** Input for submitting a seller appeal */
export interface AppealInput {
  appealType: AppealType;
  entityId?: string | null;
  reason: string;
}

/** Appeal review action */
export type AppealAction = 'APPROVED' | 'DENIED';

/** Pagination options */
export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

/** Standard paginated response */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
