/**
 * TypeScript interfaces for The RealReal internal API responses.
 * Source: F3 install prompt — THEREALREAL (Tier C, session-based)
 *
 * The RealReal has no public API. Uses internal API at https://www.therealreal.com/api/v1.
 * Authentication: username/password → session cookie.
 * Fetch listings: GET /consignments
 */

/** The RealReal consignment image */
export interface TrrImage {
  id: string;
  url: string;
  position: number;
  is_primary: boolean;
}

/** The RealReal brand/designer */
export interface TrrDesigner {
  id: number;
  name: string;
  slug: string;
}

/** The RealReal category */
export interface TrrCategory {
  id: number;
  name: string;
  path: string;
}

/**
 * TRR uses their own grading system.
 * authentication_status indicates luxury authentication.
 */
export type TrrGrade =
  | 'Excellent'
  | 'Very Good'
  | 'Good'
  | 'Fair'
  | 'Poor'
  | string;

/** The RealReal consignment listing — from GET /consignments */
export interface TrrConsignment {
  id: string;
  title: string;
  description?: string;
  /** Price as decimal string, e.g. "450.00" */
  price: string;
  /** ISO currency code */
  currency?: string;
  /** TRR condition grade */
  condition?: TrrGrade;
  /** Authentication status (luxury items) */
  authentication_status?: 'authenticated' | 'pending' | 'not_required';
  /** Listing status */
  status?: 'listed' | 'sold' | 'pending' | 'returned' | 'expired';
  designer?: TrrDesigner;
  category?: TrrCategory;
  images?: TrrImage[];
  /** ISO 8601 timestamps */
  created_at?: string;
  sold_at?: string;
  /** Size information */
  size?: string;
  /** Condition details */
  condition_notes?: string;
}

/** The RealReal paginated consignments response */
export interface TrrConsignmentsResponse {
  consignments: TrrConsignment[];
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

/** The RealReal auth response */
export interface TrrAuthResponse {
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  session_id?: string;
  csrf_token?: string;
  error?: string;
  message?: string;
}

/** Session data stored in crosslisterAccount.sessionData */
export interface TrrSessionData {
  sessionId: string;
  csrfToken: string;
  userId: string;
  email: string;
  [key: string]: unknown;
}
