/**
 * Admin category query types.
 * Extracted from admin-categories.ts to stay under the 300-line limit.
 */

export interface AdminCategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  feeBucket: string;
  sortOrder: number;
  isActive: boolean;
  isLeaf: boolean;
  depth: number;
  path: string;
  listingCount: number;
  attributeSchemaCount: number;
  children: AdminCategoryNode[];
}

export interface AdminCategoryDetail {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  description: string | null;
  icon: string | null;
  feeBucket: string;
  sortOrder: number;
  isActive: boolean;
  isLeaf: boolean;
  depth: number;
  path: string;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  listingCount: number;
  children: Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    sortOrder: number;
    listingCount: number;
  }>;
  attributeSchemas: Array<{
    id: string;
    name: string;
    label: string;
    fieldType: string;
    isRequired: boolean;
    isRecommended: boolean;
    showInFilters: boolean;
    showInListing: boolean;
    optionsJson: unknown;
    validationJson: unknown;
    sortOrder: number;
  }>;
}

export interface CatalogBrowserFilters {
  search?: string;
  isActive?: boolean;
  feeBucket?: string;
  parentId?: string | null;
  page?: number;
  pageSize?: number;
}

export interface FlatCategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  feeBucket: string;
  depth: number;
  isActive: boolean;
  sortOrder: number;
  listingCount: number;
}

export interface CatalogBrowserResult {
  categories: FlatCategoryRow[];
  totalCount: number;
  page: number;
  totalPages: number;
}
