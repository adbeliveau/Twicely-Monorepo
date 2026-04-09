# TWICELY STUDIO 2.0 — CANONICAL SPECIFICATION

**Version:** 2.0.0  
**Status:** READY FOR IMPLEMENTATION  
**Created:** February 9, 2026  
**Module Type:** Self-contained, self-installing  
**Total Lines:** ~4,600

---

## DOCUMENT OVERVIEW

This is the **single source of truth** for building Twicely Studio 2.0 — the definitive CMS + Page Builder that makes WordPress + Elementor obsolete.

This document consolidates:
- Original specification (database schema, blocks, API)
- Addendum 1 (CPT, taxonomies, global widgets, i18n, comments)
- Addendum 2 (UX architecture, policy engine, canonical build instructions)

---

## TABLE OF CONTENTS

### PART 1: FOUNDATION
- Executive Summary
- Non-Negotiable Rules
- Dual Scope Architecture
- Module Structure

### PART 2: DATABASE
- Core Tables (26 total)
- Indexes & Constraints

### PART 3: RBAC & PERMISSIONS
- Platform Permissions
- Business Permissions
- Seller Permissions

### PART 4: EDITOR ARCHITECTURE
- Editor Shell (Puck is the Engine)
- Top Bar Requirements
- Left Panel (Dual-Mode)
- Right Panel (Document Only)
- Canvas Requirements
- Fullscreen Mode
- Inline Text Editing

### PART 5: POLICY ENGINE
- Policy Interface
- Runtime Configuration
- Locked Blocks System

### PART 6: BLOCK SYSTEM
- Block Registry
- Metadata Requirements
- 109 Blocks by Category
- Style Fields (6 universal)

### PART 7: ADVANCED FEATURES
- Custom Post Types
- Taxonomies
- Global Widgets
- Design Tokens
- Comments & Discussions
- Loop Builder
- Multi-Language (i18n)

### PART 8: BUILDERS
- Menu System
- Form Builder
- Popup Builder
- Template System
- Theme Builder

### PART 9: DATA INTEGRATION
- Dynamic Data Binding
- Helpdesk Integration
- Seller Store Builder

### PART 10: OPERATIONS
- Install/Uninstall
- Studio Doctor
- Health Provider
- API Routes (~60 endpoints)
- UI Pages (25+)

### PART 11: IMPLEMENTATION
- TypeScript Types
- Implementation Checklist
- Success Criteria
- Final Rules

---


# PART 1-3: CORE SPECIFICATION


## EXECUTIVE SUMMARY

Studio 2.0 is the **definitive CMS + Page Builder** for Twicely — designed to make WordPress + Elementor obsolete. Every feature they have, we have — but BETTER.

### What Studio 2.0 Delivers

| Capability | WordPress Equivalent | Elementor Equivalent |
|------------|---------------------|---------------------|
| **Content Management** | Pages, Posts, Custom Post Types | — |
| **Visual Page Builder** | — | 90+ Widgets, Theme Builder |
| **Template System** | Theme Templates | Template Library |
| **Dynamic Content** | Custom Fields (ACF) | Dynamic Tags |
| **Menu Builder** | Menu System | Nav Menu Widget |
| **Popup System** | — | Popup Builder |
| **Form Builder** | — | Form Widget |
| **Theme Builder** | Theme Customizer | Theme Builder |
| **Help/KB Integration** | — | — (UNIQUE TO TWICELY) |
| **Marketplace Integration** | — | WooCommerce Builder (but better) |
| **Seller Store Builder** | Multisite | — (UNIQUE TO TWICELY) |

---

## ARCHITECTURE OVERVIEW

```
STUDIO 2.0 MODULE STRUCTURE
├── modules/twicely-studio/
│   ├── manifest.json                    # Module metadata
│   ├── install.ts                       # Idempotent installer
│   ├── uninstall.ts                     # Clean removal
│   ├── README.md
│   │
│   ├── migrations/
│   │   └── 001_create_studio_tables.sql
│   │
│   └── src/
│       ├── server.ts                    # SERVER-SAFE exports
│       ├── client.ts                    # CLIENT exports
│       │
│       ├── types/                       # TypeScript definitions
│       │   ├── page.ts
│       │   ├── block.ts
│       │   ├── template.ts
│       │   ├── menu.ts
│       │   ├── form.ts
│       │   ├── popup.ts
│       │   └── index.ts
│       │
│       ├── blocks/                      # 100 blocks
│       │   ├── definitions/             # Server-safe metadata
│       │   ├── components/              # Client-only React
│       │   └── registry.ts              # Puck config generator
│       │
│       ├── fields/                      # Custom style fields
│       │   ├── SpacingField.tsx
│       │   ├── TypographyField.tsx
│       │   ├── BackgroundField.tsx
│       │   ├── BorderField.tsx
│       │   ├── ShadowField.tsx
│       │   └── AnimationField.tsx
│       │
│       ├── editor/                      # Editor components
│       │   ├── Editor.tsx               # Main Puck wrapper
│       │   ├── Canvas.tsx
│       │   ├── LeftPanel.tsx
│       │   ├── RightPanel.tsx
│       │   ├── TopBar.tsx
│       │   └── BlockInspector.tsx
│       │
│       ├── renderer/                    # Page rendering
│       │   ├── PageRenderer.tsx
│       │   ├── BlockRenderer.tsx
│       │   └── DynamicDataResolver.ts
│       │
│       ├── templates/                   # Template system
│       │   ├── pageTemplates.ts
│       │   ├── sectionTemplates.ts
│       │   └── globalTemplates.ts
│       │
│       ├── menus/                       # Menu builder
│       │   ├── MenuBuilder.tsx
│       │   ├── MenuItemEditor.tsx
│       │   └── MegaMenuEditor.tsx
│       │
│       ├── forms/                       # Form builder
│       │   ├── FormBuilder.tsx
│       │   ├── FormRenderer.tsx
│       │   └── FormSubmissions.tsx
│       │
│       ├── popups/                      # Popup builder
│       │   ├── PopupBuilder.tsx
│       │   ├── PopupRenderer.tsx
│       │   └── PopupTriggers.ts
│       │
│       ├── theme-builder/               # Theme builder
│       │   ├── HeaderBuilder.tsx
│       │   ├── FooterBuilder.tsx
│       │   ├── SingleTemplate.tsx
│       │   └── ArchiveTemplate.tsx
│       │
│       ├── data/                        # Dynamic data
│       │   ├── DataSourceResolver.ts
│       │   ├── QueryBuilder.ts
│       │   └── ContextProvider.tsx
│       │
│       ├── api/                         # API handlers
│       │   ├── pages.ts
│       │   ├── templates.ts
│       │   ├── menus.ts
│       │   ├── forms.ts
│       │   ├── popups.ts
│       │   └── media.ts
│       │
│       ├── ui/                          # Admin pages
│       │   ├── StudioDashboard.tsx
│       │   ├── PagesList.tsx
│       │   ├── PageEditor.tsx
│       │   ├── TemplatesList.tsx
│       │   ├── MenuManager.tsx
│       │   ├── FormManager.tsx
│       │   ├── PopupManager.tsx
│       │   └── ThemeBuilder.tsx
│       │
│       ├── doctor/                      # Health checks
│       │   └── runDoctor.ts
│       │
│       └── health/                      # Health provider
│           ├── provider.ts
│           └── ui.tsx
```

---

## SECTION 1: DATABASE SCHEMA

Studio 2.0 uses its own tables (CREATE IF NOT EXISTS) and integrates with existing platform models.

### 1.1 Core Page Tables

```sql
-- =============================================================================
-- STUDIO PAGES - Main content storage
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_pages (
    id                  TEXT PRIMARY KEY,
    
    -- Identity
    slug                TEXT UNIQUE NOT NULL,
    title               TEXT NOT NULL,
    
    -- Type & Scope
    page_type           TEXT NOT NULL DEFAULT 'PAGE',  -- PAGE, POST, HELP_ARTICLE, LANDING
    scope               TEXT NOT NULL DEFAULT 'PLATFORM',  -- PLATFORM, SELLER_STORE
    seller_id           TEXT,  -- Only for SELLER_STORE scope
    
    -- Content (Puck JSON)
    content             JSONB NOT NULL DEFAULT '{}',
    content_version     INT NOT NULL DEFAULT 1,
    
    -- Status
    status              TEXT NOT NULL DEFAULT 'DRAFT',  -- DRAFT, REVIEW, PUBLISHED, ARCHIVED
    published_at        TIMESTAMPTZ,
    scheduled_for       TIMESTAMPTZ,
    
    -- Hierarchy (for page trees)
    parent_id           TEXT REFERENCES studio_pages(id) ON DELETE SET NULL,
    sort_order          INT DEFAULT 0,
    
    -- Template
    template_id         TEXT,  -- Which template to use
    use_custom_layout   BOOLEAN DEFAULT false,
    
    -- SEO
    meta_title          TEXT,
    meta_description    TEXT,
    meta_keywords       TEXT,
    og_title            TEXT,
    og_description      TEXT,
    og_image_url        TEXT,
    twitter_card        TEXT DEFAULT 'summary_large_image',
    canonical_url       TEXT,
    no_index            BOOLEAN DEFAULT false,
    no_follow           BOOLEAN DEFAULT false,
    structured_data     JSONB,
    
    -- Navigation
    show_in_header      BOOLEAN DEFAULT false,
    show_in_footer      BOOLEAN DEFAULT false,
    footer_column       INT,
    nav_label           TEXT,
    nav_order           INT DEFAULT 0,
    
    -- Access Control
    password_protected  BOOLEAN DEFAULT false,
    password_hash       TEXT,
    required_role       TEXT,  -- Restrict to specific roles
    
    -- Custom CSS
    custom_css          TEXT,
    custom_head_code    TEXT,
    custom_body_code    TEXT,
    
    -- Helpdesk Link (for HELP_ARTICLE type)
    kb_article_id       TEXT,  -- Links to KnowledgeBaseArticle
    
    -- Author
    created_by_staff_id TEXT,
    updated_by_staff_id TEXT,
    
    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_pages_slug ON studio_pages(slug);
CREATE INDEX IF NOT EXISTS idx_studio_pages_status ON studio_pages(status);
CREATE INDEX IF NOT EXISTS idx_studio_pages_scope ON studio_pages(scope, seller_id);
CREATE INDEX IF NOT EXISTS idx_studio_pages_type ON studio_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_studio_pages_parent ON studio_pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_studio_pages_nav ON studio_pages(show_in_header, show_in_footer);


-- =============================================================================
-- STUDIO PAGE REVISIONS - Version history
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_page_revisions (
    id                  TEXT PRIMARY KEY,
    page_id             TEXT NOT NULL REFERENCES studio_pages(id) ON DELETE CASCADE,
    
    version             INT NOT NULL,
    version_name        TEXT,  -- Optional named version "Before redesign"
    
    -- Snapshot
    title               TEXT NOT NULL,
    content             JSONB NOT NULL,
    meta_title          TEXT,
    meta_description    TEXT,
    custom_css          TEXT,
    
    -- Change info
    change_summary      TEXT,
    changed_by_staff_id TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(page_id, version)
);

CREATE INDEX IF NOT EXISTS idx_studio_revisions_page ON studio_page_revisions(page_id, version DESC);


-- =============================================================================
-- STUDIO GLOBALS - Header, Footer, Sidebar, etc.
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_globals (
    id                  TEXT PRIMARY KEY,
    
    -- Type
    global_type         TEXT NOT NULL,  -- HEADER, FOOTER, SIDEBAR, ANNOUNCEMENT_BAR
    name                TEXT NOT NULL,
    description         TEXT,
    
    -- Scope
    scope               TEXT NOT NULL DEFAULT 'PLATFORM',  -- PLATFORM, SELLER_STORE
    seller_id           TEXT,  -- Only for SELLER_STORE scope
    
    -- Content
    content             JSONB NOT NULL DEFAULT '{}',
    
    -- Status
    is_active           BOOLEAN DEFAULT true,
    is_default          BOOLEAN DEFAULT false,  -- Default for this type
    
    -- Conditions (when to show this global)
    conditions_json     JSONB DEFAULT '[]',
    -- [{field: "page_type", operator: "equals", value: "POST"}]
    
    -- Settings
    settings_json       JSONB DEFAULT '{}',
    -- For HEADER: {sticky: true, transparent_on_hero: true}
    -- For ANNOUNCEMENT_BAR: {dismissible: true, show_countdown: false}
    
    -- Custom CSS
    custom_css          TEXT,
    
    -- Author
    created_by_staff_id TEXT,
    updated_by_staff_id TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(global_type, scope, seller_id, is_default)
);

CREATE INDEX IF NOT EXISTS idx_studio_globals_type ON studio_globals(global_type, scope);
CREATE INDEX IF NOT EXISTS idx_studio_globals_active ON studio_globals(is_active, is_default);
```

### 1.2 Template Tables

```sql
-- =============================================================================
-- STUDIO TEMPLATES - Reusable page/section templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_templates (
    id                  TEXT PRIMARY KEY,
    
    -- Identity
    slug                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    thumbnail_url       TEXT,
    
    -- Type
    template_type       TEXT NOT NULL,  -- PAGE, SECTION, HEADER, FOOTER, SINGLE, ARCHIVE, POPUP
    category            TEXT,  -- landing, blog, product, help, etc.
    
    -- Content
    content             JSONB NOT NULL DEFAULT '{}',
    
    -- Display conditions (for SINGLE/ARCHIVE templates)
    conditions_json     JSONB DEFAULT '[]',
    -- [{field: "post_type", operator: "equals", value: "help_article"}]
    -- [{field: "category", operator: "in", value: ["electronics", "clothing"]}]
    
    priority            INT DEFAULT 0,  -- Higher = takes precedence
    
    -- Ownership
    is_system           BOOLEAN DEFAULT false,  -- Twicely-provided
    is_shared           BOOLEAN DEFAULT true,   -- Available to all editors
    created_by_staff_id TEXT,
    
    -- Scope
    scope               TEXT NOT NULL DEFAULT 'PLATFORM',
    seller_id           TEXT,
    
    -- Status
    is_active           BOOLEAN DEFAULT true,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_templates_type ON studio_templates(template_type, is_active);
CREATE INDEX IF NOT EXISTS idx_studio_templates_category ON studio_templates(category);
CREATE INDEX IF NOT EXISTS idx_studio_templates_scope ON studio_templates(scope, seller_id);


-- =============================================================================
-- STUDIO TEMPLATE CONDITIONS - Theme builder display rules
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_template_conditions (
    id                  TEXT PRIMARY KEY,
    template_id         TEXT NOT NULL REFERENCES studio_templates(id) ON DELETE CASCADE,
    
    -- Condition type
    condition_type      TEXT NOT NULL,  -- INCLUDE, EXCLUDE
    
    -- What to match
    match_type          TEXT NOT NULL,  
    -- ALL, SINGULAR, ARCHIVE, PAGE, POST, CATEGORY, TAG, AUTHOR, DATE, SEARCH, 404, FRONT_PAGE, HELP_ARTICLE
    
    match_value         TEXT,  -- Specific ID, slug, or category
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_conditions ON studio_template_conditions(template_id);
```

### 1.3 Menu Tables

```sql
-- =============================================================================
-- STUDIO MENUS - Navigation menus
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_menus (
    id                  TEXT PRIMARY KEY,
    
    -- Identity
    slug                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    
    -- Type
    menu_type           TEXT NOT NULL DEFAULT 'NAVIGATION',  
    -- NAVIGATION, MEGA_MENU, FOOTER_LINKS, MOBILE_MENU
    
    -- Location assignment
    location            TEXT,  -- header-primary, header-secondary, footer-1, mobile, etc.
    
    -- Scope
    scope               TEXT NOT NULL DEFAULT 'PLATFORM',
    seller_id           TEXT,
    
    -- Status
    is_active           BOOLEAN DEFAULT true,
    
    -- Settings
    settings_json       JSONB DEFAULT '{}',
    -- {max_depth: 3, show_icons: true, mobile_breakpoint: 768}
    
    created_by_staff_id TEXT,
    updated_by_staff_id TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_menus_location ON studio_menus(location, scope);


-- =============================================================================
-- STUDIO MENU ITEMS - Individual menu entries
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_menu_items (
    id                  TEXT PRIMARY KEY,
    menu_id             TEXT NOT NULL REFERENCES studio_menus(id) ON DELETE CASCADE,
    
    -- Hierarchy
    parent_id           TEXT REFERENCES studio_menu_items(id) ON DELETE CASCADE,
    sort_order          INT DEFAULT 0,
    depth               INT DEFAULT 0,
    
    -- Display
    label               TEXT NOT NULL,
    icon                TEXT,
    css_class           TEXT,
    
    -- Target - what this links to
    target_type         TEXT NOT NULL,
    -- PAGE, URL, CATEGORY, COLLECTION, SELLER, SEARCH, SALE, FEATURED, NEW_ARRIVALS,
    -- HELP_CATEGORY, HELP_ARTICLE, HOME, CART, ACCOUNT, WISHLIST, ORDERS, FAQ, CONTACT
    
    target_id           TEXT,  -- ID for PAGE, CATEGORY, etc.
    target_url          TEXT,  -- For URL type
    target_slug         TEXT,  -- Cached slug for URL generation
    
    -- Link behavior
    open_in_new_tab     BOOLEAN DEFAULT false,
    no_follow           BOOLEAN DEFAULT false,
    
    -- Mega menu content (if this item has a dropdown)
    has_mega_menu       BOOLEAN DEFAULT false,
    mega_menu_content   JSONB,  -- Puck content for mega menu
    mega_menu_width     TEXT DEFAULT 'full',  -- full, auto, or px value
    
    -- Badge (e.g., "NEW", "SALE", cart count)
    badge_type          TEXT,  -- TEXT, COUNT, DOT
    badge_value         TEXT,  -- Static text or dynamic source
    badge_data_source   TEXT,  -- cart_count, wishlist_count, unread_messages
    badge_color         TEXT,
    
    -- Visibility
    is_visible          BOOLEAN DEFAULT true,
    show_when_logged_in BOOLEAN,  -- null = always, true = only logged in, false = only logged out
    required_roles      TEXT[],   -- Show only for these roles
    show_on_devices     TEXT[] DEFAULT ARRAY['desktop', 'tablet', 'mobile'],
    
    -- Highlighting
    is_highlighted      BOOLEAN DEFAULT false,
    highlight_style     TEXT,  -- primary, secondary, outline
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON studio_menu_items(menu_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_parent ON studio_menu_items(parent_id);
```

### 1.4 Form Tables

```sql
-- =============================================================================
-- STUDIO FORMS - Form definitions
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_forms (
    id                  TEXT PRIMARY KEY,
    
    -- Identity
    slug                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    
    -- Form type
    form_type           TEXT NOT NULL DEFAULT 'CONTACT',
    -- CONTACT, NEWSLETTER, REGISTRATION, FEEDBACK, CUSTOM, SUPPORT_TICKET
    
    -- Fields (JSON schema)
    fields_json         JSONB NOT NULL DEFAULT '[]',
    -- [{id, type, name, label, placeholder, required, validation, options}]
    
    -- Layout
    layout              TEXT DEFAULT 'STACKED',  -- STACKED, INLINE, GRID
    columns             INT DEFAULT 1,
    
    -- Button
    submit_button_text  TEXT DEFAULT 'Submit',
    submit_button_style TEXT DEFAULT 'primary',
    
    -- Success handling
    success_action      TEXT DEFAULT 'MESSAGE',  -- MESSAGE, REDIRECT, CLOSE_POPUP
    success_message     TEXT DEFAULT 'Thank you for your submission!',
    success_redirect_url TEXT,
    
    -- Error handling
    error_message       TEXT DEFAULT 'Something went wrong. Please try again.',
    
    -- Email notifications
    notify_emails       TEXT[],
    notification_subject TEXT,
    notification_template TEXT,
    
    -- Integrations
    integrations_json   JSONB DEFAULT '[]',
    -- [{type: "MAILCHIMP", list_id: "abc123"}, {type: "HELPDESK", category: "support"}]
    
    -- Spam protection
    enable_recaptcha    BOOLEAN DEFAULT true,
    honeypot_enabled    BOOLEAN DEFAULT true,
    
    -- Limits
    max_submissions_per_ip INT,
    rate_limit_window_minutes INT DEFAULT 60,
    
    -- Multi-step
    is_multi_step       BOOLEAN DEFAULT false,
    steps_json          JSONB,  -- [{name, description, field_ids}]
    
    -- Status
    is_active           BOOLEAN DEFAULT true,
    
    -- Scope
    scope               TEXT NOT NULL DEFAULT 'PLATFORM',
    seller_id           TEXT,
    
    created_by_staff_id TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_forms_type ON studio_forms(form_type, is_active);


-- =============================================================================
-- STUDIO FORM SUBMISSIONS - Submitted form data
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_form_submissions (
    id                  TEXT PRIMARY KEY,
    form_id             TEXT NOT NULL REFERENCES studio_forms(id) ON DELETE CASCADE,
    
    -- Submitter
    user_id             TEXT,
    email               TEXT,
    
    -- Data
    data_json           JSONB NOT NULL,
    
    -- Source
    source_page_id      TEXT,
    source_url          TEXT,
    referrer            TEXT,
    ip_address          TEXT,
    user_agent          TEXT,
    
    -- Status
    status              TEXT DEFAULT 'NEW',  -- NEW, READ, REPLIED, SPAM, ARCHIVED
    
    -- Processing
    processed_at        TIMESTAMPTZ,
    processed_by_staff_id TEXT,
    notes               TEXT,
    
    -- Helpdesk link
    helpdesk_case_id    TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions ON studio_form_submissions(form_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_user ON studio_form_submissions(user_id);
```

### 1.5 Popup Tables

```sql
-- =============================================================================
-- STUDIO POPUPS - Popup/modal definitions
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_popups (
    id                  TEXT PRIMARY KEY,
    
    -- Identity
    slug                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    
    -- Content (Puck JSON)
    content             JSONB NOT NULL DEFAULT '{}',
    
    -- Appearance
    popup_type          TEXT DEFAULT 'MODAL',  
    -- MODAL, SLIDE_IN, FULL_SCREEN, TOP_BAR, BOTTOM_BAR
    
    position            TEXT DEFAULT 'CENTER',  
    -- CENTER, TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT
    
    width               TEXT DEFAULT '600px',
    max_height          TEXT DEFAULT '80vh',
    
    -- Animation
    entrance_animation  TEXT DEFAULT 'FADE_IN',  -- FADE_IN, SLIDE_UP, SLIDE_DOWN, ZOOM_IN
    exit_animation      TEXT DEFAULT 'FADE_OUT',
    animation_duration  INT DEFAULT 300,  -- ms
    
    -- Overlay
    show_overlay        BOOLEAN DEFAULT true,
    overlay_color       TEXT DEFAULT 'rgba(0,0,0,0.5)',
    close_on_overlay    BOOLEAN DEFAULT true,
    
    -- Close button
    show_close_button   BOOLEAN DEFAULT true,
    close_button_position TEXT DEFAULT 'TOP_RIGHT',
    
    -- Triggers
    triggers_json       JSONB DEFAULT '[]',
    -- [{type: "TIME_DELAY", value: 5000}]
    -- [{type: "SCROLL_PERCENT", value: 50}]
    -- [{type: "EXIT_INTENT"}]
    -- [{type: "CLICK", selector: "#promo-button"}]
    -- [{type: "PAGE_LOAD"}]
    -- [{type: "INACTIVITY", value: 30000}]
    
    -- Display conditions
    conditions_json     JSONB DEFAULT '[]',
    -- [{field: "page_type", operator: "equals", value: "PRODUCT"}]
    -- [{field: "user_logged_in", operator: "equals", value: true}]
    -- [{field: "device", operator: "in", value: ["mobile", "tablet"]}]
    
    -- Frequency
    frequency           TEXT DEFAULT 'ONCE_PER_SESSION',  
    -- EVERY_TIME, ONCE_PER_SESSION, ONCE_PER_DAY, ONCE_PER_WEEK, ONCE_EVER
    
    -- Scheduling
    start_date          TIMESTAMPTZ,
    end_date            TIMESTAMPTZ,
    
    -- Status
    is_active           BOOLEAN DEFAULT true,
    
    -- Scope
    scope               TEXT NOT NULL DEFAULT 'PLATFORM',
    seller_id           TEXT,
    
    -- Stats
    impressions         INT DEFAULT 0,
    closes              INT DEFAULT 0,
    conversions         INT DEFAULT 0,
    
    created_by_staff_id TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_popups_active ON studio_popups(is_active, scope);
CREATE INDEX IF NOT EXISTS idx_studio_popups_dates ON studio_popups(start_date, end_date);
```

### 1.6 Media Tables

```sql
-- =============================================================================
-- STUDIO MEDIA - Media library
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_media (
    id                  TEXT PRIMARY KEY,
    
    -- File info
    filename            TEXT NOT NULL,
    original_filename   TEXT NOT NULL,
    mime_type           TEXT NOT NULL,
    size_bytes          INT NOT NULL,
    
    -- URLs
    url                 TEXT NOT NULL,
    thumbnail_url       TEXT,
    
    -- Image dimensions
    width               INT,
    height              INT,
    focal_point_x       FLOAT,  -- 0.0 to 1.0
    focal_point_y       FLOAT,
    
    -- Metadata
    alt_text            TEXT,
    caption             TEXT,
    title               TEXT,
    
    -- Organization
    folder              TEXT DEFAULT 'uncategorized',
    tags                TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Scope
    scope               TEXT NOT NULL DEFAULT 'PLATFORM',
    seller_id           TEXT,
    
    -- Status
    is_public           BOOLEAN DEFAULT true,
    
    -- Uploader
    uploaded_by_staff_id TEXT,
    uploaded_by_user_id TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_media_folder ON studio_media(folder, scope);
CREATE INDEX IF NOT EXISTS idx_studio_media_type ON studio_media(mime_type);
CREATE INDEX IF NOT EXISTS idx_studio_media_tags ON studio_media USING GIN(tags);
```

### 1.7 Seller Store Tables

```sql
-- =============================================================================
-- STUDIO SELLER STORE SETTINGS - Per-seller customization
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_seller_store_settings (
    id                  TEXT PRIMARY KEY,
    seller_id           TEXT NOT NULL UNIQUE,
    
    -- Template
    template_id         TEXT REFERENCES studio_templates(id),
    
    -- Theme overrides (within allowed bounds)
    theme_overrides     JSONB DEFAULT '{}',
    -- {primary_color: "#FF0000", font_family: "Inter"}
    
    -- Branding
    banner_image_url    TEXT,
    logo_url            TEXT,
    favicon_url         TEXT,
    tagline             TEXT,
    
    -- Store pages enabled
    enabled_pages       TEXT[] DEFAULT ARRAY['home', 'about'],
    
    -- Custom CSS (limited)
    custom_css          TEXT,
    
    -- Feature flags
    customization_tier  TEXT DEFAULT 'BASIC',  -- BASIC, PRO, UNLIMITED
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_store ON studio_seller_store_settings(seller_id);


-- =============================================================================
-- STUDIO SELLER STORE PAGES - Seller-created pages
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_seller_store_pages (
    id                  TEXT PRIMARY KEY,
    seller_id           TEXT NOT NULL,
    
    -- Identity
    page_type           TEXT NOT NULL,  -- home, about, custom
    slug                TEXT,           -- For custom pages
    title               TEXT,
    
    -- Content (from template or custom)
    content             JSONB NOT NULL DEFAULT '{}',
    uses_template       BOOLEAN DEFAULT true,
    
    -- Status
    is_published        BOOLEAN DEFAULT false,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(seller_id, page_type)
);

CREATE INDEX IF NOT EXISTS idx_seller_pages ON studio_seller_store_pages(seller_id);
```

### 1.8 Settings & Permissions

```sql
-- =============================================================================
-- STUDIO SETTINGS - Module configuration
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_settings (
    id                  TEXT PRIMARY KEY DEFAULT 'singleton',
    
    -- Feature toggles
    enabled             BOOLEAN DEFAULT true,
    seller_stores_enabled BOOLEAN DEFAULT false,
    
    -- Limits
    max_pages           INT DEFAULT 1000,
    max_templates       INT DEFAULT 100,
    max_menus           INT DEFAULT 50,
    max_forms           INT DEFAULT 50,
    max_popups          INT DEFAULT 50,
    
    -- Seller store limits
    seller_max_pages    INT DEFAULT 2,
    seller_allowed_pages TEXT[] DEFAULT ARRAY['home', 'about'],
    seller_max_css_bytes INT DEFAULT 10000,
    
    -- Default settings
    default_page_template TEXT,
    default_header_id   TEXT,
    default_footer_id   TEXT,
    
    -- AI Features (future)
    ai_content_enabled  BOOLEAN DEFAULT false,
    ai_image_enabled    BOOLEAN DEFAULT false,
    ai_layout_enabled   BOOLEAN DEFAULT false,
    
    -- Global CSS
    global_custom_css   TEXT,
    global_head_code    TEXT,
    global_body_code    TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT single_row CHECK (id = 'singleton')
);

-- Initialize settings
INSERT INTO studio_settings (id) VALUES ('singleton') ON CONFLICT DO NOTHING;
```

---

## SECTION 2: PERMISSIONS

Studio 2.0 integrates with the platform RBAC system.

### 2.1 Platform Permissions (StaffUser)

```typescript
export const STUDIO_PLATFORM_PERMISSIONS = {
  moduleId: 'twicely-studio',
  permissions: [
    // Pages
    { code: 'studio.pages.view', name: 'View Studio pages', category: 'Studio' },
    { code: 'studio.pages.create', name: 'Create Studio pages', category: 'Studio' },
    { code: 'studio.pages.edit', name: 'Edit Studio pages', category: 'Studio' },
    { code: 'studio.pages.delete', name: 'Delete Studio pages', category: 'Studio' },
    { code: 'studio.pages.publish', name: 'Publish Studio pages', category: 'Studio' },
    
    // Templates
    { code: 'studio.templates.view', name: 'View templates', category: 'Studio' },
    { code: 'studio.templates.manage', name: 'Manage templates', category: 'Studio' },
    
    // Menus
    { code: 'studio.menus.view', name: 'View menus', category: 'Studio' },
    { code: 'studio.menus.manage', name: 'Manage menus', category: 'Studio' },
    
    // Forms
    { code: 'studio.forms.view', name: 'View forms', category: 'Studio' },
    { code: 'studio.forms.manage', name: 'Manage forms', category: 'Studio' },
    { code: 'studio.forms.submissions', name: 'View form submissions', category: 'Studio' },
    
    // Popups
    { code: 'studio.popups.view', name: 'View popups', category: 'Studio' },
    { code: 'studio.popups.manage', name: 'Manage popups', category: 'Studio' },
    
    // Theme Builder
    { code: 'studio.theme.view', name: 'View theme builder', category: 'Studio' },
    { code: 'studio.theme.manage', name: 'Manage theme builder', category: 'Studio' },
    
    // Media
    { code: 'studio.media.view', name: 'View media library', category: 'Studio' },
    { code: 'studio.media.upload', name: 'Upload media', category: 'Studio' },
    { code: 'studio.media.delete', name: 'Delete media', category: 'Studio' },
    
    // Settings
    { code: 'studio.settings.view', name: 'View Studio settings', category: 'Studio' },
    { code: 'studio.settings.manage', name: 'Manage Studio settings', category: 'Studio' },
    
    // Custom Code
    { code: 'studio.code.css', name: 'Edit custom CSS', category: 'Studio' },
    { code: 'studio.code.html', name: 'Edit custom HTML/JS', category: 'Studio' },
    
    // Help Articles (edit KB through Studio)
    { code: 'studio.help.edit', name: 'Edit help articles in Studio', category: 'Studio' },
  ],
} as const;
```

### 2.2 Seller Store Permissions (Feature-Flagged)

```typescript
export const STUDIO_SELLER_PERMISSIONS = {
  // These are granted to sellers based on their tier
  scopes: [
    'store.studio.view',      // View store customization
    'store.studio.edit',      // Edit store pages
    'store.studio.publish',   // Publish store changes
    'store.studio.branding',  // Change logo/banner
    'store.studio.theme',     // Change colors/fonts
  ],
} as const;
```

---

## SECTION 3: BLOCK LIBRARY (100 BLOCKS)

Studio 2.0 includes 100 high-quality blocks organized into 10 categories.

### 3.1 Block Architecture

Every block follows this structure:

```typescript
interface BlockDefinition {
  meta: {
    key: string;           // Unique identifier "ProductGrid"
    label: string;         // Display name "Product Grid"
    category: BlockCategory;
    description: string;
    icon: string;          // Lucide icon name
    keywords: string[];    // Search keywords
  };
  
  fields: BlockField[];    // Configuration fields
  
  defaultProps: Record<string, any>;
  
  // Data source for dynamic blocks
  dataSource?: {
    type: 'listings' | 'categories' | 'sellers' | 'reviews' | 'help' | 'orders';
    defaultQuery: DataQuery;
    inheritContext?: boolean;  // Auto-filter to seller context
  };
  
  // Style fields (universal)
  styleFields?: {
    spacing?: boolean;      // Margin/padding
    typography?: boolean;   // Font settings
    background?: boolean;   // Background options
    border?: boolean;       // Border & radius
    shadow?: boolean;       // Box shadow
    animation?: boolean;    // Entrance animations
    responsive?: boolean;   // Per-device settings
  };
  
  render: React.ComponentType<any>;
}
```

### 3.2 Category: LAYOUT (15 blocks)

| # | Block | Description | Key Props |
|---|-------|-------------|-----------|
| 1 | **Section** | Full-width container with background | backgroundColor, backgroundImage, overlay, minHeight, verticalAlign |
| 2 | **Container** | Content container with max-width | maxWidth, padding, centered |
| 3 | **Grid** | CSS Grid layout | columns, gap, rowGap, alignItems |
| 4 | **Columns** | Responsive column layout | columnWidths[], gap, stackOn |
| 5 | **Row** | Horizontal flex container | justifyContent, alignItems, gap, wrap |
| 6 | **Stack** | Vertical flex container | gap, alignItems |
| 7 | **Spacer** | Vertical spacing | height, responsiveHeights |
| 8 | **Divider** | Horizontal separator | style, color, width, margin |
| 9 | **SidebarLayout** | Content + sidebar | sidebarWidth, sidebarPosition, gap |
| 10 | **SplitLayout** | Two equal columns | gap, reverseOnMobile, verticalAlign |
| 11 | **MasonryGrid** | Pinterest-style grid | columns, gap |
| 12 | **Sticky** | Sticky positioned content | offsetTop, zIndex |
| 13 | **Anchor** | Page anchor target | anchorId |
| 14 | **TabContainer** | Tabbed content areas | tabs[], defaultTab |
| 15 | **Accordion** | Collapsible sections | items[], allowMultiple |

### 3.3 Category: CONTENT (20 blocks)

| # | Block | Description | Key Props |
|---|-------|-------------|-----------|
| 16 | **Heading** | H1-H6 with inline editing | level, text, textAlign, fontWeight |
| 17 | **Text** | Paragraph with inline editing | content, textAlign |
| 18 | **RichText** | Full WYSIWYG content | content |
| 19 | **Image** | Responsive image | src, alt, focalPoint, link, lightbox |
| 20 | **Gallery** | Image gallery | images[], columns, gap, lightbox |
| 21 | **Video** | YouTube/Vimeo/self-hosted | source, videoId, autoplay, loop |
| 22 | **Button** | CTA button | text, url, style, size, icon |
| 23 | **ButtonGroup** | Multiple buttons | buttons[], layout, gap |
| 24 | **Icon** | Lucide icon | icon, size, color |
| 25 | **IconBox** | Icon with text | icon, title, description, layout |
| 26 | **List** | Bullet/numbered/checklist | items[], listType, icon |
| 27 | **Quote** | Blockquote | quote, author, authorTitle, image |
| 28 | **Code** | Syntax-highlighted code | code, language, showLineNumbers |
| 29 | **Table** | Data table | headers[], rows[], striped |
| 30 | **Timeline** | Vertical timeline | items[], alternating |
| 31 | **Counter** | Animated number | value, prefix, suffix, duration |
| 32 | **Progress** | Progress bar | value, max, showLabel, color |
| 33 | **Embed** | oEmbed/iframe | url, aspectRatio |
| 34 | **Map** | Google/Mapbox map | lat, lng, zoom, markers[] |
| 35 | **SocialLinks** | Social media icons | platforms[], style, size |

### 3.4 Category: MARKETING (15 blocks)

| # | Block | Description | Key Props |
|---|-------|-------------|-----------|
| 36 | **Hero** | Full-width hero section | headline, subheadline, cta, backgroundType, minHeight |
| 37 | **Features** | Feature grid | headline, features[], columns, iconPosition |
| 38 | **CTA** | Call-to-action section | headline, description, buttons[], backgroundColor |
| 39 | **FAQ** | Accordion FAQ | headline, items[], schema (for SEO) |
| 40 | **Testimonials** | Customer testimonials | headline, testimonials[], layout, autoplay |
| 41 | **Stats** | Statistics display | stats[], layout, animated |
| 42 | **Pricing** | Pricing table | plans[], highlighted, features[] |
| 43 | **Team** | Team member grid | members[], columns, showSocial |
| 44 | **Clients** | Logo carousel | logos[], autoplay, grayscale |
| 45 | **Newsletter** | Email signup form | headline, description, formId, successMessage |
| 46 | **Announcement** | Top bar announcement | message, link, dismissible, backgroundColor |
| 47 | **Countdown** | Countdown timer | endDate, labels, expiredMessage |
| 48 | **Compare** | Feature comparison | products[], features[], highlighted |
| 49 | **BeforeAfter** | Image comparison slider | beforeImage, afterImage, orientation |
| 50 | **SocialProof** | Recent activity feed | activityType, count, autoRefresh |

### 3.5 Category: COMMERCE (20 blocks)

These blocks connect to LIVE platform data.

| # | Block | Description | Data Source | Key Props |
|---|-------|-------------|-------------|-----------|
| 51 | **ProductGrid** | Product listing grid | Listing | query, columns, showPrice, showRating, limit |
| 52 | **ProductCarousel** | Horizontal product slider | Listing | query, slidesToShow, autoplay |
| 53 | **ProductCard** | Single product display | Listing | listingId, showDescription, showButton |
| 54 | **CategoryGrid** | Category cards | Category | parentId, columns, showCount |
| 55 | **CategoryNav** | Category tree navigation | Category | rootId, maxDepth, style |
| 56 | **CategoryBanner** | Category hero | Category | categoryId, showDescription |
| 57 | **SellerCard** | Seller profile card | User/SellerProfile | sellerId, showStats, showFollow |
| 58 | **SellerGrid** | Grid of sellers | User | query, columns |
| 59 | **FeaturedProducts** | Featured items | Listing (isFeatured) | limit, layout |
| 60 | **SaleProducts** | Items on sale | Listing (hasDiscount) | limit, showOriginalPrice |
| 61 | **NewArrivals** | Recent listings | Listing (orderBy: createdAt) | limit, daysBack |
| 62 | **BestSellers** | Top selling items | Listing (orderBy: soldCount) | limit, timeframe |
| 63 | **RelatedProducts** | Related to current | Listing (related) | limit, basedOn |
| 64 | **RecentlyViewed** | User's history | Session/Cookies | limit |
| 65 | **QuickView** | Modal product preview | Listing | trigger, showAddToCart |
| 66 | **AddToCart** | Add to cart button | — | listingId, style, showQuantity |
| 67 | **WishlistButton** | Save to wishlist | — | listingId, style |
| 68 | **PriceDisplay** | Price with sale formatting | Listing | showOriginal, showDiscount |
| 69 | **StockBadge** | Stock status indicator | Listing | showQuantity, lowStockThreshold |
| 70 | **DealTimer** | Sale countdown | Promotion | promotionId, expiredAction |

### 3.6 Category: HELP/KNOWLEDGE (10 blocks)

These blocks integrate with the Helpdesk/KB system.

| # | Block | Description | Data Source | Key Props |
|---|-------|-------------|-------------|-----------|
| 71 | **HelpArticle** | Single KB article | KnowledgeBaseArticle | articleId, showRelated |
| 72 | **HelpCategory** | Article list by category | KnowledgeBaseArticle | categoryId, layout |
| 73 | **FAQFromKB** | FAQ from help articles | KnowledgeBaseArticle | categoryId, limit, showSearch |
| 74 | **HelpSearch** | KB search box | — | placeholder, showPopular |
| 75 | **ContactForm** | Support form → ticket | HelpdeskCase | formId, category, assignTeam |
| 76 | **HelpWidget** | Floating help button | — | position, showSearch, showPopular |
| 77 | **KnowledgeCards** | KB category cards | KnowledgeBaseCategory | columns, showCount |
| 78 | **HowItWorks** | Step-by-step guide | — | steps[], layout, showNumbers |
| 79 | **SupportCTA** | Contact support banner | — | headline, buttons[], showHours |
| 80 | **TicketStatus** | User's open tickets | HelpdeskCase | limit, showCreate |

### 3.7 Category: NAVIGATION (10 blocks)

| # | Block | Description | Key Props |
|---|-------|-------------|-----------|
| 81 | **MainMenu** | Primary navigation | menuId, style, mobileBreakpoint |
| 82 | **MegaMenu** | Mega menu dropdown | menuId, columns, showImages |
| 83 | **MobileMenu** | Mobile hamburger menu | menuId, position, animation |
| 84 | **CategoryMenu** | Category dropdown | rootId, maxDepth, showCounts |
| 85 | **Breadcrumbs** | Page breadcrumbs | separator, showHome, schema |
| 86 | **FooterMenu** | Footer link columns | menuIds[], columns |
| 87 | **SidebarMenu** | Vertical sidebar nav | menuId, collapsible |
| 88 | **BackToTop** | Scroll to top button | showAfter, position, style |
| 89 | **Pagination** | Page navigation | totalPages, currentPage, style |
| 90 | **LanguageSwitcher** | Language selector | languages[], style |

### 3.8 Category: USER/ACCOUNT (5 blocks)

| # | Block | Description | Key Props |
|---|-------|-------------|-----------|
| 91 | **LoginForm** | User login | redirectUrl, showSocial, showRegister |
| 92 | **RegisterForm** | User registration | redirectUrl, requiredFields[] |
| 93 | **UserMenu** | Logged-in user dropdown | showAvatar, menuItems[] |
| 94 | **Avatar** | User avatar | userId, size, showName, link |
| 95 | **AccountNav** | Account sidebar nav | menuItems[], showLogout |

### 3.9 Category: TRUST/REVIEWS (5 blocks)

| # | Block | Description | Data Source | Key Props |
|---|-------|-------------|-------------|-----------|
| 96 | **ReviewsGrid** | Review listing | Review | entityType, entityId, limit, showRating |
| 97 | **RatingDisplay** | Star rating | — | value, max, size, showCount |
| 98 | **TrustBadges** | Platform trust indicators | — | badges[], layout |
| 99 | **TestimonialCard** | Single testimonial | — | quote, author, image, rating |
| 100 | **GuaranteeBadge** | Guarantee/protection | — | type, title, description, icon |

---

## SECTION 4: UNIVERSAL STYLE FIELDS

Every block supports these style controls (Elementor parity).

### 4.1 Spacing Field

```typescript
interface SpacingFieldValue {
  margin: {
    top: string;
    right: string;
    bottom: string;
    left: string;
    linked: boolean;
  };
  padding: {
    top: string;
    right: string;
    bottom: string;
    left: string;
    linked: boolean;
  };
  // Responsive overrides
  tablet?: Partial<SpacingFieldValue>;
  mobile?: Partial<SpacingFieldValue>;
}
```

### 4.2 Typography Field

```typescript
interface TypographyFieldValue {
  fontFamily: string;      // 'Inter', 'system-ui', etc.
  fontSize: string;        // '16px', '1.2rem'
  fontWeight: string;      // '400', '700'
  lineHeight: string;      // '1.5', '24px'
  letterSpacing: string;   // '0.02em'
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration: 'none' | 'underline' | 'line-through';
  fontStyle: 'normal' | 'italic';
  color: string;
  
  tablet?: Partial<TypographyFieldValue>;
  mobile?: Partial<TypographyFieldValue>;
}
```

### 4.3 Background Field

```typescript
interface BackgroundFieldValue {
  type: 'none' | 'color' | 'gradient' | 'image' | 'video';
  
  color?: string;
  
  gradient?: {
    type: 'linear' | 'radial';
    angle: number;
    stops: { color: string; position: number }[];
  };
  
  image?: {
    url: string;
    position: string;       // 'center center'
    size: 'cover' | 'contain' | 'auto' | string;
    repeat: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
    attachment: 'scroll' | 'fixed';
  };
  
  video?: {
    url: string;
    fallbackImage: string;
  };
  
  overlay?: {
    enabled: boolean;
    color: string;
    opacity: number;
  };
}
```

### 4.4 Border Field

```typescript
interface BorderFieldValue {
  width: {
    top: string;
    right: string;
    bottom: string;
    left: string;
    linked: boolean;
  };
  style: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
  color: string;
  radius: {
    topLeft: string;
    topRight: string;
    bottomRight: string;
    bottomLeft: string;
    linked: boolean;
  };
}
```

### 4.5 Shadow Field

```typescript
interface ShadowFieldValue {
  type: 'none' | 'preset' | 'custom';
  preset?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  custom?: {
    x: string;
    y: string;
    blur: string;
    spread: string;
    color: string;
    inset: boolean;
  }[];
}
```

### 4.6 Animation Field

```typescript
interface AnimationFieldValue {
  entrance?: {
    type: 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom' | 'bounce';
    duration: number;      // ms
    delay: number;         // ms
    easing: string;        // 'ease-out'
  };
  
  hover?: {
    transform?: string;    // 'scale(1.05)'
    transition: string;    // '0.3s ease'
  };
  
  scroll?: {
    type: 'parallax' | 'fade' | 'none';
    speed?: number;
  };
}
```

---

## SECTION 5: DYNAMIC DATA BINDING

Marketplace blocks connect to live platform data.

### 5.1 Data Source Types

```typescript
type DataSourceType = 
  | 'listings'
  | 'categories'
  | 'sellers'
  | 'reviews'
  | 'help_articles'
  | 'help_categories'
  | 'orders'
  | 'promotions';

interface DataQuery {
  // Filters
  where?: {
    categoryId?: string | string[];
    sellerId?: string;
    status?: string;
    isFeatured?: boolean;
    isPromoted?: boolean;
    hasDiscount?: boolean;
    condition?: string[];
    priceMin?: number;
    priceMax?: number;
    tags?: string[];
  };
  
  // Sorting
  orderBy?: 
    | 'newest'
    | 'oldest'
    | 'price_asc'
    | 'price_desc'
    | 'popular'
    | 'rating'
    | 'random'
    | 'sold_count';
  
  // Pagination
  take?: number;
  skip?: number;
  
  // Context inheritance
  inheritSellerId?: boolean;  // Auto-filter to seller in store context
  inheritCategoryId?: boolean;
}
```

### 5.2 Context Provider

```typescript
// Server-side data resolution
interface StudioDataContext {
  // Current page context
  pageId?: string;
  pageType?: string;
  
  // Commerce context
  currentListing?: Listing;
  currentCategory?: Category;
  currentSeller?: User;
  
  // User context
  currentUser?: User;
  isLoggedIn: boolean;
  
  // Seller store context (when in seller store)
  sellerStoreId?: string;
  sellerStoreOwnerId?: string;
}
```

### 5.3 Block Data Resolution

```typescript
// Example: ProductGrid data resolution
async function resolveProductGridData(
  props: ProductGridProps,
  context: StudioDataContext
): Promise<Listing[]> {
  const query = { ...props.query };
  
  // Inherit seller context in seller stores
  if (props.inheritContext && context.sellerStoreOwnerId) {
    query.where = {
      ...query.where,
      sellerId: context.sellerStoreOwnerId,
    };
  }
  
  return prisma.listing.findMany({
    where: buildWhereClause(query.where),
    orderBy: buildOrderBy(query.orderBy),
    take: query.take ?? 12,
    include: {
      images: true,
      category: true,
      owner: { include: { sellerProfile: true } },
    },
  });
}
```

---

## SECTION 6: MENU SYSTEM

Full visual menu builder with mega menu support.

### 6.1 Menu Item Target Types

```typescript
type MenuItemTarget =
  // Pages
  | { type: 'PAGE'; pageId: string }
  | { type: 'URL'; url: string; external?: boolean }
  
  // Commerce
  | { type: 'CATEGORY'; categoryId: string }
  | { type: 'COLLECTION'; collectionId: string }
  | { type: 'SELLER'; sellerId: string }
  | { type: 'SEARCH'; defaultQuery?: string }
  | { type: 'SALE' }
  | { type: 'FEATURED' }
  | { type: 'NEW_ARRIVALS' }
  
  // Help
  | { type: 'HELP_CATEGORY'; categoryId: string }
  | { type: 'HELP_ARTICLE'; articleId: string }
  | { type: 'FAQ' }
  | { type: 'CONTACT' }
  
  // Account
  | { type: 'HOME' }
  | { type: 'CART' }
  | { type: 'WISHLIST' }
  | { type: 'ACCOUNT' }
  | { type: 'ORDERS' }
  | { type: 'LOGIN' }
  | { type: 'REGISTER' };
```

### 6.2 Mega Menu Content

Mega menus can contain any Puck blocks:

```typescript
interface MegaMenuItem extends MenuItem {
  hasMegaMenu: true;
  megaMenuContent: PuckData;  // Full Puck content
  megaMenuWidth: 'full' | 'auto' | string;  // '800px'
  megaMenuColumns?: number;
}
```

---

## SECTION 7: HELPDESK INTEGRATION

Studio edits help articles directly in the KnowledgeBaseArticle table.

### 7.1 Help Article Editing

When `page_type = 'HELP_ARTICLE'`:

```typescript
// Studio page links to KB article
interface StudioHelpPage extends StudioPage {
  pageType: 'HELP_ARTICLE';
  kbArticleId: string;  // Links to KnowledgeBaseArticle.id
}

// On save, update both tables:
async function saveHelpArticle(studioPage: StudioHelpPage) {
  // 1. Update studio_pages
  await prisma.$queryRaw`
    UPDATE studio_pages SET ... WHERE id = ${studioPage.id}
  `;
  
  // 2. Update knowledge_base_articles
  await prisma.knowledgeBaseArticle.update({
    where: { id: studioPage.kbArticleId },
    data: {
      title: studioPage.title,
      body: extractBodyFromPuckContent(studioPage.content),
      bodyFormat: 'HTML',  // Rendered from Puck
      metaTitle: studioPage.metaTitle,
      metaDescription: studioPage.metaDescription,
      status: studioPage.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      updatedAt: new Date(),
    },
  });
}
```

### 7.2 FAQ Block Data Source

```typescript
// FAQFromKB block pulls from knowledge base
interface FAQFromKBProps {
  categoryId?: string;
  limit?: number;
  showSearch?: boolean;
}

async function resolveFAQData(props: FAQFromKBProps) {
  return prisma.knowledgeBaseArticle.findMany({
    where: {
      categoryId: props.categoryId,
      isPublished: true,
      audience: { in: ['ALL', 'BUYER'] },  // Exclude AGENT_ONLY
    },
    orderBy: { sortOrder: 'asc' },
    take: props.limit ?? 10,
  });
}
```

---

## SECTION 8: SELLER STORE BUILDER

Feature-flagged seller store customization.

### 8.1 Feature Flag

```typescript
// Platform settings
const SELLER_STORES_ENABLED = await getStudioSetting('seller_stores_enabled');

// Per-seller tier
const SELLER_CUSTOMIZATION_TIERS = {
  BASIC: {
    canSelectTemplate: true,
    canCustomizeColors: true,
    canUploadBanner: true,
    canCreatePages: false,
    canUseBuilder: false,
    maxPages: 2,
    allowedPages: ['home', 'about'],
  },
  PRO: {
    canSelectTemplate: true,
    canCustomizeColors: true,
    canUploadBanner: true,
    canCreatePages: true,
    canUseBuilder: false,
    maxPages: 5,
    allowedPages: ['home', 'about', 'policies', 'custom'],
  },
  UNLIMITED: {
    canSelectTemplate: true,
    canCustomizeColors: true,
    canUploadBanner: true,
    canCreatePages: true,
    canUseBuilder: true,  // Limited blocks
    maxPages: 50,
    allowedPages: ['home', 'about', 'policies', 'custom'],
    availableBlocks: [
      'Heading', 'Text', 'Image', 'Gallery', 'Video', 
      'Button', 'ProductGrid', 'ProductCarousel',
      'CategoryGrid', 'Testimonials', 'FAQ'
    ],
  },
};
```

### 8.2 Context Isolation

Seller store blocks automatically filter to seller's data:

```typescript
// In seller store context
function SellerStoreDataProvider({ sellerId, children }) {
  return (
    <StudioDataContext.Provider value={{
      sellerStoreOwnerId: sellerId,
      // All ProductGrid, etc. blocks will auto-filter
    }}>
      {children}
    </StudioDataContext.Provider>
  );
}
```

### 8.3 Locked Chrome

Sellers CANNOT modify platform header/footer:

```typescript
// In seller store editor
const LOCKED_GLOBALS = ['PLATFORM_HEADER', 'PLATFORM_FOOTER'];

function SellerStoreEditor({ sellerId }) {
  // Seller sees platform header/footer as read-only chrome
  // Can only edit content zones within their store
}
```

---

## SECTION 9: CUSTOM CSS

Full custom CSS support like WordPress.

### 9.1 CSS Levels

```
CSS PRIORITY (lowest to highest):
1. Global platform CSS (studio_settings.global_custom_css)
2. Template CSS (studio_templates.custom_css)  
3. Page CSS (studio_pages.custom_css)
4. Block inline styles
5. Block custom CSS (per-block custom_css field)
```

### 9.2 Custom Code Fields

```sql
-- Each block can have custom CSS
ALTER TABLE studio_pages ADD COLUMN blocks_css_json JSONB;
-- {"block_id_123": ".custom-class { color: red; }"}
```

### 9.3 CSS Editor in Studio

```typescript
// Custom CSS field in block inspector
interface CustomCSSField {
  type: 'css';
  label: 'Custom CSS';
  helpText: 'Use .this to target this block';
}

// Rendered with unique class
<div className={`studio-block-${blockId} ${customClass}`}>
  {/* Block content */}
</div>
```

---

## SECTION 10: INSTALL/UNINSTALL

Self-contained module installation.

### 10.1 Install Script

```typescript
// modules/twicely-studio/install.ts

export async function install(ctx: ModuleContext): Promise<InstallResult> {
  const results: string[] = [];
  
  // 1. Run SQL migrations
  await ctx.db.raw(fs.readFileSync('./migrations/001_create_studio_tables.sql'));
  results.push('Database tables created');
  
  // 2. Register permissions
  await ctx.rbac.registerPermissions(STUDIO_PLATFORM_PERMISSIONS);
  results.push('Permissions registered');
  
  // 3. Seed default templates
  await seedDefaultTemplates(ctx.db);
  results.push('Default templates seeded');
  
  // 4. Seed default globals (header/footer)
  await seedDefaultGlobals(ctx.db);
  results.push('Default globals created');
  
  // 5. Register health provider
  await ctx.health.registerProvider(studioHealthProvider);
  results.push('Health provider registered');
  
  // 6. Add nav items
  await ctx.nav.registerItems([
    { area: 'corp', section: 'content', key: 'studio', label: 'Studio', href: '/corp/studio', icon: 'PenTool' },
  ]);
  results.push('Navigation updated');
  
  return { success: true, results };
}
```

### 10.2 Uninstall Script

```typescript
// modules/twicely-studio/uninstall.ts

export async function uninstall(
  ctx: ModuleContext, 
  options: { purgeData?: boolean } = {}
): Promise<UninstallResult> {
  const results: string[] = [];
  
  // 1. Remove nav items
  await ctx.nav.unregisterItems(['studio']);
  results.push('Navigation removed');
  
  // 2. Unregister health provider
  await ctx.health.unregisterProvider('twicely-studio');
  results.push('Health provider removed');
  
  // 3. Optionally purge data
  if (options.purgeData) {
    await ctx.db.raw(`
      DROP TABLE IF EXISTS studio_form_submissions CASCADE;
      DROP TABLE IF EXISTS studio_menu_items CASCADE;
      DROP TABLE IF EXISTS studio_menus CASCADE;
      DROP TABLE IF EXISTS studio_popups CASCADE;
      DROP TABLE IF EXISTS studio_forms CASCADE;
      DROP TABLE IF EXISTS studio_template_conditions CASCADE;
      DROP TABLE IF EXISTS studio_templates CASCADE;
      DROP TABLE IF EXISTS studio_page_revisions CASCADE;
      DROP TABLE IF EXISTS studio_globals CASCADE;
      DROP TABLE IF EXISTS studio_media CASCADE;
      DROP TABLE IF EXISTS studio_seller_store_pages CASCADE;
      DROP TABLE IF EXISTS studio_seller_store_settings CASCADE;
      DROP TABLE IF EXISTS studio_settings CASCADE;
      DROP TABLE IF EXISTS studio_pages CASCADE;
    `);
    results.push('All data purged');
  }
  
  return { success: true, results };
}
```

---

## SECTION 11: HEALTH PROVIDER

Studio integrates with platform health system.

```typescript
// modules/twicely-studio/src/health/provider.ts

export const studioHealthProvider: HealthProvider = {
  domain: 'twicely-studio',
  name: 'Twicely Studio',
  
  async check(): Promise<HealthCheckResult[]> {
    return [
      await checkDatabaseTables(),
      await checkPagesCount(),
      await checkTemplatesExist(),
      await checkGlobalsExist(),
      await checkPermissionsRegistered(),
    ];
  },
};

async function checkDatabaseTables(): Promise<HealthCheckResult> {
  const required = [
    'studio_pages', 'studio_page_revisions', 'studio_globals',
    'studio_templates', 'studio_menus', 'studio_menu_items',
    'studio_forms', 'studio_form_submissions', 'studio_popups',
    'studio_media', 'studio_settings',
  ];
  
  const missing = [];
  for (const table of required) {
    const exists = await checkTableExists(table);
    if (!exists) missing.push(table);
  }
  
  return {
    name: 'Database Tables',
    status: missing.length === 0 ? 'HEALTHY' : 'UNHEALTHY',
    message: missing.length === 0 
      ? 'All tables exist' 
      : `Missing: ${missing.join(', ')}`,
  };
}
```

---

## SECTION 12: API ROUTES

Studio API endpoints.

### 12.1 Pages API

```
GET    /api/corp/studio/pages              List pages
POST   /api/corp/studio/pages              Create page
GET    /api/corp/studio/pages/:id          Get page
PATCH  /api/corp/studio/pages/:id          Update page
DELETE /api/corp/studio/pages/:id          Delete page
POST   /api/corp/studio/pages/:id/publish  Publish page
POST   /api/corp/studio/pages/:id/revert   Revert to revision
```

### 12.2 Templates API

```
GET    /api/corp/studio/templates          List templates
POST   /api/corp/studio/templates          Create template
GET    /api/corp/studio/templates/:id      Get template
PATCH  /api/corp/studio/templates/:id      Update template
DELETE /api/corp/studio/templates/:id      Delete template
```

### 12.3 Menus API

```
GET    /api/corp/studio/menus              List menus
POST   /api/corp/studio/menus              Create menu
GET    /api/corp/studio/menus/:id          Get menu with items
PATCH  /api/corp/studio/menus/:id          Update menu
DELETE /api/corp/studio/menus/:id          Delete menu
POST   /api/corp/studio/menus/:id/items    Add menu item
PATCH  /api/corp/studio/menus/items/:id    Update menu item
DELETE /api/corp/studio/menus/items/:id    Delete menu item
POST   /api/corp/studio/menus/:id/reorder  Reorder items
```

### 12.4 Forms API

```
GET    /api/corp/studio/forms              List forms
POST   /api/corp/studio/forms              Create form
GET    /api/corp/studio/forms/:id          Get form
PATCH  /api/corp/studio/forms/:id          Update form
DELETE /api/corp/studio/forms/:id          Delete form
GET    /api/corp/studio/forms/:id/submissions  Get submissions
POST   /api/studio/forms/:id/submit        Submit form (public)
```

### 12.5 Public Page Rendering

```
GET    /[...slug]                          Render Studio page (public)
GET    /api/studio/page/:slug              Get page data (for SPA)
```

---

## SECTION 13: UI PAGES

Admin pages for Studio.

### 13.1 Route Structure

```
/corp/studio                     Dashboard
/corp/studio/pages               Pages list
/corp/studio/pages/new           Create page
/corp/studio/pages/:id           Edit page (visual editor)
/corp/studio/templates           Templates list
/corp/studio/templates/:id       Edit template
/corp/studio/menus               Menus list
/corp/studio/menus/:id           Edit menu
/corp/studio/forms               Forms list
/corp/studio/forms/:id           Edit form
/corp/studio/forms/:id/submissions  View submissions
/corp/studio/popups              Popups list
/corp/studio/popups/:id          Edit popup
/corp/studio/theme               Theme builder
/corp/studio/theme/header        Edit header
/corp/studio/theme/footer        Edit footer
/corp/studio/media               Media library
/corp/studio/settings            Module settings
```

---

## REMINDERS 🔔

> **After Studio 2.0 is built:** Discuss **Default Store Page Editor** (core eBay-style feature, separate from Studio module)

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Foundation
- [ ] Create SQL migrations
- [ ] Implement install/uninstall scripts
- [ ] Register permissions
- [ ] Set up health provider
- [ ] Create API routes (CRUD)

### Phase 2: Editor Core
- [ ] Integrate Puck editor
- [ ] Implement 100 blocks (definitions + components)
- [ ] Add universal style fields
- [ ] Implement responsive controls

### Phase 3: Features
- [ ] Template system
- [ ] Menu builder
- [ ] Form builder
- [ ] Popup builder
- [ ] Theme builder (header/footer)

### Phase 4: Data Integration
- [ ] Dynamic data binding for commerce blocks
- [ ] Helpdesk/KB integration
- [ ] Context providers

### Phase 5: Seller Stores
- [ ] Feature flag implementation
- [ ] Seller store settings
- [ ] Template selection
- [ ] Context isolation

### Phase 6: Polish
- [ ] Custom CSS system
- [ ] Revisions/versioning
- [ ] SEO fields
- [ ] Media library integration

---

## TOTAL SCOPE

| Component | Count |
|-----------|-------|
| Database Tables | 14 |
| Blocks | 100 |
| Style Fields | 6 |
| API Endpoints | ~40 |
| Admin Pages | 15 |
| Permissions | 20 |

**This is the definitive CMS + Page Builder. Better than WordPress. Better than Elementor. Nothing missing.**

---

# PART 4-7: ADVANCED CMS FEATURES


## ADDENDUM A: CUSTOM POST TYPES (CPT) SYSTEM

WordPress's killer feature — user-definable content types.

### A.1 CPT Registry Table

```sql
-- =============================================================================
-- STUDIO POST TYPES - Custom Post Type definitions
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_post_types (
    id                  TEXT PRIMARY KEY,
    
    -- Identity
    slug                TEXT UNIQUE NOT NULL,  -- "event", "portfolio", "testimonial"
    singular_name       TEXT NOT NULL,          -- "Event"
    plural_name         TEXT NOT NULL,          -- "Events"
    description         TEXT,
    
    -- UI Settings
    menu_icon           TEXT DEFAULT 'file-text',  -- Lucide icon
    menu_position       INT DEFAULT 20,
    show_in_menu        BOOLEAN DEFAULT true,
    
    -- Capabilities
    is_hierarchical     BOOLEAN DEFAULT false,  -- Like pages (true) or posts (false)
    has_archive         BOOLEAN DEFAULT true,   -- /events/ archive page
    supports            TEXT[] DEFAULT ARRAY['title', 'content', 'thumbnail', 'excerpt', 'revisions'],
    -- Options: title, content, thumbnail, excerpt, revisions, author, comments, custom-fields
    
    -- URL Structure
    rewrite_slug        TEXT,  -- Custom URL base (defaults to slug)
    with_front          BOOLEAN DEFAULT true,
    
    -- Templates
    single_template_id  TEXT REFERENCES studio_templates(id),
    archive_template_id TEXT REFERENCES studio_templates(id),
    
    -- Taxonomies
    taxonomies          TEXT[] DEFAULT ARRAY[]::TEXT[],  -- ["category", "post_tag", "event_type"]
    
    -- Status
    is_system           BOOLEAN DEFAULT false,  -- Built-in CPTs cannot be deleted
    is_active           BOOLEAN DEFAULT true,
    
    -- Author
    created_by_staff_id TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_post_types_active ON studio_post_types(is_active, menu_position);
```

### A.2 Built-in Post Types

```typescript
const BUILT_IN_POST_TYPES = [
  {
    slug: 'page',
    singularName: 'Page',
    pluralName: 'Pages',
    isHierarchical: true,
    hasArchive: false,
    supports: ['title', 'content', 'thumbnail', 'excerpt', 'revisions', 'custom-fields'],
    isSystem: true,
  },
  {
    slug: 'post',
    singularName: 'Post',
    pluralName: 'Posts',
    isHierarchical: false,
    hasArchive: true,
    supports: ['title', 'content', 'thumbnail', 'excerpt', 'revisions', 'author', 'comments'],
    taxonomies: ['category', 'post_tag'],
    isSystem: true,
  },
  {
    slug: 'help_article',
    singularName: 'Help Article',
    pluralName: 'Help Articles',
    isHierarchical: false,
    hasArchive: true,
    supports: ['title', 'content', 'excerpt', 'revisions'],
    taxonomies: ['help_category'],
    isSystem: true,
  },
];
```

### A.3 CPT Admin UI

```
/corp/studio/post-types              List CPTs
/corp/studio/post-types/new          Create CPT
/corp/studio/post-types/:slug        Edit CPT
/corp/studio/post-types/:slug/items  List items of this type
```

---

## ADDENDUM B: TAXONOMY SYSTEM

Categories, Tags, and Custom Taxonomies.

### B.1 Taxonomy Registry Table

```sql
-- =============================================================================
-- STUDIO TAXONOMIES - Taxonomy definitions
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_taxonomies (
    id                  TEXT PRIMARY KEY,
    
    -- Identity
    slug                TEXT UNIQUE NOT NULL,  -- "category", "post_tag", "event_type"
    singular_name       TEXT NOT NULL,          -- "Category"
    plural_name         TEXT NOT NULL,          -- "Categories"
    description         TEXT,
    
    -- Type
    is_hierarchical     BOOLEAN DEFAULT true,  -- Categories (true) vs Tags (false)
    
    -- Associated Post Types
    post_types          TEXT[] DEFAULT ARRAY['post'],  -- ["post", "event"]
    
    -- UI Settings
    show_in_menu        BOOLEAN DEFAULT true,
    show_admin_column   BOOLEAN DEFAULT true,
    show_tag_cloud      BOOLEAN DEFAULT true,
    
    -- URL Structure
    rewrite_slug        TEXT,
    with_front          BOOLEAN DEFAULT true,
    
    -- Archive template
    archive_template_id TEXT REFERENCES studio_templates(id),
    
    -- Status
    is_system           BOOLEAN DEFAULT false,
    is_active           BOOLEAN DEFAULT true,
    
    created_by_staff_id TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_taxonomies_active ON studio_taxonomies(is_active);


-- =============================================================================
-- STUDIO TERMS - Taxonomy terms (categories, tags, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_terms (
    id                  TEXT PRIMARY KEY,
    
    taxonomy_id         TEXT NOT NULL REFERENCES studio_taxonomies(id) ON DELETE CASCADE,
    
    -- Identity
    slug                TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    
    -- Hierarchy (for hierarchical taxonomies)
    parent_id           TEXT REFERENCES studio_terms(id) ON DELETE SET NULL,
    
    -- Display
    image_url           TEXT,
    sort_order          INT DEFAULT 0,
    
    -- SEO
    meta_title          TEXT,
    meta_description    TEXT,
    
    -- Stats (cached)
    count               INT DEFAULT 0,  -- Number of posts with this term
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(taxonomy_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_studio_terms_taxonomy ON studio_terms(taxonomy_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_studio_terms_parent ON studio_terms(parent_id);


-- =============================================================================
-- STUDIO PAGE TERMS - Page-to-term relationships
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_page_terms (
    id                  TEXT PRIMARY KEY,
    page_id             TEXT NOT NULL REFERENCES studio_pages(id) ON DELETE CASCADE,
    term_id             TEXT NOT NULL REFERENCES studio_terms(id) ON DELETE CASCADE,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(page_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_page_terms_page ON studio_page_terms(page_id);
CREATE INDEX IF NOT EXISTS idx_page_terms_term ON studio_page_terms(term_id);
```

### B.2 Built-in Taxonomies

```typescript
const BUILT_IN_TAXONOMIES = [
  {
    slug: 'category',
    singularName: 'Category',
    pluralName: 'Categories',
    isHierarchical: true,
    postTypes: ['post'],
    isSystem: true,
  },
  {
    slug: 'post_tag',
    singularName: 'Tag',
    pluralName: 'Tags',
    isHierarchical: false,
    postTypes: ['post'],
    isSystem: true,
  },
  {
    slug: 'help_category',
    singularName: 'Help Category',
    pluralName: 'Help Categories',
    isHierarchical: true,
    postTypes: ['help_article'],
    isSystem: true,
  },
];
```

---

## ADDENDUM C: GLOBAL WIDGETS (REUSABLE BLOCKS)

Elementor's "Global Widgets" — edit once, update everywhere.

### C.1 Global Widget Table

```sql
-- =============================================================================
-- STUDIO GLOBAL WIDGETS - Reusable block instances
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_global_widgets (
    id                  TEXT PRIMARY KEY,
    
    -- Identity
    name                TEXT NOT NULL,
    description         TEXT,
    
    -- Content (Puck block definition)
    block_type          TEXT NOT NULL,  -- "Hero", "CTA", "ProductGrid"
    block_props         JSONB NOT NULL, -- Full props config
    
    -- Categories
    category            TEXT,
    tags                TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Usage tracking
    usage_count         INT DEFAULT 0,  -- How many pages use this
    
    -- Status
    is_active           BOOLEAN DEFAULT true,
    
    -- Scope
    scope               TEXT NOT NULL DEFAULT 'PLATFORM',
    seller_id           TEXT,
    
    created_by_staff_id TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_widgets_category ON studio_global_widgets(category, is_active);


-- =============================================================================
-- STUDIO GLOBAL WIDGET USAGE - Track where globals are used
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_global_widget_usage (
    id                  TEXT PRIMARY KEY,
    global_widget_id    TEXT NOT NULL REFERENCES studio_global_widgets(id) ON DELETE CASCADE,
    page_id             TEXT NOT NULL REFERENCES studio_pages(id) ON DELETE CASCADE,
    
    -- Position info (for reference)
    block_path          TEXT,  -- Path in Puck content tree
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(global_widget_id, page_id, block_path)
);

CREATE INDEX IF NOT EXISTS idx_global_usage ON studio_global_widget_usage(global_widget_id);
```

### C.2 Global Widget Behavior

```typescript
// When a global widget is used in a page, it's stored as a reference
interface GlobalWidgetReference {
  type: 'global_widget';
  globalWidgetId: string;
  // No props — inherits from global
}

// When global is updated, all usages automatically reflect changes
async function updateGlobalWidget(id: string, newProps: any) {
  await prisma.studioGlobalWidgets.update({
    where: { id },
    data: { blockProps: newProps },
  });
  
  // Increment version to bust caches
  // No need to update pages — they reference by ID
}

// Rendering resolves the reference
async function renderGlobalWidget(ref: GlobalWidgetReference) {
  const global = await prisma.studioGlobalWidgets.findUnique({
    where: { id: ref.globalWidgetId },
  });
  
  return {
    type: global.blockType,
    props: global.blockProps,
  };
}
```

### C.3 Unlinking a Global

```typescript
// User can "unlink" a global to make it a regular block
async function unlinkGlobalWidget(pageId: string, blockPath: string) {
  const page = await prisma.studioPages.findUnique({ where: { id: pageId } });
  const content = page.content;
  
  // Find the global reference and replace with actual content
  const global = await findGlobalAtPath(content, blockPath);
  const resolvedBlock = await resolveGlobalWidget(global);
  
  // Update page content with resolved block
  const newContent = replaceBlockAtPath(content, blockPath, resolvedBlock);
  
  await prisma.studioPages.update({
    where: { id: pageId },
    data: { content: newContent },
  });
  
  // Remove usage tracking
  await prisma.studioGlobalWidgetUsage.delete({
    where: { globalWidgetId_pageId_blockPath: { ... } },
  });
}
```

---

## ADDENDUM D: DESIGN TOKENS / GLOBAL STYLES

Elementor's "Global Colors" and "Global Fonts".

### D.1 Design Tokens Table

```sql
-- =============================================================================
-- STUDIO DESIGN TOKENS - Global colors, fonts, spacing scales
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_design_tokens (
    id                  TEXT PRIMARY KEY DEFAULT 'singleton',
    
    -- Colors
    colors              JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "primary": {"name": "Primary", "value": "#3B82F6"},
    --   "secondary": {"name": "Secondary", "value": "#10B981"},
    --   "text": {"name": "Text", "value": "#1F2937"},
    --   "text-light": {"name": "Text Light", "value": "#6B7280"},
    --   "background": {"name": "Background", "value": "#FFFFFF"},
    --   "surface": {"name": "Surface", "value": "#F9FAFB"},
    --   ...
    -- }
    
    -- Typography
    fonts               JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "primary": {"name": "Primary", "family": "Inter", "fallback": "system-ui, sans-serif"},
    --   "secondary": {"name": "Secondary", "family": "Merriweather", "fallback": "Georgia, serif"},
    --   "mono": {"name": "Monospace", "family": "JetBrains Mono", "fallback": "monospace"}
    -- }
    
    -- Typography Presets
    typography_presets  JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "h1": {"fontSize": "3rem", "fontWeight": "700", "lineHeight": "1.2", "fontFamily": "primary"},
    --   "h2": {"fontSize": "2.25rem", "fontWeight": "600", "lineHeight": "1.3", "fontFamily": "primary"},
    --   "body": {"fontSize": "1rem", "fontWeight": "400", "lineHeight": "1.6", "fontFamily": "primary"},
    --   "caption": {"fontSize": "0.875rem", "fontWeight": "400", "lineHeight": "1.4", "fontFamily": "primary"}
    -- }
    
    -- Spacing Scale
    spacing             JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "xs": "0.25rem",
    --   "sm": "0.5rem",
    --   "md": "1rem",
    --   "lg": "1.5rem",
    --   "xl": "2rem",
    --   "2xl": "3rem",
    --   "3xl": "4rem"
    -- }
    
    -- Border Radius Scale
    radii               JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "none": "0",
    --   "sm": "0.25rem",
    --   "md": "0.5rem",
    --   "lg": "1rem",
    --   "xl": "1.5rem",
    --   "full": "9999px"
    -- }
    
    -- Shadows
    shadows             JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    --   "md": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    --   "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1)",
    --   "xl": "0 20px 25px -5px rgb(0 0 0 / 0.1)"
    -- }
    
    -- Breakpoints
    breakpoints         JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "mobile": {"max": 639},
    --   "tablet": {"min": 640, "max": 1023},
    --   "desktop": {"min": 1024}
    -- }
    
    -- Scope
    scope               TEXT NOT NULL DEFAULT 'PLATFORM',
    seller_id           TEXT,
    
    updated_by_staff_id TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT single_row_per_scope CHECK (
        (scope = 'PLATFORM' AND seller_id IS NULL) OR
        (scope = 'SELLER_STORE' AND seller_id IS NOT NULL)
    )
);

-- Default platform tokens
INSERT INTO studio_design_tokens (id, scope) VALUES ('singleton', 'PLATFORM') ON CONFLICT DO NOTHING;
```

### D.2 Using Design Tokens in Blocks

```typescript
// Token reference in block props
interface ColorValue {
  type: 'token' | 'custom';
  token?: string;  // "primary", "secondary"
  custom?: string; // "#FF0000"
}

// Example block prop
interface ButtonProps {
  text: string;
  backgroundColor: ColorValue;
  textColor: ColorValue;
  // ...
}

// Rendering resolves tokens
async function resolveTokens(props: any, tokens: DesignTokens) {
  return traverse(props, (value) => {
    if (value?.type === 'token') {
      return tokens.colors[value.token]?.value || value.custom;
    }
    return value;
  });
}
```

### D.3 Design Token UI

```
/corp/studio/settings/design-tokens  Design tokens editor

Features:
- Color palette editor with preview
- Font family selector (Google Fonts + custom)
- Typography preset builder
- Spacing scale configurator
- Live preview across site
```

---

## ADDENDUM E: COMMENTS & DISCUSSIONS

WordPress-style comment system for posts.

### E.1 Comments Table

```sql
-- =============================================================================
-- STUDIO COMMENTS - User comments on pages/posts
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_comments (
    id                  TEXT PRIMARY KEY,
    
    -- Target
    page_id             TEXT NOT NULL REFERENCES studio_pages(id) ON DELETE CASCADE,
    
    -- Author
    user_id             TEXT,  -- Null for guest comments
    author_name         TEXT NOT NULL,
    author_email        TEXT NOT NULL,
    author_url          TEXT,
    author_ip           TEXT,
    author_user_agent   TEXT,
    
    -- Content
    content             TEXT NOT NULL,
    
    -- Hierarchy (threaded comments)
    parent_id           TEXT REFERENCES studio_comments(id) ON DELETE CASCADE,
    depth               INT DEFAULT 0,
    
    -- Status
    status              TEXT DEFAULT 'PENDING',  -- PENDING, APPROVED, SPAM, TRASH
    
    -- Moderation
    moderated_at        TIMESTAMPTZ,
    moderated_by_staff_id TEXT,
    moderation_note     TEXT,
    
    -- Engagement
    likes_count         INT DEFAULT 0,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_page ON studio_comments(page_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON studio_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON studio_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON studio_comments(status);


-- =============================================================================
-- STUDIO COMMENT SETTINGS - Per-page comment settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_comment_settings (
    id                  TEXT PRIMARY KEY,
    page_id             TEXT UNIQUE NOT NULL REFERENCES studio_pages(id) ON DELETE CASCADE,
    
    comments_enabled    BOOLEAN DEFAULT true,
    moderation_required BOOLEAN DEFAULT true,  -- Hold for approval
    allow_guests        BOOLEAN DEFAULT false,
    max_depth           INT DEFAULT 3,         -- Thread depth
    order_by            TEXT DEFAULT 'newest', -- newest, oldest, popular
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### E.2 Comment Blocks

Add to block library:

```typescript
// Block #101: Comment Form
{
  key: 'CommentForm',
  label: 'Comment Form',
  category: 'user',
  props: {
    pageId: { type: 'string', dynamic: true },
    showNameField: { type: 'boolean', default: true },
    showEmailField: { type: 'boolean', default: true },
    showUrlField: { type: 'boolean', default: false },
    submitButtonText: { type: 'string', default: 'Post Comment' },
  },
}

// Block #102: Comments List
{
  key: 'CommentsList',
  label: 'Comments List',
  category: 'user',
  dataSource: { type: 'comments' },
  props: {
    pageId: { type: 'string', dynamic: true },
    showReplies: { type: 'boolean', default: true },
    showAvatar: { type: 'boolean', default: true },
    allowReplies: { type: 'boolean', default: true },
    orderBy: { type: 'select', options: ['newest', 'oldest', 'popular'] },
  },
}
```

---

## ADDENDUM F: LOOP BUILDER

Elementor's "Loop Builder" — custom layouts for dynamic content.

### F.1 Loop Template Table

```sql
-- =============================================================================
-- STUDIO LOOP TEMPLATES - Custom item templates for lists/grids
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_loop_templates (
    id                  TEXT PRIMARY KEY,
    
    -- Identity
    slug                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    thumbnail_url       TEXT,
    
    -- Content (Puck item template)
    content             JSONB NOT NULL DEFAULT '{}',
    
    -- Data source this works with
    data_source_type    TEXT NOT NULL,  -- listings, posts, sellers, reviews
    
    -- Skin/variant
    skin                TEXT DEFAULT 'card',  -- card, list, minimal, full
    
    -- Status
    is_active           BOOLEAN DEFAULT true,
    
    created_by_staff_id TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### F.2 Loop Block

Add to block library:

```typescript
// Block #103: Loop
{
  key: 'Loop',
  label: 'Loop',
  category: 'layout',
  description: 'Display dynamic content with a custom item template',
  props: {
    // Data source
    dataSource: {
      type: 'data_source',
      options: ['listings', 'posts', 'sellers', 'reviews', 'terms'],
    },
    query: { type: 'query_builder' },
    
    // Template
    loopTemplateId: { type: 'loop_template_selector' },
    // OR inline template:
    inlineTemplate: { type: 'puck_content' },
    
    // Layout
    layout: {
      type: 'select',
      options: ['grid', 'list', 'carousel', 'masonry'],
      default: 'grid',
    },
    columns: { type: 'responsive_number', default: { desktop: 3, tablet: 2, mobile: 1 } },
    gap: { type: 'spacing', default: '1.5rem' },
    
    // Pagination
    pagination: { type: 'boolean', default: true },
    itemsPerPage: { type: 'number', default: 12 },
    paginationType: { type: 'select', options: ['numbered', 'load_more', 'infinite'] },
    
    // Empty state
    emptyMessage: { type: 'string', default: 'No items found' },
    showEmptyState: { type: 'boolean', default: true },
  },
}
```

### F.3 Loop Item Dynamic Tags

Within a loop template, these dynamic tags are available:

```typescript
const LOOP_DYNAMIC_TAGS = {
  // For listings
  listings: [
    '{{item.title}}',
    '{{item.price}}',
    '{{item.salePrice}}',
    '{{item.primaryImage}}',
    '{{item.description}}',
    '{{item.category.name}}',
    '{{item.seller.displayName}}',
    '{{item.condition}}',
    '{{item.url}}',
  ],
  
  // For posts
  posts: [
    '{{item.title}}',
    '{{item.excerpt}}',
    '{{item.content}}',
    '{{item.thumbnail}}',
    '{{item.author.name}}',
    '{{item.publishedAt}}',
    '{{item.categories}}',
    '{{item.tags}}',
    '{{item.url}}',
  ],
  
  // For sellers
  sellers: [
    '{{item.displayName}}',
    '{{item.avatarUrl}}',
    '{{item.rating}}',
    '{{item.listingsCount}}',
    '{{item.salesCount}}',
    '{{item.memberSince}}',
    '{{item.url}}',
  ],
};
```

---

## ADDENDUM G: MULTI-LANGUAGE (i18n)

Internationalization support.

### G.1 Locale Table

```sql
-- =============================================================================
-- STUDIO LOCALES - Enabled languages
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_locales (
    id                  TEXT PRIMARY KEY,
    
    code                TEXT UNIQUE NOT NULL,  -- "en-US", "es-ES", "fr-FR"
    name                TEXT NOT NULL,          -- "English (US)"
    native_name         TEXT,                   -- "English"
    
    is_default          BOOLEAN DEFAULT false,
    is_active           BOOLEAN DEFAULT true,
    
    -- RTL support
    is_rtl              BOOLEAN DEFAULT false,
    
    -- Fallback
    fallback_locale     TEXT REFERENCES studio_locales(code),
    
    sort_order          INT DEFAULT 0,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_locales_default ON studio_locales(is_default) WHERE is_default = true;


-- =============================================================================
-- STUDIO PAGE TRANSLATIONS - Translated page content
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_page_translations (
    id                  TEXT PRIMARY KEY,
    
    page_id             TEXT NOT NULL REFERENCES studio_pages(id) ON DELETE CASCADE,
    locale_code         TEXT NOT NULL REFERENCES studio_locales(code) ON DELETE CASCADE,
    
    -- Translated content
    title               TEXT NOT NULL,
    content             JSONB NOT NULL DEFAULT '{}',  -- Translated Puck content
    
    -- SEO
    meta_title          TEXT,
    meta_description    TEXT,
    slug                TEXT,  -- Translated slug
    
    -- Status
    status              TEXT DEFAULT 'DRAFT',  -- Independent of main page
    published_at        TIMESTAMPTZ,
    
    -- Sync status
    source_version      INT,  -- Which main page version this was translated from
    needs_update        BOOLEAN DEFAULT false,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(page_id, locale_code)
);

CREATE INDEX IF NOT EXISTS idx_translations ON studio_page_translations(page_id, locale_code);
```

### G.2 Translation Workflow

```typescript
interface TranslationStatus {
  locale: string;
  status: 'NOT_TRANSLATED' | 'DRAFT' | 'PUBLISHED' | 'NEEDS_UPDATE';
  translatedAt?: Date;
  sourceVersion?: number;
  currentVersion?: number;
}

async function getPageTranslationStatus(pageId: string): Promise<TranslationStatus[]> {
  const page = await prisma.studioPages.findUnique({ where: { id: pageId } });
  const locales = await prisma.studioLocales.findMany({ where: { isActive: true } });
  const translations = await prisma.studioPageTranslations.findMany({
    where: { pageId },
  });
  
  return locales.map(locale => {
    const translation = translations.find(t => t.localeCode === locale.code);
    if (!translation) {
      return { locale: locale.code, status: 'NOT_TRANSLATED' };
    }
    if (translation.sourceVersion < page.contentVersion) {
      return { locale: locale.code, status: 'NEEDS_UPDATE', ... };
    }
    return { locale: locale.code, status: translation.status, ... };
  });
}
```

---

## ADDENDUM H: ADDITIONAL COMMERCE BLOCKS

Missing commerce blocks identified in gap analysis.

### H.1 Search & Filter Blocks

```typescript
// Block #104: Product Search
{
  key: 'ProductSearch',
  label: 'Product Search',
  category: 'commerce',
  description: 'Search bar with Meilisearch integration',
  props: {
    placeholder: { type: 'string', default: 'Search products...' },
    showFilters: { type: 'boolean', default: false },
    showCategories: { type: 'boolean', default: true },
    showSuggestions: { type: 'boolean', default: true },
    redirectTo: { type: 'page_selector' },
    style: { type: 'select', options: ['minimal', 'expanded', 'hero'] },
  },
}

// Block #105: Filter Sidebar
{
  key: 'FilterSidebar',
  label: 'Filter Sidebar',
  category: 'commerce',
  description: 'Faceted search filters',
  props: {
    filters: {
      type: 'array',
      items: {
        type: 'select',
        options: ['category', 'price', 'condition', 'brand', 'size', 'color', 'seller'],
      },
    },
    showClearAll: { type: 'boolean', default: true },
    collapsible: { type: 'boolean', default: true },
    position: { type: 'select', options: ['left', 'right'] },
  },
}

// Block #106: Sort Control
{
  key: 'SortControl',
  label: 'Sort Control',
  category: 'commerce',
  props: {
    options: {
      type: 'array',
      default: ['newest', 'price_low', 'price_high', 'popular', 'ending_soon'],
    },
    style: { type: 'select', options: ['dropdown', 'buttons', 'tabs'] },
  },
}
```

### H.2 Cart & Checkout Blocks

```typescript
// Block #107: Cart Preview
{
  key: 'CartPreview',
  label: 'Cart Preview',
  category: 'commerce',
  description: 'Mini cart dropdown',
  props: {
    showItemCount: { type: 'boolean', default: true },
    showSubtotal: { type: 'boolean', default: true },
    showCheckoutButton: { type: 'boolean', default: true },
    maxItems: { type: 'number', default: 3 },
  },
}

// Block #108: Cart Icon
{
  key: 'CartIcon',
  label: 'Cart Icon',
  category: 'commerce',
  props: {
    icon: { type: 'icon', default: 'shopping-cart' },
    showBadge: { type: 'boolean', default: true },
    badgePosition: { type: 'select', options: ['top-right', 'top-left'] },
    link: { type: 'url', default: '/cart' },
  },
}

// Block #109: Wishlist Icon
{
  key: 'WishlistIcon',
  label: 'Wishlist Icon',
  category: 'commerce',
  props: {
    icon: { type: 'icon', default: 'heart' },
    showBadge: { type: 'boolean', default: true },
    link: { type: 'url', default: '/wishlist' },
  },
}
```

---

## ADDENDUM I: RESPONSIVE BREAKPOINTS (Detailed)

Full responsive system specification.

### I.1 Default Breakpoints

```typescript
const DEFAULT_BREAKPOINTS = {
  mobile: { max: 639, label: 'Mobile', icon: 'smartphone' },
  tablet: { min: 640, max: 1023, label: 'Tablet', icon: 'tablet' },
  desktop: { min: 1024, label: 'Desktop', icon: 'monitor' },
};

// Custom breakpoints can be added
interface CustomBreakpoint {
  id: string;
  label: string;
  min?: number;
  max?: number;
  icon: string;
}
```

### I.2 Per-Field Responsive Values

Every style field supports per-breakpoint values:

```typescript
// Example: Responsive typography
interface ResponsiveTypography {
  desktop: TypographyValue;
  tablet?: Partial<TypographyValue>;
  mobile?: Partial<TypographyValue>;
}

// In the editor, a "device toggle" switches views
// Values cascade down: desktop → tablet → mobile
```

### I.3 Visibility Controls

```typescript
interface VisibilitySettings {
  hideOnMobile: boolean;
  hideOnTablet: boolean;
  hideOnDesktop: boolean;
}

// Rendered as:
// .hide-mobile { @media (max-width: 639px) { display: none !important; } }
```

---

## ADDENDUM J: MANIFEST.JSON SCHEMA

Complete module manifest specification.

```json
{
  "$schema": "https://twicely.co/schemas/module-manifest-v1.json",
  "id": "twicely-studio",
  "name": "Twicely Studio",
  "version": "2.0.0",
  "description": "The definitive CMS + Page Builder for Twicely",
  "author": {
    "name": "Twicely LLC",
    "email": "platform@twicely.co"
  },
  
  "type": "platform",
  "category": "content",
  
  "requires": {
    "platform": ">=0.44.0",
    "node": ">=20.0.0"
  },
  
  "dependencies": {
    "@measured/puck": "^0.16.0"
  },
  
  "provides": {
    "permissions": [
      "studio.pages.view",
      "studio.pages.create",
      "studio.pages.edit",
      "studio.pages.delete",
      "studio.pages.publish"
    ],
    "routes": {
      "corp": [
        "/corp/studio",
        "/corp/studio/pages",
        "/corp/studio/pages/:id",
        "/corp/studio/templates",
        "/corp/studio/menus",
        "/corp/studio/forms",
        "/corp/studio/popups",
        "/corp/studio/theme"
      ]
    },
    "health": {
      "provider": "studioHealthProvider",
      "domain": "twicely-studio"
    }
  },
  
  "install": {
    "migrations": [
      "migrations/001_create_studio_tables.sql"
    ],
    "seeds": [
      "seeds/default-templates.ts",
      "seeds/default-globals.ts"
    ]
  },
  
  "uninstall": {
    "preserveData": true,
    "confirmationRequired": true
  },
  
  "exports": {
    "server": "./src/server.ts",
    "client": "./src/client.ts"
  }
}
```

---

## ADDENDUM K: BLOCK PROP TYPESCRIPT TYPES

Complete TypeScript definitions for all 100+ blocks.

### K.1 Common Field Types

```typescript
// =============================================================================
// COMMON FIELD TYPES
// =============================================================================

// Text with i18n support
interface TranslatableText {
  default: string;
  translations?: Record<string, string>;
}

// URL with optional new tab
interface LinkValue {
  url: string;
  openInNewTab?: boolean;
  noFollow?: boolean;
}

// Image with focal point
interface ImageValue {
  src: string;
  alt?: string;
  focalPointX?: number;
  focalPointY?: number;
  width?: number;
  height?: number;
}

// Responsive value wrapper
type ResponsiveValue<T> = {
  desktop: T;
  tablet?: Partial<T>;
  mobile?: Partial<T>;
};

// Color with token support
interface ColorValue {
  type: 'token' | 'custom';
  token?: string;
  custom?: string;
}

// Icon selection
interface IconValue {
  library: 'lucide';
  name: string;
}
```

### K.2 Layout Block Types (Blocks 1-15)

```typescript
// Block 1: Section
interface SectionProps {
  // Background
  backgroundColor?: ColorValue;
  backgroundImage?: ImageValue;
  backgroundVideo?: { url: string; fallback?: ImageValue };
  overlay?: { enabled: boolean; color: ColorValue; opacity: number };
  
  // Layout
  minHeight?: ResponsiveValue<string>;
  maxWidth?: string;
  verticalAlign?: 'top' | 'center' | 'bottom';
  horizontalAlign?: 'left' | 'center' | 'right';
  
  // Padding
  paddingTop?: ResponsiveValue<string>;
  paddingBottom?: ResponsiveValue<string>;
  paddingLeft?: ResponsiveValue<string>;
  paddingRight?: ResponsiveValue<string>;
  
  // Advanced
  htmlTag?: 'section' | 'div' | 'article' | 'aside' | 'header' | 'footer';
  cssId?: string;
  cssClasses?: string;
  customCss?: string;
  
  // Animation
  animation?: AnimationFieldValue;
}

// Block 2: Container
interface ContainerProps {
  maxWidth?: string | 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  centered?: boolean;
  padding?: ResponsiveValue<SpacingValue>;
}

// Block 3: Grid
interface GridProps {
  columns?: ResponsiveValue<number>;
  gap?: ResponsiveValue<string>;
  rowGap?: ResponsiveValue<string>;
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  justifyItems?: 'start' | 'center' | 'end' | 'stretch';
}

// Block 4: Columns
interface ColumnsProps {
  columnWidths?: ResponsiveValue<string[]>;  // ['50%', '50%'] or ['1fr', '2fr']
  gap?: ResponsiveValue<string>;
  stackOn?: 'mobile' | 'tablet' | 'never';
  reverseOnStack?: boolean;
  verticalAlign?: 'top' | 'center' | 'bottom' | 'stretch';
}

// Block 5: Row
interface RowProps {
  justifyContent?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'start' | 'center' | 'end' | 'baseline' | 'stretch';
  gap?: ResponsiveValue<string>;
  wrap?: boolean;
  reverse?: boolean;
}

// Block 6: Stack
interface StackProps {
  gap?: ResponsiveValue<string>;
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
}

// Block 7: Spacer
interface SpacerProps {
  height?: ResponsiveValue<string>;
}

// Block 8: Divider
interface DividerProps {
  style?: 'solid' | 'dashed' | 'dotted' | 'double';
  color?: ColorValue;
  width?: string;  // thickness
  length?: string;  // '100%' or '80%'
  margin?: ResponsiveValue<string>;
}

// ... (continuing for all 100+ blocks)
```

### K.3 Commerce Block Types (Blocks 51-70)

```typescript
// Block 51: ProductGrid
interface ProductGridProps {
  // Data
  dataSource: 'query' | 'manual' | 'context';
  query?: DataQuery;
  manualListingIds?: string[];
  
  // Layout
  columns?: ResponsiveValue<number>;
  gap?: ResponsiveValue<string>;
  limit?: number;
  
  // Card appearance
  showImage?: boolean;
  imageAspectRatio?: '1:1' | '4:3' | '3:4' | '16:9';
  showTitle?: boolean;
  showPrice?: boolean;
  showOriginalPrice?: boolean;
  showSeller?: boolean;
  showRating?: boolean;
  showBadges?: boolean;  // NEW, SALE, etc.
  showWishlistButton?: boolean;
  showQuickView?: boolean;
  
  // Hover effects
  hoverEffect?: 'none' | 'zoom' | 'overlay' | 'slide-up';
  
  // Empty state
  emptyMessage?: string;
  showPlaceholders?: boolean;
  placeholderCount?: number;
  
  // Context
  inheritSellerId?: boolean;  // Auto-filter in seller store
  inheritCategoryId?: boolean;
}

// Block 52: ProductCarousel
interface ProductCarouselProps extends Omit<ProductGridProps, 'columns'> {
  slidesToShow?: ResponsiveValue<number>;
  slidesToScroll?: number;
  autoplay?: boolean;
  autoplaySpeed?: number;
  showArrows?: boolean;
  showDots?: boolean;
  infinite?: boolean;
  pauseOnHover?: boolean;
}

// ... (continuing for all commerce blocks)
```

---

## UPDATED BLOCK COUNT

| Category | Original | Addendum | Total |
|----------|----------|----------|-------|
| Layout | 15 | 1 (Loop) | 16 |
| Content | 20 | 0 | 20 |
| Marketing | 15 | 0 | 15 |
| Commerce | 20 | 6 | 26 |
| Help/Knowledge | 10 | 0 | 10 |
| Navigation | 10 | 0 | 10 |
| User/Account | 5 | 2 (Comments) | 7 |
| Trust/Reviews | 5 | 0 | 5 |
| **TOTAL** | **100** | **9** | **109** |

---

## UPDATED DATABASE TABLE COUNT

| Original | Addendum | Total |
|----------|----------|-------|
| 14 | 10 | **24 tables** |

New tables:
1. studio_post_types
2. studio_taxonomies
3. studio_terms
4. studio_page_terms
5. studio_global_widgets
6. studio_global_widget_usage
7. studio_design_tokens
8. studio_comments
9. studio_comment_settings
10. studio_locales
11. studio_page_translations
12. studio_loop_templates

---

## CONCLUSION

This addendum covers all missing features identified in the gap analysis:

✅ Custom Post Types (CPT) system  
✅ Taxonomies (categories, tags, custom)  
✅ Global Widgets (reusable, linked)  
✅ Design Tokens / Global Styles  
✅ Comments & Discussions  
✅ Loop Builder  
✅ Multi-language (i18n)  
✅ Additional Commerce Blocks  
✅ Responsive Breakpoints (detailed)  
✅ manifest.json schema  
✅ Block prop TypeScript types  

**Combined with the original specification, Studio 2.0 now has COMPLETE WordPress + Elementor feature parity — and more.**

---

# PART 8-11: CANONICAL UX & BUILD INSTRUCTIONS


## ADDENDUM L: DUAL SCOPE ARCHITECTURE

### L.1 Scope Enum (CRITICAL)

Studio operates in exactly TWO scopes:

```typescript
enum StudioScope {
  PLATFORM = 'PLATFORM',  // Twicely marketing/system pages
  STORE = 'STORE',        // Seller storefront pages
}
```

### L.2 Ownership Rules (NON-NEGOTIABLE)

```typescript
interface StudioPage {
  id: string;
  scope: StudioScope;
  ownerId: string | null;  // CRITICAL: null for PLATFORM
  // ...
}

// RULES:
// - PLATFORM pages → ownerId = null (ALWAYS)
// - STORE pages → ownerId = resolved store owner (NEVER null)
// - Never fake ownership for platform pages
// - ownerId determines data access, not just filtering
```

### L.3 Scope Determines Everything

| Aspect | PLATFORM | STORE |
|--------|----------|-------|
| **RBAC** | Platform permissions (studio.platform.*) | Business permissions (accessStudio, studioEdit) |
| **Available Blocks** | All blocks | Tier-restricted subset |
| **Locked Blocks** | Header, Footer (editable) | Platform chrome (read-only) |
| **Routes** | /corp/studio/* | /seller/store/* |
| **Data Access** | All platform data | Only seller's data |

### L.4 Update to Schema

```sql
-- Update studio_pages table
ALTER TABLE studio_pages 
  ADD CONSTRAINT scope_owner_check CHECK (
    (scope = 'PLATFORM' AND owner_id IS NULL) OR
    (scope = 'STORE' AND owner_id IS NOT NULL)
  );
```

---

## ADDENDUM M: EDITOR SHELL ARCHITECTURE (PUCK IS THE ENGINE)

### M.1 Core Principle

> **Puck is the engine. StudioShell is the product.**  
> Puck must NEVER render directly to screen.

### M.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        STUDIO SHELL                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                         TOP BAR                              │ │
│  │  Back | Title | Save Draft | Publish | Preview | Responsive  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌──────────────┬─────────────────────────┬──────────────┐       │
│  │  LEFT PANEL  │     CENTER CANVAS       │ RIGHT PANEL  │       │
│  │              │                         │              │       │
│  │  Widget Lib  │  ┌─────────────────┐   │  Document    │       │
│  │     OR       │  │   Puck Engine   │   │  Settings    │       │
│  │  Inspector   │  │   (HIDDEN)      │   │  ONLY        │       │
│  │              │  └─────────────────┘   │              │       │
│  │              │                         │              │       │
│  └──────────────┴─────────────────────────┴──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### M.3 File Structure (CANONICAL)

```
@twicely/studio/
├── src/
│   ├── editor-shell/           # ← REQUIRED - Elementor/WP UI
│   │   ├── StudioShell.tsx     # Main layout wrapper
│   │   ├── TopBar.tsx          # Navigation + actions
│   │   ├── LeftPanel.tsx       # Widget library OR inspector
│   │   ├── RightPanel.tsx      # Document panel (WP-style)
│   │   ├── Canvas.tsx          # Wraps Puck engine
│   │   ├── DevicePreview.tsx   # Responsive toggles
│   │   └── widget-library/
│   │       ├── WidgetLibrary.tsx
│   │       ├── WidgetCard.tsx
│   │       └── registry.ts
│   │
│   ├── editor/                 # ← Puck engine ONLY (no UI decisions)
│   │   └── PuckEngine.tsx
│   │
│   ├── renderer/               # Page rendering
│   │   ├── PageRenderer.tsx
│   │   └── StudioZone.tsx
│   │
│   ├── policy/                 # ← REQUIRED - Runtime config
│   │   ├── PolicyEngine.ts
│   │   ├── types.ts
│   │   └── defaults.ts
│   │
│   ├── registry/               # ← REQUIRED - Block registry
│   │   ├── BlockRegistry.ts
│   │   ├── BlockMeta.ts
│   │   └── index.ts
│   │
│   ├── rbac/                   # RBAC integration
│   │   ├── permissions.ts
│   │   └── guards.ts
│   │
│   ├── doctor/                 # ← REQUIRED - Startup diagnostics
│   │   └── StudioDoctor.ts
│   │
│   ├── blocks/                 # Block implementations
│   │   ├── layout/
│   │   ├── content/
│   │   ├── marketplace/
│   │   ├── marketing/
│   │   ├── advanced/
│   │   └── ai/
│   │
│   └── index.ts               # export StudioApp ONLY
│
├── migrations/
├── scripts/
└── README.md
```

### M.4 StudioShell Component

```typescript
// src/editor-shell/StudioShell.tsx

interface StudioShellProps {
  page: StudioPage;
  scope: StudioScope;
  policy: EditorPolicy;
}

export function StudioShell({ page, scope, policy }: StudioShellProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [puckData, setPuckData] = useState(page.content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  return (
    <div className="studio-shell">
      {/* Admin sidebar is HIDDEN - Studio owns the full screen */}
      
      <TopBar
        page={page}
        scope={scope}
        hasUnsavedChanges={hasUnsavedChanges}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onPreview={handlePreview}
      />
      
      <div className="studio-main">
        <LeftPanel
          selectedBlockId={selectedBlockId}
          policy={policy}
          onBlockSelect={setSelectedBlockId}
        />
        
        <Canvas
          data={puckData}
          selectedBlockId={selectedBlockId}
          policy={policy}
          onChange={(data) => {
            setPuckData(data);
            setHasUnsavedChanges(true);
          }}
          onBlockSelect={setSelectedBlockId}
        />
        
        <RightPanel
          page={page}
          onMetadataChange={handleMetadataChange}
        />
      </div>
    </div>
  );
}
```

---

## ADDENDUM N: LEFT PANEL DUAL-MODE BEHAVIOR

### N.1 Two Modes (MANDATORY)

The left panel has **exactly two modes**:

| Mode | When Active | Content |
|------|-------------|---------|
| **MODE A: Widget Library** | No block selected | Categorized widget list |
| **MODE B: Block Inspector** | Block is selected | Content/Style/Advanced tabs |

**CRITICAL:** Widget list must NEVER be visible while inspecting a block.

### N.2 Implementation

```typescript
// src/editor-shell/LeftPanel.tsx

interface LeftPanelProps {
  selectedBlockId: string | null;
  policy: EditorPolicy;
  onBlockSelect: (id: string | null) => void;
}

export function LeftPanel({ selectedBlockId, policy, onBlockSelect }: LeftPanelProps) {
  // MODE A: Widget Library (default)
  if (!selectedBlockId) {
    return (
      <div className="left-panel left-panel--widgets">
        <WidgetLibrary 
          policy={policy}
          categories={WIDGET_CATEGORIES}
        />
      </div>
    );
  }
  
  // MODE B: Block Inspector
  return (
    <div className="left-panel left-panel--inspector">
      <button 
        className="back-button"
        onClick={() => onBlockSelect(null)}
      >
        ← Back to Widgets
      </button>
      
      <BlockInspector
        blockId={selectedBlockId}
        policy={policy}
      />
    </div>
  );
}
```

### N.3 Block Inspector Tabs

```typescript
// src/editor-shell/BlockInspector.tsx

const INSPECTOR_TABS = ['Content', 'Style', 'Advanced'] as const;

export function BlockInspector({ blockId, policy }: BlockInspectorProps) {
  const [activeTab, setActiveTab] = useState<typeof INSPECTOR_TABS[number]>('Content');
  const block = useBlock(blockId);
  
  // Filter tabs based on policy
  const visibleTabs = INSPECTOR_TABS.filter(tab => 
    policy.visibleInspectorTabs.includes(tab)
  );
  
  return (
    <div className="block-inspector">
      <div className="inspector-header">
        <span className="block-icon">{block.meta.icon}</span>
        <span className="block-label">{block.meta.label}</span>
        {block.isLocked && <LockIcon />}
      </div>
      
      <div className="inspector-tabs">
        {visibleTabs.map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      
      <div className="inspector-content">
        {activeTab === 'Content' && <ContentFields block={block} policy={policy} />}
        {activeTab === 'Style' && <StyleFields block={block} policy={policy} />}
        {activeTab === 'Advanced' && <AdvancedFields block={block} policy={policy} />}
      </div>
    </div>
  );
}
```

### N.4 Field Grouping (Block Definition)

```typescript
// Every block must group fields into Content/Style/Advanced
interface BlockDefinition {
  meta: BlockMeta;
  
  fields: {
    content: Record<string, FieldDefinition>;   // Text, images, data
    style: Record<string, FieldDefinition>;     // Colors, spacing, alignment
    advanced: Record<string, FieldDefinition>;  // Visibility, margins, presets
  };
  
  defaultProps: Record<string, any>;
  render: React.ComponentType<any>;
}
```

---

## ADDENDUM O: RIGHT PANEL = DOCUMENT SETTINGS ONLY

### O.1 Forbidden Content

The right panel must **NEVER** contain:
- Block props
- Styling controls
- Block-level settings
- Any block-related UI

### O.2 Allowed Content (WordPress-Style)

```typescript
// src/editor-shell/RightPanel.tsx

export function RightPanel({ page, onMetadataChange }: RightPanelProps) {
  return (
    <div className="right-panel document-panel">
      <h3>Document</h3>
      
      {/* Status */}
      <section>
        <label>Status</label>
        <select 
          value={page.status}
          onChange={(e) => onMetadataChange({ status: e.target.value })}
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="SCHEDULED">Scheduled</option>
        </select>
      </section>
      
      {/* Visibility */}
      <section>
        <label>Visibility</label>
        <select 
          value={page.visibility}
          onChange={(e) => onMetadataChange({ visibility: e.target.value })}
        >
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
          <option value="PASSWORD">Password Protected</option>
        </select>
      </section>
      
      {/* Slug */}
      <section>
        <label>URL Slug</label>
        <input 
          type="text"
          value={page.slug}
          onChange={(e) => onMetadataChange({ slug: e.target.value })}
        />
        <small>/{page.slug}</small>
      </section>
      
      {/* Parent Page */}
      <section>
        <label>Parent Page</label>
        <PageSelector 
          value={page.parentId}
          onChange={(id) => onMetadataChange({ parentId: id })}
          exclude={page.id}
        />
      </section>
      
      {/* Template */}
      <section>
        <label>Template</label>
        <TemplateSelector 
          value={page.templateId}
          onChange={(id) => onMetadataChange({ templateId: id })}
        />
      </section>
      
      {/* Schedule (optional) */}
      {page.status === 'SCHEDULED' && (
        <section>
          <label>Publish Date</label>
          <DateTimePicker 
            value={page.scheduledFor}
            onChange={(date) => onMetadataChange({ scheduledFor: date })}
          />
        </section>
      )}
      
      {/* Revisions (optional) */}
      <section>
        <label>Revisions</label>
        <RevisionsList 
          pageId={page.id}
          onRevert={(revisionId) => handleRevert(revisionId)}
        />
      </section>
    </div>
  );
}
```

---

## ADDENDUM P: LOCKED BLOCKS SYSTEM

### P.1 System-Owned Blocks

These blocks are **locked** and cannot be freely modified:

| Block | Scope | Behavior |
|-------|-------|----------|
| **PlatformHeader** | STORE | Read-only, cannot move/delete |
| **PlatformFooter** | STORE | Read-only, cannot move/delete |
| **Navigation** | Both | Some fields read-only |
| **LegalText** | Both | Content locked, style editable |
| **TrustBadges** | Both | Cannot delete |
| **CopyrightNotice** | Both | Cannot delete |

### P.2 Lock Implementation

```typescript
interface BlockInstance {
  id: string;
  type: string;
  props: Record<string, any>;
  
  // Lock state
  isLocked: boolean;
  lockReason?: string;
  lockedFields?: string[];  // Specific fields that are read-only
  canMove?: boolean;
  canDelete?: boolean;
}

// Lock rules
interface LockRule {
  blockType: string;
  scope: StudioScope;
  isLocked: boolean;
  canMove: boolean;
  canDelete: boolean;
  lockedFields: string[];
  lockReason: string;
}

const LOCK_RULES: LockRule[] = [
  {
    blockType: 'PlatformHeader',
    scope: 'STORE',
    isLocked: true,
    canMove: false,
    canDelete: false,
    lockedFields: ['*'],  // All fields locked
    lockReason: 'Platform header is controlled by Twicely',
  },
  {
    blockType: 'Footer',
    scope: 'PLATFORM',
    isLocked: false,
    canMove: true,
    canDelete: false,
    lockedFields: ['legalLinks'],
    lockReason: 'Legal links are required',
  },
  // ...
];
```

### P.3 Lock UI

```typescript
// In Canvas - show lock indicator
function BlockWrapper({ block, children }: BlockWrapperProps) {
  return (
    <div className={cn('block-wrapper', block.isLocked && 'block-wrapper--locked')}>
      {block.isLocked && (
        <div className="lock-indicator">
          <LockIcon />
          <Tooltip>{block.lockReason}</Tooltip>
        </div>
      )}
      
      {/* Block controls - disabled if locked */}
      <div className="block-controls">
        <button disabled={!block.canMove}>↑↓</button>
        <button onClick={handleDuplicate}>⎘</button>
        <button disabled={!block.canDelete} onClick={handleDelete}>×</button>
      </div>
      
      {children}
    </div>
  );
}
```

---

## ADDENDUM Q: POLICY-DRIVEN EDITOR CONFIG

### Q.1 Policy Engine

Editor configuration is **generated at runtime** based on context.

```typescript
// src/policy/PolicyEngine.ts

interface EditorPolicy {
  // What widgets are visible
  visibleWidgets: string[];
  
  // Which blocks are locked
  lockedBlocks: string[];
  
  // Which fields are editable
  editableFields: Record<string, string[]>;
  
  // Which inspector tabs are visible
  visibleInspectorTabs: ('Content' | 'Style' | 'Advanced')[];
  
  // Additional restrictions
  canPublish: boolean;
  canSchedule: boolean;
  canAccessAdvanced: boolean;
  canEditCustomCss: boolean;
}

interface PolicyContext {
  scope: StudioScope;
  userRole: PlatformRole;      // For PLATFORM scope
  businessRole: BusinessRole;   // For STORE scope
  subscriptionTier: SellerTier;
}

function generatePolicy(ctx: PolicyContext): EditorPolicy {
  if (ctx.scope === 'PLATFORM') {
    return generatePlatformPolicy(ctx.userRole);
  } else {
    return generateStorePolicy(ctx.businessRole, ctx.subscriptionTier);
  }
}

function generatePlatformPolicy(role: PlatformRole): EditorPolicy {
  switch (role) {
    case 'SUPER_ADMIN':
      return {
        visibleWidgets: ALL_WIDGETS,
        lockedBlocks: [],
        editableFields: ALL_FIELDS,
        visibleInspectorTabs: ['Content', 'Style', 'Advanced'],
        canPublish: true,
        canSchedule: true,
        canAccessAdvanced: true,
        canEditCustomCss: true,
      };
    
    case 'CONTENT':
      return {
        visibleWidgets: CONTENT_WIDGETS,
        lockedBlocks: ['Navigation', 'Footer'],
        editableFields: CONTENT_FIELDS,
        visibleInspectorTabs: ['Content', 'Style'],
        canPublish: true,
        canSchedule: true,
        canAccessAdvanced: false,
        canEditCustomCss: false,
      };
    
    // ...
  }
}

function generateStorePolicy(role: BusinessRole, tier: SellerTier): EditorPolicy {
  const tierWidgets = TIER_WIDGET_MAP[tier];
  
  switch (role) {
    case 'OWNER':
      return {
        visibleWidgets: tierWidgets,
        lockedBlocks: ['PlatformHeader', 'PlatformFooter'],
        editableFields: STORE_EDITABLE_FIELDS,
        visibleInspectorTabs: tier === 'ELITE' ? ['Content', 'Style', 'Advanced'] : ['Content', 'Style'],
        canPublish: true,
        canSchedule: tier !== 'SELLER',
        canAccessAdvanced: tier === 'ELITE',
        canEditCustomCss: tier === 'ELITE',
      };
    
    case 'STAFF':
      return {
        visibleWidgets: tierWidgets.filter(w => !OWNER_ONLY_WIDGETS.includes(w)),
        lockedBlocks: ['PlatformHeader', 'PlatformFooter', 'StoreBanner'],
        editableFields: STAFF_EDITABLE_FIELDS,
        visibleInspectorTabs: ['Content'],
        canPublish: false,
        canSchedule: false,
        canAccessAdvanced: false,
        canEditCustomCss: false,
      };
    
    // ...
  }
}
```

### Q.2 Policy Application

**CRITICAL:** Layout must NEVER change due to policy.

```typescript
// Policy affects content, not structure
function WidgetLibrary({ policy }: { policy: EditorPolicy }) {
  const allWidgets = useWidgetRegistry();
  
  // Filter widgets based on policy
  const visibleWidgets = allWidgets.filter(w => 
    policy.visibleWidgets.includes(w.meta.key)
  );
  
  // Same layout, different content
  return (
    <div className="widget-library">
      {WIDGET_CATEGORIES.map(category => (
        <WidgetCategory
          key={category}
          category={category}
          widgets={visibleWidgets.filter(w => w.meta.category === category)}
        />
      ))}
    </div>
  );
}
```

---

## ADDENDUM R: STUDIO DOCTOR (SAFE INSTALL)

### R.1 StudioDoctor Runs on Startup

```typescript
// src/doctor/StudioDoctor.ts

interface DiagnosticResult {
  check: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  autoFix?: boolean;  // ALWAYS false - never auto-fix
}

export async function runStudioDoctor(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  
  // Check 1: Database tables exist
  results.push(await checkTablesExist());
  
  // Check 2: Permissions registered
  results.push(await checkPermissionsExist());
  
  // Check 3: Default templates seeded
  results.push(await checkDefaultTemplates());
  
  // Check 4: Block registry complete
  results.push(await checkBlockRegistry());
  
  // Check 5: RBAC integration
  results.push(await checkRbacIntegration());
  
  return results;
}

async function checkTablesExist(): Promise<DiagnosticResult> {
  const requiredTables = [
    'studio_pages',
    'studio_page_revisions',
    'studio_globals',
    'studio_templates',
    'studio_menus',
    'studio_menu_items',
    'studio_forms',
    'studio_popups',
    'studio_media',
    'studio_settings',
  ];
  
  const missing: string[] = [];
  
  for (const table of requiredTables) {
    const exists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = ${table}
      )
    `;
    if (!exists) missing.push(table);
  }
  
  return {
    check: 'Database Tables',
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    message: missing.length === 0 
      ? 'All required tables exist'
      : `Missing tables: ${missing.join(', ')}. Run: pnpm studio:migrate`,
    autoFix: false,  // NEVER auto-fix
  };
}

async function checkPermissionsExist(): Promise<DiagnosticResult> {
  const requiredPermissions = [
    'studio.platform.view',
    'studio.platform.edit',
    'studio.platform.publish',
    'studio.platform.settings',
  ];
  
  // Check if permissions are registered (don't create them)
  const registered = await prisma.permission.findMany({
    where: { code: { in: requiredPermissions } },
  });
  
  const missing = requiredPermissions.filter(p => 
    !registered.some(r => r.code === p)
  );
  
  return {
    check: 'Permissions',
    status: missing.length === 0 ? 'PASS' : 'WARN',
    message: missing.length === 0
      ? 'All permissions registered'
      : `Missing permissions: ${missing.join(', ')}. Run: pnpm studio:permissions`,
    autoFix: false,
  };
}
```

### R.2 Doctor Output

```
╔═══════════════════════════════════════════════════════════════╗
║                    TWICELY STUDIO DOCTOR                       ║
╠═══════════════════════════════════════════════════════════════╣
║ Check                    │ Status │ Message                    ║
╠══════════════════════════╪════════╪════════════════════════════╣
║ Database Tables          │ ✓ PASS │ All required tables exist  ║
║ Permissions              │ ✓ PASS │ All permissions registered ║
║ Default Templates        │ ⚠ WARN │ Missing: hero-template     ║
║ Block Registry           │ ✓ PASS │ 109 blocks registered      ║
║ RBAC Integration         │ ✓ PASS │ Roles configured           ║
╚══════════════════════════╧════════╧════════════════════════════╝

Warnings: 1
Run 'pnpm studio:seed-templates' to fix warnings.
```

---

## ADDENDUM S: DATA SEPARATION RULE

### S.1 Critical Rule

> **Puck JSON = layout + blocks ONLY**  
> **Page metadata stored SEPARATELY**

Never store metadata inside Puck JSON.

### S.2 What Goes Where

| Data | Location | Reason |
|------|----------|--------|
| Block layout | `content` (Puck JSON) | Puck engine data |
| Block props | `content` (Puck JSON) | Puck engine data |
| Page title | `title` column | Metadata |
| Page slug | `slug` column | Metadata |
| Page status | `status` column | Metadata |
| SEO meta | `meta_*` columns | Metadata |
| Parent page | `parent_id` column | Metadata |
| Template | `template_id` column | Metadata |
| Custom CSS | `custom_css` column | Metadata |

### S.3 Schema Enforcement

```typescript
// When saving, separate concerns
async function savePage(pageId: string, updates: PageUpdate) {
  // Metadata goes to columns
  await prisma.studioPages.update({
    where: { id: pageId },
    data: {
      title: updates.title,
      slug: updates.slug,
      status: updates.status,
      parentId: updates.parentId,
      templateId: updates.templateId,
      metaTitle: updates.metaTitle,
      metaDescription: updates.metaDescription,
      customCss: updates.customCss,
      updatedAt: new Date(),
    },
  });
  
  // Puck content goes to content column
  if (updates.content) {
    await prisma.studioPages.update({
      where: { id: pageId },
      data: {
        content: updates.content,  // Pure Puck JSON
        contentVersion: { increment: 1 },
      },
    });
  }
}
```

---

## ADDENDUM T: BLOCK METADATA REQUIREMENTS

### T.1 Mandatory Metadata

Every block **MUST** export metadata. Block cannot register without it.

```typescript
interface BlockMeta {
  // REQUIRED
  key: string;           // Unique identifier "HeroSection"
  label: string;         // Display name "Hero Section"
  category: BlockCategory;
  icon: React.ComponentType;  // ← ICONS ARE MANDATORY
  
  // OPTIONAL
  description?: string;
  keywords?: string[];
  tierFlags?: {
    minTier?: SellerTier;
    platformOnly?: boolean;
    proOnly?: boolean;
  };
}

// Block registration FAILS without required fields
function registerBlock(definition: BlockDefinition) {
  const { meta } = definition;
  
  if (!meta.key) throw new Error('Block key is required');
  if (!meta.label) throw new Error('Block label is required');
  if (!meta.category) throw new Error('Block category is required');
  if (!meta.icon) throw new Error('Block icon is MANDATORY');
  
  registry.set(meta.key, definition);
}
```

### T.2 Block Categories

```typescript
type BlockCategory = 
  | 'Layout'
  | 'Content'
  | 'Marketplace'
  | 'Marketing'
  | 'Advanced'
  | 'AI';
```

---

## ADDENDUM U: TOP BAR COMPLETE REQUIREMENTS

### U.1 Required Elements

```typescript
// src/editor-shell/TopBar.tsx

interface TopBarProps {
  page: StudioPage;
  scope: StudioScope;
  hasUnsavedChanges: boolean;
  device: 'desktop' | 'tablet' | 'mobile';
  onSaveDraft: () => void;
  onPublish: () => void;
  onPreview: () => void;
  onDeviceChange: (device: string) => void;
}

export function TopBar({ 
  page, 
  scope, 
  hasUnsavedChanges,
  device,
  onSaveDraft,
  onPublish,
  onPreview,
  onDeviceChange,
}: TopBarProps) {
  return (
    <div className="studio-top-bar">
      {/* Left: Back button */}
      <div className="top-bar-left">
        <Link href={scope === 'PLATFORM' ? '/corp' : '/seller'} className="back-button">
          ← Back to Admin
        </Link>
      </div>
      
      {/* Center: Title + badges */}
      <div className="top-bar-center">
        <span className="page-title">{page.title || 'Untitled'}</span>
        
        {/* Status badge */}
        <StatusBadge status={page.status} />
        
        {/* Scope badge */}
        <ScopeBadge scope={scope} />
        
        {/* Unsaved indicator */}
        {hasUnsavedChanges && (
          <span className="unsaved-indicator">● Unsaved changes</span>
        )}
      </div>
      
      {/* Right: Actions */}
      <div className="top-bar-right">
        {/* Responsive toggles */}
        <div className="device-toggles">
          <button 
            className={device === 'desktop' ? 'active' : ''}
            onClick={() => onDeviceChange('desktop')}
          >
            <MonitorIcon />
          </button>
          <button 
            className={device === 'tablet' ? 'active' : ''}
            onClick={() => onDeviceChange('tablet')}
          >
            <TabletIcon />
          </button>
          <button 
            className={device === 'mobile' ? 'active' : ''}
            onClick={() => onDeviceChange('mobile')}
          >
            <SmartphoneIcon />
          </button>
        </div>
        
        {/* Save Draft */}
        <button onClick={onSaveDraft} className="btn-secondary">
          Save Draft
        </button>
        
        {/* Publish / Update */}
        <button onClick={onPublish} className="btn-primary">
          {page.status === 'PUBLISHED' ? 'Update' : 'Publish'}
        </button>
        
        {/* Preview */}
        <button onClick={onPreview} className="btn-icon" title="Preview in new tab">
          <ExternalLinkIcon />
        </button>
      </div>
    </div>
  );
}
```

---

## ADDENDUM V: CANVAS REQUIREMENTS

### V.1 Canvas Behavior

```typescript
// src/editor-shell/Canvas.tsx

export function Canvas({ data, selectedBlockId, policy, onChange, onBlockSelect }: CanvasProps) {
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  
  return (
    <div className="studio-canvas">
      {/* Device frame */}
      <div className={`canvas-frame canvas-frame--${device}`}>
        
        {/* Puck engine - wrapped, never exposed directly */}
        <PuckEngine
          data={data}
          config={generatePuckConfig(policy)}
          onChange={onChange}
          renderBlock={(block) => (
            <BlockWrapper
              block={block}
              isSelected={selectedBlockId === block.id}
              isHovered={hoveredBlockId === block.id}
              policy={policy}
              onSelect={() => onBlockSelect(block.id)}
              onHover={() => setHoveredBlockId(block.id)}
              onHoverEnd={() => setHoveredBlockId(null)}
            >
              <block.render {...block.props} />
            </BlockWrapper>
          )}
        />
        
      </div>
    </div>
  );
}

function BlockWrapper({ block, isSelected, isHovered, policy, onSelect, children }: BlockWrapperProps) {
  const canDelete = !block.isLocked && policy.canDeleteBlocks;
  const canMove = block.canMove !== false;
  
  return (
    <div 
      className={cn(
        'canvas-block',
        isSelected && 'canvas-block--selected',
        isHovered && 'canvas-block--hovered',
        block.isLocked && 'canvas-block--locked',
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
    >
      {/* Hover outline */}
      {isHovered && !isSelected && (
        <div className="block-outline block-outline--hover" />
      )}
      
      {/* Selection outline */}
      {isSelected && (
        <div className="block-outline block-outline--selected" />
      )}
      
      {/* Lock indicator */}
      {block.isLocked && (
        <div className="block-lock-badge">
          <LockIcon size={12} />
        </div>
      )}
      
      {/* Inline controls (shown on selection) */}
      {isSelected && (
        <div className="block-controls">
          <button 
            disabled={!canMove}
            title="Move up"
            onClick={handleMoveUp}
          >
            <ArrowUpIcon size={14} />
          </button>
          <button 
            disabled={!canMove}
            title="Move down"
            onClick={handleMoveDown}
          >
            <ArrowDownIcon size={14} />
          </button>
          <button 
            title="Duplicate"
            onClick={handleDuplicate}
          >
            <CopyIcon size={14} />
          </button>
          <button 
            disabled={!canDelete}
            title={canDelete ? 'Delete' : block.lockReason}
            onClick={handleDelete}
          >
            <TrashIcon size={14} />
          </button>
        </div>
      )}
      
      {/* Block content */}
      {children}
    </div>
  );
}
```

---

## ADDENDUM W: INLINE TEXT EDITING

### W.1 Required for These Blocks

Inline text editing is **REQUIRED** for:
- Heading
- Text/Paragraph
- Button (label)
- RichText

### W.2 Implementation

```typescript
// Inline editable text wrapper
function InlineEditable({ 
  value, 
  onChange, 
  tag = 'span',
  placeholder,
  disabled,
}: InlineEditableProps) {
  const ref = useRef<HTMLElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Sync Puck props to DOM
  useEffect(() => {
    if (ref.current && !isEditing) {
      ref.current.textContent = value;
    }
  }, [value, isEditing]);
  
  const handleBlur = () => {
    setIsEditing(false);
    if (ref.current) {
      const newValue = ref.current.textContent || '';
      if (newValue !== value) {
        onChange(newValue);
      }
    }
  };
  
  const Tag = tag as keyof JSX.IntrinsicElements;
  
  return (
    <Tag
      ref={ref}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onFocus={() => setIsEditing(true)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          ref.current?.blur();
        }
      }}
      data-placeholder={placeholder}
      className={cn(
        'inline-editable',
        !value && 'inline-editable--empty',
      )}
    />
  );
}

// Usage in Heading block
function HeadingBlock({ level, text, onChange }: HeadingBlockProps) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  return (
    <InlineEditable
      tag={Tag}
      value={text}
      onChange={(newText) => onChange({ text: newText })}
      placeholder="Click to add heading..."
    />
  );
}
```

---

## ADDENDUM X: BUSINESS PERMISSIONS (SELLER RBAC)

### X.1 Business Permission Codes

```typescript
// Seller-side permissions (for STORE scope)
export const STUDIO_BUSINESS_PERMISSIONS = {
  // Permission codes
  ACCESS_STUDIO: 'accessStudio',
  STUDIO_EDIT: 'studioEdit',
  STUDIO_PUBLISH: 'studioPublish',
  STUDIO_ADVANCED: 'studioAdvanced',
  
  // Default assignments by business role
  roleDefaults: {
    OWNER: ['accessStudio', 'studioEdit', 'studioPublish', 'studioAdvanced'],
    ADMIN: ['accessStudio', 'studioEdit', 'studioPublish'],
    STAFF: ['accessStudio', 'studioEdit'],
    VIEWER: ['accessStudio'],
  },
};
```

### X.2 Combined with Platform Permissions

```typescript
// Platform permissions (for PLATFORM scope)
export const STUDIO_PLATFORM_PERMISSIONS = {
  VIEW: 'studio.platform.view',
  EDIT: 'studio.platform.edit',
  PUBLISH: 'studio.platform.publish',
  SETTINGS: 'studio.platform.settings',
  
  // Default assignments by platform role
  roleDefaults: {
    SUPER_ADMIN: ['studio.platform.view', 'studio.platform.edit', 'studio.platform.publish', 'studio.platform.settings'],
    ADMIN: ['studio.platform.view', 'studio.platform.edit', 'studio.platform.publish', 'studio.platform.settings'],
    MARKETING: ['studio.platform.view', 'studio.platform.edit', 'studio.platform.publish'],
    CONTENT: ['studio.platform.view', 'studio.platform.edit', 'studio.platform.publish'],
  },
};
```

---

## ADDENDUM Y: FULLSCREEN MODE

### Y.1 Admin Sidebar Hidden

When in Studio editor mode, the admin sidebar must be hidden.

```typescript
// Option 1: Next.js Route Group with separate layout
// apps/web/app/(studio)/studio/[pageId]/layout.tsx

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  // No admin sidebar - Studio owns the full screen
  return (
    <div className="studio-fullscreen">
      {children}
    </div>
  );
}

// Option 2: Layout flag based on route
// In main layout
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudioRoute = pathname.startsWith('/corp/studio/') || pathname.startsWith('/seller/store/');
  
  if (isStudioRoute) {
    // Return without admin sidebar
    return <>{children}</>;
  }
  
  // Normal admin layout with sidebar
  return (
    <div className="admin-layout">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
```

### Y.2 CSS Reset for Fullscreen

```css
/* Studio fullscreen mode */
.studio-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: var(--studio-bg);
}

.studio-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.studio-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  width: 300px;
  border-right: 1px solid var(--border);
  overflow-y: auto;
}

.studio-canvas {
  flex: 1;
  overflow: auto;
  background: var(--canvas-bg);
}

.right-panel {
  width: 280px;
  border-left: 1px solid var(--border);
  overflow-y: auto;
}
```

---

## SUMMARY: ALL GAPS NOW COVERED

| Gap | Addendum |
|-----|----------|
| Dual Scope Architecture | L |
| Editor Shell vs Puck | M |
| Left Panel Dual-Mode | N |
| Right Panel = Document Only | O |
| Locked Blocks System | P |
| Policy-Driven Editor | Q |
| Studio Doctor | R |
| Data Separation Rule | S |
| Block Metadata Requirements | T |
| Top Bar Requirements | U |
| Canvas Requirements | V |
| Inline Text Editing | W |
| Business Permissions | X |
| Fullscreen Mode | Y |

**Total Addendums: A-Y (25 sections)**

---

## FINAL RULE

> If a decision conflicts with:  
> - Twicely RBAC  
> - Twicely schema  
> - Twicely UI system  
>
> **Twicely wins. Studio adapts.**

---

# FINAL SUMMARY

## Total Scope

| Component | Count |
|-----------|-------|
| Database Tables | 26 |
| Blocks | 109 |
| Style Fields | 6 |
| API Endpoints | ~60 |
| Admin Pages | 25+ |
| Platform Permissions | 17 |
| Business Permissions | 4 |
| Seller Permissions | 5 |

## Key Principles

1. **Puck is the engine. StudioShell is the product.**
2. **Dual scope: PLATFORM (ownerId=null) vs STORE (ownerId=seller)**
3. **Left Panel = Widget Library OR Inspector (never both)**
4. **Right Panel = Document settings ONLY (no block props)**
5. **Icons are MANDATORY for all blocks**
6. **Policy-driven editor configuration at runtime**
7. **Studio Doctor runs on startup, never auto-fixes**

## The Final Rule

> If a decision conflicts with:
> - Twicely RBAC
> - Twicely schema
> - Twicely UI system
>
> **Twicely wins. Studio adapts.**

---

**This is the definitive CMS + Page Builder.**  
**Better than WordPress. Better than Elementor.**  
**Nothing missing.**

---

## REMINDER 🔔

> **After Studio 2.0 is built:** Discuss **Default Store Page Editor** (core eBay-style feature, separate from Studio module)

