# Feature Registry App Codemap

**Last Updated:** 2026-04-06

**Entry Points:**
- `/apps/registry/src/App.tsx` (Application root)
- `/scripts/mcp-server.ts` (MCP server for Claude Code)
- `/scripts/scaffold-manifest.ts` (Manifest generation)
- `/feature-manifest.json` (Feature database)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Feature Registry App                      │
│                   (Vite + React SPA)                         │
└─────────────────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────┐
    │  Dashboard | Board | Canvas | Map | Search │
    └────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────┐
    │     Feature Manifest (feature-manifest.json)│
    │     221 features, 190 routes, 310 tables    │
    └────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────┐
    │   MCP Server (for Claude Code integration)  │
    │   7 tools: list, search, detail, sync, etc  │
    └────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────┐
    │   Scaffold Manifest (auto-parse codebase)   │
    │   Generates feature-manifest.json from code │
    └────────────────────────────────────────────┘
```

---

## Views & Components

### 1. Dashboard View

**Purpose:** Feature overview, statistics, recent activity

**Data Displayed:**
- Total features count (221)
- Features by status (Active, In Progress, Planned, Deprecated)
- Recently modified features
- Feature implementation timeline
- Code coverage statistics

**Key Metrics:**
```typescript
{
  totalFeatures: 221,
  featuresByStatus: {
    active: 145,
    inProgress: 42,
    planned: 28,
    deprecated: 6
  },
  totalRoutes: 190,
  totalTables: 310,
  sourceFiles: 2639,
  lastSyncTime: ISO8601
}
```

### 2. Feature Board View

**Purpose:** Kanban-style feature management

**Columns:**
- Backlog
- In Design
- In Development
- Under Review
- Testing
- Released
- Deprecated

**Features:**
- Drag-and-drop feature cards between columns
- Status update on drop
- Filter by team, priority, complexity
- Quick-edit feature details
- Bulk operations (update status, assign, tag)

**Card Details:**
```typescript
{
  featureId: string;
  name: string;
  description: string;
  status: 'BACKLOG' | 'DESIGN' | 'DEV' | 'REVIEW' | 'TEST' | 'RELEASED' | 'DEPRECATED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  complexity: 'TRIVIAL' | 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'EPIC';
  assignee?: string;
  tags: string[];
  relatedFeatures: string[];
  estimatedHours?: number;
  completionPercentage: number;
}
```

### 3. Canvas View (React Flow)

**Purpose:** Mind-map visualization of feature relationships

**Features:**
- Interactive node-and-edge graph
- Feature nodes with status colors
- Dependency edges (shows what depends on what)
- Relationship types: requires, blocks, enables, related-to
- Zoom, pan, auto-layout options
- Click node to view details
- Export as SVG/PNG

**Node Colors:**
```
🟢 Active (Released)
🟡 In Progress (Dev/Review/Test)
🔵 Planned (Backlog/Design)
⚫ Deprecated
```

**Edge Types:**
```
→ Requires (strong dependency)
⇢ Enables (optional enhancement)
⟿ Blocks (hard blocker)
-- Related (soft relationship)
```

### 4. Code Map View

**Purpose:** File-level codebase explorer

**Features:**
- Tree view of source structure
- File metadata (lines, complexity, tests)
- Cross-reference links (where feature is implemented)
- Show files for selected feature
- Navigate to GitHub (link to repo)
- Search by file path

**File Info:**
```typescript
{
  path: string;              // e.g., "apps/web/src/app/api/seller/activate/route.ts"
  lines: number;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  hasTests: boolean;
  lastModified: ISO8601;
  author?: string;
  contributors: string[];
  featureId?: string;        // linked feature
  imports: string[];
  exports: string[];
}
```

### 5. Search View

**Purpose:** Full-text search across all features, routes, tables, files

**Search By:**
- Feature name/description
- Route path (e.g., `/my/selling`)
- Table name (e.g., `seller_profile`)
- File name/path
- Tag
- Author
- Status
- Complexity

**Results:**
```typescript
interface SearchResult {
  type: 'feature' | 'route' | 'table' | 'file' | 'component';
  id: string;
  name: string;
  description: string;
  path?: string;
  featureId?: string;
  relevanceScore: number;
}
```

### 6. Tasks View

**Purpose:** Feature implementation task management

**Features:**
- Task checklist per feature
- Subtask hierarchy
- Assign to team members
- Track progress percentage
- Link to PRs/commits
- Generate PRD from checklist

**Task Structure:**
```typescript
{
  featureId: string;
  tasks: [
    {
      id: string;
      title: string;
      description: string;
      status: 'TODO' | 'IN_PROGRESS' | 'DONE';
      assignee?: string;
      subtasks: Task[];
      relatedFiles: string[];
      linkedPR?: string;
      completionEstimate: string; // "1 day", "3 days", "1 week"
    }
  ];
  prdGenerated: boolean;
  prdPath?: string;
}
```

---

## Feature Manifest Schema

**File:** `/feature-manifest.json`

**Root Structure:**
```typescript
{
  version: string;           // e.g., "1.0.0"
  lastGenerated: ISO8601;
  statistics: {
    totalFeatures: number;
    totalRoutes: number;
    totalTables: number;
    sourceFiles: number;
  };
  features: Feature[];
}
```

**Feature Object:**
```typescript
interface Feature {
  // Identification
  id: string;                    // CUID2 or semantic ID
  name: string;
  description: string;

  // Status & Metadata
  status: 'ACTIVE' | 'DEPRECATED' | 'PLANNED' | 'IN_PROGRESS';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  complexity: 'TRIVIAL' | 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'EPIC';

  // Code Locations
  entryFiles: string[];          // main files (e.g., route.ts, page.tsx, component.tsx)
  relatedFiles: string[];        // supporting files

  // Database
  tables: string[];              // related database tables
  enums?: string[];              // related enum types

  // Routes
  routes: {
    path: string;               // e.g., "/my/selling"
    method?: string;            // GET, POST, etc.
    description?: string;
    public: boolean;
  }[];

  // Dependencies
  requires: string[];            // feature IDs this depends on
  blocks: string[];              // feature IDs this blocks
  relatedFeatures: string[];     // soft dependencies

  // Implementation Details
  tech: string[];               // technologies used (React, Drizzle, etc.)
  tests: {
    unit: number;
    integration: number;
    e2e: number;
  };

  // Metadata
  tags: string[];
  owner?: string;               // team/person responsible
  createdAt: ISO8601;
  lastModified: ISO8601;
}
```

---

## MCP Server Integration

**File:** `/scripts/mcp-server.ts`

### Available Tools

#### 1. `list_features`
**Purpose:** List all features with filters

**Input:**
```typescript
{
  status?: 'ACTIVE' | 'DEPRECATED' | 'PLANNED' | 'IN_PROGRESS';
  tags?: string[];
  limit?: number;
  offset?: number;
}
```

**Output:**
```typescript
{
  features: Feature[];
  total: number;
  hasMore: boolean;
}
```

#### 2. `get_feature_detail`
**Purpose:** Get full details of a single feature

**Input:**
```typescript
{
  featureId: string;
}
```

**Output:**
```typescript
{
  feature: Feature;
  relatedFeatures: Feature[];
  files: FileInfo[];
  routes: RouteInfo[];
}
```

#### 3. `search_codebase`
**Purpose:** Full-text search across features and code

**Input:**
```typescript
{
  query: string;
  type?: 'feature' | 'file' | 'route' | 'table';
  limit?: number;
}
```

**Output:**
```typescript
{
  results: SearchResult[];
  executionTimeMs: number;
}
```

#### 4. `parse_feature_manifest`
**Purpose:** Re-parse and regenerate feature manifest from codebase

**Input:**
```typescript
{
  includeDependencies?: boolean;
  includeTests?: boolean;
}
```

**Output:**
```typescript
{
  success: boolean;
  featuresFound: number;
  routesFound: number;
  tablesFound: number;
  errors: string[];
  manifest: FeatureManifest;
}
```

#### 5. `generate_prds`
**Purpose:** Generate PRD from feature manifest

**Input:**
```typescript
{
  featureIds: string[];
  format?: 'markdown' | 'html';
  includeRisks?: boolean;
}
```

**Output:**
```typescript
{
  prd: string;
  featuresCovered: string[];
  estimatedDevelopmentDays: number;
}
```

#### 6. `map_feature_to_code`
**Purpose:** Show all code artifacts for a feature

**Input:**
```typescript
{
  featureId: string;
}
```

**Output:**
```typescript
{
  files: FileMapping[];
  routes: RouteMapping[];
  tables: TableMapping[];
  components: ComponentMapping[];
}
```

#### 7. `sync_manifest`
**Purpose:** Sync manifest with latest code changes

**Input:**
```typescript
{
  gitRef?: string;  // specific commit/branch to sync from
}
```

**Output:**
```typescript
{
  success: boolean;
  changesDetected: number;
  featuresAdded: number;
  featuresModified: number;
  featuresRemoved: number;
}
```

### Usage Example

```bash
# Start MCP server (stdio)
node scripts/mcp-server.ts

# In Claude Code:
# The server automatically registers these tools
# Call them directly: "list_features", "search_codebase", etc.
```

---

## Manifest Scaffolder

**File:** `/scripts/scaffold-manifest.ts`

### Purpose
Automatically parse codebase and generate/update `feature-manifest.json`

### Algorithm

```
1. Scan source files (apps/web, packages/*)
2. Parse TypeScript/React for components, routes, server actions
3. Scan database schema (packages/db/src/schema/)
4. Extract table names and relationships
5. Parse route definitions (app/api/*, app/(*)/)
6. Build dependency graph (imports, route dependencies)
7. Detect features from file structure and naming conventions
8. Generate feature manifest
9. Validate manifest (check all references exist)
10. Write to feature-manifest.json
```

### Usage

```bash
# Generate/update manifest
npx tsx scripts/scaffold-manifest.ts

# With options
npx tsx scripts/scaffold-manifest.ts --include-tests --format json
```

### Configuration

```typescript
interface ScaffoldConfig {
  rootDir: string;              // project root
  srcPaths: string[];           // directories to scan
  outputPath: string;           // where to write manifest
  excludePaths: string[];       // paths to skip
  detectDependencies: boolean;  // analyze import graph
  validateReferences: boolean;  // check references exist
  includeTests: boolean;        // include test file info
  includeDeprecated: boolean;   // include deprecated features
}
```

---

## File Locations

| File/Directory | Purpose |
|---|---|
| `/apps/registry/` | Main app directory (Vite + React) |
| `/apps/registry/src/App.tsx` | Root component |
| `/apps/registry/src/views/Dashboard.tsx` | Dashboard view |
| `/apps/registry/src/views/Board.tsx` | Kanban board view |
| `/apps/registry/src/views/Canvas.tsx` | React Flow mind-map |
| `/apps/registry/src/views/CodeMap.tsx` | File explorer |
| `/apps/registry/src/views/Search.tsx` | Search interface |
| `/apps/registry/src/views/Tasks.tsx` | Task management |
| `/scripts/mcp-server.ts` | MCP server entry point |
| `/scripts/scaffold-manifest.ts` | Manifest generator |
| `/feature-manifest.json` | Feature database |
| `/apps/registry/vite.config.ts` | Vite configuration |
| `/apps/registry/package.json` | Registry app dependencies |

---

## Build & Deployment

### Development

```bash
# From root
cd apps/registry

# Install dependencies
pnpm install

# Start dev server (hot reload)
pnpm dev
# Accessible at http://localhost:5173

# Build production
pnpm build

# Preview production build
pnpm preview
```

### Environment Variables

Create `.env.local` in `/apps/registry/`:
```
VITE_API_BASE_URL=http://localhost:3000
VITE_MCP_SERVER_PATH=/api/mcp
```

### Deployment

```bash
# Build static assets
pnpm build

# Output: dist/ directory
# Deploy to static host or CDN

# Recommended: deploy to docs.twicely.co subdomain
```

---

## Data Integration

### Manifest Updates

**Automatic (CI/CD):**
```yaml
# .github/workflows/sync-manifest.yml
on:
  push:
    branches: [main, develop]
    paths: ['apps/**', 'packages/**']

jobs:
  sync-manifest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Sync manifest
        run: npx tsx scripts/scaffold-manifest.ts
      - name: Commit changes
        run: git commit -am "chore: sync feature manifest" || true
```

**Manual:**
```bash
npx tsx scripts/scaffold-manifest.ts
git add feature-manifest.json
git commit -m "chore: update feature manifest"
```

### External Data Sources

The registry can ingest data from:
- GitHub API (PR/commit history)
- Sentry (error rates)
- Analytics (feature usage)
- Test reports (coverage)
- Performance metrics (Grafana)

---

## Performance & Scale

### Statistics (Current)

```
Features parsed:       221
Routes parsed:         190
Tables parsed:         310
Source files:         2,639
Manifest file size:    ~85 KB
Parse time:            ~2-3 seconds
Search index size:     ~200 KB
```

### Optimization

- React.memo on card components
- Virtual scrolling for long lists
- Lazy-load React Flow diagram
- Client-side search index (cached)
- Indexed database queries

### Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

---

## Integration with Claude Code

The MCP server allows Claude Code to:
1. List all features in the project
2. Search codebase by feature, file, or route
3. Get full implementation details
4. See feature dependencies
5. Generate PRDs from feature specifications
6. Automatically sync manifest when implementing features

### Example Claude Code Usage

```
# Claude Code can now:
"List all ACTIVE seller features"
→ Calls list_features(status: 'ACTIVE', tags: ['seller'])

"Show me all files that implement seller activation"
→ Calls map_feature_to_code(featureId: 'seller-activation')

"Search for all payout-related code"
→ Calls search_codebase(query: 'payout', type: 'feature')

"Update manifest after this change"
→ Calls sync_manifest()
```

---

## Testing & Quality

### Registry App Tests

- UI component tests (React Testing Library)
- Feature manifest validation
- MCP server tool tests
- Manifest scaffolder tests

### Manifest Quality Checks

```bash
# Validate manifest structure
npx tsx scripts/validate-manifest.ts

# Check for missing references
npx tsx scripts/check-manifest-refs.ts

# Generate coverage report
npx tsx scripts/manifest-coverage.ts
```

---

## Troubleshooting

### Issue: "Manifest out of date"

**Solution:**
```bash
npx tsx scripts/scaffold-manifest.ts
git add feature-manifest.json
git commit -m "chore: sync manifest"
```

### Issue: MCP server won't start

**Check:**
1. Node.js version (14+)
2. All dependencies installed
3. Check logs: `node scripts/mcp-server.ts 2>&1 | head -20`

### Issue: Slow search

**Optimize:**
1. Rebuild search index: `npm run build-search-index`
2. Clear browser cache
3. Check manifest size (should be <500 KB)

---

## Future Enhancements

- [ ] GitHub Actions integration (PR comments with feature impact)
- [ ] Jira/Linear sync for task management
- [ ] AI-generated feature summaries
- [ ] Automated test coverage tracking per feature
- [ ] Performance metrics dashboard
- [ ] Feature deprecation warnings in IDE
- [ ] Dependency conflict detection
- [ ] Audit trail for manifest changes

---

## Related Documentation

- **Registry App Quick Start:** `/apps/registry/README.md` (when created)
- **MCP Protocol:** https://modelcontextprotocol.io
- **React Flow:** https://reactflow.dev
- **Feature Specifications:** `/read-me/TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md`

