/**
 * KB Page Builder Types
 *
 * Types for the Tiptap-based article editor, versioning, and public help center.
 * All content blocks use Tiptap JSON stored as text in the database.
 */

// --- Article Status ---

export type ArticleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

// --- Tiptap Content Types ---

export interface TiptapMark {
  readonly type: string;
  readonly attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  readonly type: string;
  readonly content?: readonly TiptapNode[];
  readonly text?: string;
  readonly marks?: readonly TiptapMark[];
  readonly attrs?: Record<string, unknown>;
}

export interface TiptapContent {
  readonly type: 'doc';
  readonly content: readonly TiptapNode[];
}

// --- Article Version Input ---

export interface ArticleVersionInput {
  readonly title: string;
  readonly slug: string;
  readonly content: string; // Tiptap JSON string
  readonly excerpt?: string | null;
  readonly status: ArticleStatus;
}

// --- KB Category Input ---

export interface KbCategoryInput {
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
  readonly parentId?: string | null;
  readonly position?: number;
  readonly iconName?: string | null;
  readonly isPublic?: boolean;
}

// --- Article Feedback Input ---

export interface ArticleFeedbackInput {
  readonly helpful: boolean;
  readonly comment?: string | null;
  readonly userId?: string | null;
}

// --- Category Tree Node ---

export interface CategoryTreeNode {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly position: number;
  readonly iconName: string | null;
  readonly isPublic: boolean;
  readonly children: CategoryTreeNode[];
}

// --- Feedback Stats ---

export interface FeedbackStats {
  readonly helpfulCount: number;
  readonly unhelpfulCount: number;
  readonly score: number; // helpfulCount / (helpfulCount + unhelpfulCount), 0 if no feedback
}

// --- Heading Extraction ---

export interface ExtractedHeading {
  readonly level: number;
  readonly text: string;
  readonly id: string; // auto-generated anchor ID
}
