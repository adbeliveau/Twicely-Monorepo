# TWICELY STUDIO 2.0 — UI DESIGN REFERENCE

**Purpose:** Visual specifications for Claude Code to build a polished, Elementor-quality editor UI.

---

## DESIGN PHILOSOPHY

> **Look like Elementor. Feel like Elementor. But cleaner and more modern.**

Studio should feel:
- **Professional** — Not a toy, not a demo
- **Clean** — Minimal visual noise
- **Fast** — Instant feedback, smooth animations
- **Familiar** — Anyone who's used Elementor knows how to use this

---

## COLOR PALETTE

### Primary Brand (Twicely Pink/Magenta)
```css
--tw-primary-50: #fdf2f8;
--tw-primary-100: #fce7f3;
--tw-primary-200: #fbcfe8;
--tw-primary-300: #f9a8d4;
--tw-primary-400: #f472b6;
--tw-primary-500: #ec4899;  /* Primary action color */
--tw-primary-600: #db2777;  /* Hover state */
--tw-primary-700: #be185d;
--tw-primary-800: #9d174d;
--tw-primary-900: #831843;
```

### Neutral Grays (UI Chrome)
```css
--tw-gray-50: #f9fafb;   /* Panel backgrounds */
--tw-gray-100: #f3f4f6;  /* Hover backgrounds */
--tw-gray-200: #e5e7eb;  /* Borders */
--tw-gray-300: #d1d5db;  /* Disabled borders */
--tw-gray-400: #9ca3af;  /* Placeholder text */
--tw-gray-500: #6b7280;  /* Secondary text */
--tw-gray-600: #4b5563;  /* Body text */
--tw-gray-700: #374151;  /* Headings */
--tw-gray-800: #1f2937;  /* Dark text */
--tw-gray-900: #111827;  /* Darkest */
```

### Semantic Colors
```css
--tw-success: #10b981;   /* Published, success */
--tw-warning: #f59e0b;   /* Draft, warning */
--tw-error: #ef4444;     /* Error states */
--tw-info: #3b82f6;      /* Info, links */
```

### Canvas
```css
--tw-canvas-bg: #f1f5f9;       /* Gray checkerboard feel */
--tw-canvas-page-bg: #ffffff;  /* The actual page being edited */
--tw-canvas-grid: #e2e8f0;     /* Optional grid lines */
```

---

## TYPOGRAPHY

### Font Stack
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Type Scale
```css
--text-xs: 0.75rem;    /* 12px - Labels, badges */
--text-sm: 0.875rem;   /* 14px - Body text, inputs */
--text-base: 1rem;     /* 16px - Default */
--text-lg: 1.125rem;   /* 18px - Subheadings */
--text-xl: 1.25rem;    /* 20px - Panel titles */
--text-2xl: 1.5rem;    /* 24px - Page titles */
```

### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

---

## SPACING SCALE

```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

---

## LAYOUT DIMENSIONS

### Editor Shell
```css
--topbar-height: 56px;
--left-panel-width: 300px;
--right-panel-width: 280px;
--canvas-min-width: 400px;
```

### Widget Cards
```css
--widget-card-size: 100%;  /* Fill grid cell */
--widget-card-padding: 16px 8px;
--widget-card-gap: 8px;
--widget-icon-size: 24px;
--widget-grid-columns: 2;
```

---

## COMPONENT SPECIFICATIONS

### Top Bar
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [←]  Page Title                    [Desktop][Tablet][Mobile]  [Save][Publish] │
└─────────────────────────────────────────────────────────────────────────┘

Height: 56px
Background: white
Border-bottom: 1px solid var(--tw-gray-200)
Box-shadow: 0 1px 3px rgba(0,0,0,0.05)

Back button:
- Icon: ArrowLeft
- Size: 20px
- Color: var(--tw-gray-600)
- Hover: var(--tw-gray-900)

Page title:
- Font: var(--text-base), var(--font-semibold)
- Color: var(--tw-gray-800)
- Max-width: 200px (truncate with ellipsis)

Device toggles:
- Icon buttons in a group
- Active: var(--tw-primary-500) background, white icon
- Inactive: transparent background, var(--tw-gray-500) icon
- Border-radius: 6px
- Size: 32px × 32px

Save Draft button:
- Style: secondary (outlined)
- Border: 1px solid var(--tw-gray-300)
- Background: white
- Color: var(--tw-gray-700)
- Hover: var(--tw-gray-50) background

Publish button:
- Style: primary (filled)
- Background: var(--tw-primary-500)
- Color: white
- Hover: var(--tw-primary-600)
- Border-radius: 6px
- Padding: 8px 16px
```

### Left Panel - Widget Library
```
┌─────────────────────┐
│  Widgets │ Globals  │  ← Tabs
├─────────────────────┤
│ 🔍 Search Widget... │  ← Search input
├─────────────────────┤
│ ▼ Layout            │  ← Category header (collapsible)
│ ┌───────┬───────┐   │
│ │  📦   │  ⊞    │   │  ← Widget cards (2-column grid)
│ │Section│ Grid  │   │
│ └───────┴───────┘   │
│ ┌───────┬───────┐   │
│ │  ▤    │  ⫿    │   │
│ │Columns│ Stack │   │
│ └───────┴───────┘   │
├─────────────────────┤
│ ▼ Content           │
│ ┌───────┬───────┐   │
│ │  T    │  🖼   │   │
│ │Heading│ Image │   │
│ └───────┴───────┘   │
├─────────────────────┤
│ ▶ Commerce          │  ← Collapsed
├─────────────────────┤
│ ▶ Marketing         │
└─────────────────────┘

Width: 300px
Background: var(--tw-gray-50)
Border-right: 1px solid var(--tw-gray-200)

Tabs:
- Height: 44px
- Active tab: var(--tw-primary-500) border-bottom (2px)
- Active text: var(--tw-primary-600)
- Inactive text: var(--tw-gray-500)

Search:
- Margin: 12px
- Background: white
- Border: 1px solid var(--tw-gray-200)
- Border-radius: 6px
- Padding: 8px 12px
- Icon: Search, 16px, var(--tw-gray-400)
- Placeholder: "Search Widget..."

Category header:
- Padding: 12px 16px
- Font: var(--text-sm), var(--font-semibold)
- Color: var(--tw-gray-700)
- Chevron icon: 16px, rotates on expand/collapse
- Hover: var(--tw-gray-100) background
- Cursor: pointer

Widget card:
- Background: white
- Border: 1px solid var(--tw-gray-200)
- Border-radius: 6px
- Padding: 16px 8px
- Display: flex column, align center
- Cursor: grab

Widget card hover:
- Border-color: var(--tw-primary-400)
- Box-shadow: 0 2px 8px rgba(236, 72, 153, 0.15)
- Transform: translateY(-1px)
- Transition: all 0.15s ease

Widget card dragging:
- Opacity: 0.5
- Box-shadow: 0 4px 12px rgba(0,0,0,0.15)

Widget icon:
- Size: 24px
- Stroke-width: 1.5
- Color: var(--tw-gray-500)
- Margin-bottom: 8px

Widget label:
- Font: var(--text-xs), var(--font-medium)
- Color: var(--tw-gray-600)
- Text-align: center

Locked widget (Pro/tier-restricted):
- Opacity: 0.4
- Cursor: not-allowed
- Lock icon: 12px, positioned top-right
- "Upgrade" badge on category header: var(--tw-primary-500)
```

### Left Panel - Block Inspector
```
┌─────────────────────┐
│ ← Back to Widgets   │  ← Back button
├─────────────────────┤
│ [Icon] Heading      │  ← Block name with icon
├─────────────────────┤
│ Content│Style│Adv   │  ← Tabs
├─────────────────────┤
│                     │
│ Text                │  ← Field label
│ ┌─────────────────┐ │
│ │ Hello World     │ │  ← Input field
│ └─────────────────┘ │
│                     │
│ Tag                 │
│ ┌─────────────────┐ │
│ │ H1           ▼  │ │  ← Select dropdown
│ └─────────────────┘ │
│                     │
│ Alignment           │
│ [←] [≡] [→]         │  ← Button group
│                     │
└─────────────────────┘

Back button:
- Padding: 12px 16px
- Font: var(--text-sm)
- Color: var(--tw-gray-600)
- Icon: ArrowLeft, 16px
- Hover: var(--tw-gray-100) background
- Border-bottom: 1px solid var(--tw-gray-200)

Block header:
- Padding: 16px
- Display: flex, align center, gap 8px
- Icon: 20px, var(--tw-gray-500)
- Label: var(--text-base), var(--font-semibold), var(--tw-gray-800)

Inspector tabs:
- Display: flex
- Border-bottom: 1px solid var(--tw-gray-200)
- Tab padding: 12px 16px
- Active: var(--tw-primary-500) border-bottom (2px), var(--tw-primary-600) text
- Inactive: var(--tw-gray-500) text
- Hover: var(--tw-gray-700) text

Field group:
- Padding: 16px
- Border-bottom: 1px solid var(--tw-gray-100)

Field label:
- Font: var(--text-xs), var(--font-medium)
- Color: var(--tw-gray-500)
- Text-transform: uppercase
- Letter-spacing: 0.05em
- Margin-bottom: 6px

Input field:
- Background: white
- Border: 1px solid var(--tw-gray-200)
- Border-radius: 4px
- Padding: 8px 12px
- Font: var(--text-sm)
- Focus: border-color var(--tw-primary-400), ring 2px var(--tw-primary-100)

Select dropdown:
- Same as input
- Chevron icon on right

Button group (alignment, etc):
- Display: inline-flex
- Border: 1px solid var(--tw-gray-200)
- Border-radius: 6px
- Overflow: hidden

Button group item:
- Padding: 8px 12px
- Border-right: 1px solid var(--tw-gray-200)
- Last child: no border
- Active: var(--tw-primary-50) background, var(--tw-primary-500) icon
- Inactive: white background, var(--tw-gray-500) icon
```

### Right Panel - Document Settings
```
┌─────────────────────┐
│ Document            │  ← Panel title
├─────────────────────┤
│                     │
│ Status              │
│ ┌─────────────────┐ │
│ │ Draft        ▼  │ │
│ └─────────────────┘ │
│                     │
│ Visibility          │
│ ┌─────────────────┐ │
│ │ Public       ▼  │ │
│ └─────────────────┘ │
│                     │
│ URL Slug            │
│ ┌─────────────────┐ │
│ │ about-us        │ │
│ └─────────────────┘ │
│ twicely.com/about-us│  ← Preview URL
│                     │
│ Template            │
│ ┌─────────────────┐ │
│ │ Default      ▼  │ │
│ └─────────────────┘ │
│                     │
├─────────────────────┤
│ ▶ Revisions (3)     │  ← Collapsible
└─────────────────────┘

Width: 280px
Background: white
Border-left: 1px solid var(--tw-gray-200)

Panel title:
- Padding: 16px
- Font: var(--text-sm), var(--font-semibold)
- Color: var(--tw-gray-800)
- Text-transform: uppercase
- Letter-spacing: 0.05em
- Border-bottom: 1px solid var(--tw-gray-200)

Fields:
- Same styling as inspector fields
- Padding: 16px

URL preview:
- Font: var(--text-xs)
- Color: var(--tw-gray-400)
- Margin-top: 4px
```

### Canvas
```
┌─────────────────────────────────────────────────────────────┐
│ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · │  ← Gray dotted background
│ ·  ┌───────────────────────────────────────────────────┐  · │
│ ·  │                                                   │  · │
│ ·  │              [Page Content Here]                  │  · │  ← White page
│ ·  │                                                   │  · │
│ ·  │   ┌───────────────────────────────────────────┐   │  · │
│ ·  │   │ Hero Section                    [≡][×]    │   │  · │  ← Selected block
│ ·  │   │                                           │   │  · │     with controls
│ ·  │   │   Welcome to Our Store                    │   │  · │
│ ·  │   │                                           │   │  · │
│ ·  │   └───────────────────────────────────────────┘   │  · │
│ ·  │                                                   │  · │
│ ·  │   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │  · │  ← Drop zone
│ ·  │   ╎          Drop widget here                ╎   │  · │     (dashed border)
│ ·  │   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │  · │
│ ·  │                                                   │  · │
│ ·  └───────────────────────────────────────────────────┘  · │
│ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · │
└─────────────────────────────────────────────────────────────┘

Canvas background:
- Background: var(--tw-canvas-bg)
- Background-image: radial-gradient(circle, var(--tw-gray-300) 1px, transparent 1px)
- Background-size: 20px 20px

Page frame:
- Background: white
- Box-shadow: 0 4px 20px rgba(0,0,0,0.08)
- Border-radius: 2px
- Margin: 40px auto
- Width based on device toggle:
  - Desktop: 100% (max 1200px)
  - Tablet: 768px
  - Mobile: 375px

Block (normal):
- Position: relative
- Transition: all 0.15s ease

Block (hovered):
- Outline: 2px dashed var(--tw-primary-300)
- Outline-offset: 2px

Block (selected):
- Outline: 2px solid var(--tw-primary-500)
- Outline-offset: 2px

Block controls (shown on selected):
- Position: absolute
- Top: -32px
- Right: 0
- Display: flex
- Gap: 2px
- Background: var(--tw-gray-800)
- Border-radius: 4px
- Padding: 4px

Block control button:
- Size: 24px
- Color: white
- Hover: var(--tw-gray-700) background
- Border-radius: 2px
- Icons: GripVertical (drag), Copy, Trash2

Locked block indicator:
- Lock icon badge, top-left
- Background: var(--tw-gray-800)
- Color: white
- Size: 20px
- Border-radius: 4px

Drop zone (when dragging):
- Border: 2px dashed var(--tw-primary-400)
- Background: var(--tw-primary-50)
- Border-radius: 4px
- Min-height: 80px
- Display: flex, align center, justify center
- Text: "Drop widget here"
- Color: var(--tw-primary-500)
```

---

## INTERACTION STATES

### Buttons

| State | Primary | Secondary | Ghost |
|-------|---------|-----------|-------|
| Default | bg: primary-500, text: white | bg: white, border: gray-300 | bg: transparent |
| Hover | bg: primary-600 | bg: gray-50 | bg: gray-100 |
| Active | bg: primary-700 | bg: gray-100 | bg: gray-200 |
| Disabled | bg: gray-300, text: gray-500 | opacity: 0.5 | opacity: 0.5 |

### Inputs

| State | Style |
|-------|-------|
| Default | border: gray-200 |
| Hover | border: gray-300 |
| Focus | border: primary-400, ring: 2px primary-100 |
| Error | border: error, ring: 2px red-100 |
| Disabled | bg: gray-50, text: gray-400 |

### Widget Cards

| State | Style |
|-------|-------|
| Default | bg: white, border: gray-200 |
| Hover | border: primary-400, shadow, translateY(-1px) |
| Dragging | opacity: 0.5, shadow-lg |
| Locked | opacity: 0.4, cursor: not-allowed |

---

## ANIMATIONS

```css
/* Transitions */
--transition-fast: 0.1s ease;
--transition-base: 0.15s ease;
--transition-slow: 0.3s ease;

/* Hover lift */
.hover-lift:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide in from left (for inspector panel) */
@keyframes slideInLeft {
  from { transform: translateX(-10px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* Pulse (for drop zones) */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Skeleton loading */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

---

## ICONS

Use **Lucide React** exclusively:

```tsx
import {
  // Navigation
  ArrowLeft, ChevronDown, ChevronRight, X, Menu,
  
  // Actions
  Save, Upload, Download, Copy, Trash2, Edit, Eye, Plus,
  
  // Devices
  Monitor, Tablet, Smartphone,
  
  // Layout blocks
  Square, Grid, Columns, Rows, AlignVerticalSpaceAround,
  
  // Content blocks
  Type, Image, Video, FileText, Quote,
  
  // UI
  Search, Lock, Unlock, GripVertical, Settings,
  MoreHorizontal, Check, AlertCircle,
} from 'lucide-react';
```

Icon sizes:
- Widget icons: 24px, strokeWidth: 1.5
- UI icons: 16-20px, strokeWidth: 2
- Small badges: 12px

---

## RESPONSIVE BEHAVIOR

### Left Panel
- Default: 300px fixed
- Can be collapsed to icon-only (48px) on smaller screens
- Collapse button at bottom

### Right Panel
- Default: 280px fixed
- Can be collapsed/hidden
- On tablet: overlay mode

### Canvas
- Fills remaining space
- Min-width: 400px
- Centers the page frame
- Scrollable

---

## DARK MODE (Future)

Not required for v1, but design with these CSS variables so it's easy to add later:

```css
:root {
  --bg-primary: white;
  --bg-secondary: var(--tw-gray-50);
  --text-primary: var(--tw-gray-800);
  --text-secondary: var(--tw-gray-600);
  --border-primary: var(--tw-gray-200);
}

[data-theme="dark"] {
  --bg-primary: var(--tw-gray-900);
  --bg-secondary: var(--tw-gray-800);
  --text-primary: var(--tw-gray-100);
  --text-secondary: var(--tw-gray-400);
  --border-primary: var(--tw-gray-700);
}
```

---

## REFERENCE SCREENSHOTS

The editor should look like Elementor but cleaner:

1. **Widget panel** - See uploaded screenshot (2-column grid, icons, categories)
2. **Inspector panel** - Clean form fields, Content/Style/Advanced tabs
3. **Canvas** - White page on gray background, clear selection states
4. **Top bar** - Minimal, device toggles, prominent Publish button

---

## QUALITY CHECKLIST

Before considering the UI complete, verify:

- [ ] All colors use CSS variables (no hardcoded hex)
- [ ] All spacing uses the scale (no arbitrary values)
- [ ] All interactive elements have hover/focus states
- [ ] Transitions are smooth (no jarring changes)
- [ ] Icons are consistent size and weight
- [ ] Typography hierarchy is clear
- [ ] Panel widths are exactly as specified
- [ ] Widget cards match the Elementor screenshot style
- [ ] Canvas shows clear drop zones when dragging
- [ ] Selected blocks have visible controls
- [ ] The overall feel is "premium SaaS", not "developer prototype"

---

**This document + the screenshot you provided = complete visual reference for Claude Code.**
