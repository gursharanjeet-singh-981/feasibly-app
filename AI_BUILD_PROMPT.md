# Feasibly — AI Build Prompt

> **Give this file to any AI coding assistant (GitHub Copilot, Claude, Cursor, etc.) to recreate the full Feasibly project from scratch.**

---

## What is Feasibly?

Feasibly is a **project estimation tool** for design-to-code workflows. It helps teams scope components and templates for web projects (AEM platform) and generates effort estimates with a 20% buffer. Users onboard a project, select components/templates from a categorized library, see real-time dev + design day estimates, and export reports as PDF or Excel.

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16 (App Router) | Framework |
| React | 19 | UI |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling (CSS-based config, no tailwind.config.js) |
| Shadcn/UI | 4 | UI primitives |
| Zustand | 5 | State management with localStorage persistence |
| React Hook Form | 7 | Form handling |
| Zod | 4 | Validation |
| jsPDF | 4 | PDF export |
| ExcelJS | 4 | Excel export |
| Lucide React | — | Icons |

---

## Project Structure

```
feasibly-app/
├── public/
│   ├── data/
│   │   ├── components.json          # 417 components across 37 groups
│   │   ├── templates.json           # 32 templates across categories
│   │   └── global-principles.json   # 5 global principles from Excel
│   └── images/
│       └── icons.svg            # SVG sprite with all icons
├── src/
│   ├── app/
│   │   ├── globals.css          # Tailwind v4 tokens + CSS variables
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Redirects to /onboarding
│   │   ├── onboarding/page.tsx  # Project setup form
│   │   ├── components/page.tsx  # Component selection + estimation
│   │   ├── templates/page.tsx   # Template selection + estimation
│   │   └── global-principles/page.tsx  # Static principles table
│   ├── components/
│   │   ├── AppHeader.tsx        # Shared header with logo + tabs
│   │   ├── EstimationPanel.tsx  # Right sidebar with metrics + export
│   │   ├── SvgIcon.tsx          # SVG sprite renderer
│   │   └── ui/                  # Shadcn components (button, input, checkbox, etc.)
│   ├── lib/
│   │   ├── calculations.ts     # Estimation math
│   │   ├── data.ts             # JSON data loaders
│   │   ├── exportPdf.ts        # jsPDF branded report
│   │   ├── exportExcel.ts      # ExcelJS styled workbook
│   │   └── utils.ts            # cn() utility
│   ├── store/
│   │   └── index.ts            # Zustand store with persist
│   └── types/
│       └── index.ts            # All TypeScript interfaces
├── scripts/
│   └── importExcel.js          # Data conversion script
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
└── components.json             # Shadcn config
```

---

## Design Tokens (from Figma)

```css
--cobalt:            #0029DA   /* Primary brand, CTA backgrounds, left panel */
--sky-blue:          #0094FA   /* Icon badges */
--background-blue:   #F1F5F9   /* Page background */
--white:             #FFFFFF   /* Inputs, cards */
--black:             #000000   /* Headings */
--light-grey-text:   #484A4B   /* Body/help text */
--light-white-text:  #B2BFF4   /* Subtitle on dark bg */
--placeholder-text:  #A6A6A6   /* Input placeholders */
--strokes:           #D9D9D9   /* Borders */
--dark-background:   #CCD3E1   /* Checkbox borders */
```

**Font:** Inter (primary), Proxima Nova (fallback)  
**Border radius:** Inputs/buttons = pill (`rounded-full`), icon badges = `rounded-[15px]`, checkboxes = `rounded-[5px]`

---

## Screens to Build (5 total)

### Screen 1: Onboarding (`/onboarding`)

**Layout:** Split — cobalt (#0029DA) left panel + white/light-grey right panel with form.

**Left Panel (624px on desktop):**
- Feasibly logo + "a Merkle tool" subtitle
- Headline: "Great projects start with great scope"
- Subtext: "Build accurate design-to-code project estimates in minutes..."

**Right Panel — Form (4 sections):**

1. **Project Name*** (folder icon in sky-blue badge)
   - Helper: "Your final excel will be exported with this name"
   - Input: pill-shaped, placeholder "Name your project"
   
2. **Live Site URL** (link icon in sky-blue badge)
   - Helper: "Feasibly will use this URL to analyse the live site and select the components and templates that you should be scoping for."
   - Input: pill-shaped, placeholder "Paste brand URL"
   
3. **Scope*** (grid icon in sky-blue badge)
   - Helper: "Select what you'd like to scope out"
   - Two checkboxes: "Components", "Templates" (multi-select, at least 1 required)
   
4. **Platform*** (inbox icon in sky-blue badge)
   - AEM checkbox (pre-selected, disabled)

**CTA Button:** "Let's scope the project" → resets store state → saves project to store → navigates to `/components` if Components scope selected, or `/templates` if only Templates selected.

**State Reset:** On mount of the onboarding page, call `resetStore()` to clear all previous project data (components, templates, project info). This ensures a fresh start each time.

**Validation:** Zod schema — projectName required, URL optional (valid if provided), at least 1 scope checkbox required.

---

### Screen 2: Components Selection (`/components`)

**Layout:** Top-level flex row — left column (AppHeader + scrollable table) and right column (estimation panel, full viewport height). The header does NOT span the full page width; it only spans the left content area. The estimation panel sits alongside from the very top of the page.

**AppHeader:**
- Structure is a flex row with three sections:
  1. **Feasibly Logo** (separate, top-aligned with `items-start`): Red arrow icon (`text-[#F1012F]`) + "Feasibly" bold text (`text-[#020E4E]`) + "a Merkle tool" small subtitle (opacity 50%). This is a standalone flex item, NOT nested inside the Project section.
  2. **Header Content** (flex-1, contains Project info + Tabs in a flex row with `items-end` so Input and Tabs bottom-align):
     - Left: Sky-blue folder badge (30×30, `rounded-[9px]`) + "Project" label above, editable project name input (pill, `h-[60px]`, `w-[245px]`) below. Gap of 10px between label row and input.
     - Right: Tab navigation in a pill container (`rounded-[1000px]`, `p-3`, `gap-5`) — Components | Templates | Global Principles (with 24×24 SVG icons, `gap-[5px]` between icon and label, active tab has blue border + background)
- Key alignment: Logo is top-aligned with Project text. Input field and Tabs container are bottom-aligned with each other. The Tabs must NOT float up to the Project text level.

**Left Column — Component Table:**
- Toolbar: page title "Components List", checkbox (selects/deselects all components on the page), "Activate AI-Powered Estimation" placeholder label, "Add component" button (cobalt pill, circle-plus icon ⊕), search input
- Table grouped by `group` field into collapsible accordion sections
- Each group header: checkbox to select/deselect all in group + group name + chevron
- Each row: checkbox | component name | category label | design description | dev description | design effort | dev effort
- **Category label ("Core" tag):** Pill badge with `bg-[#f4e4e7]`, `p-2` (8px all around), `gap-1.5` (6px), red heart icon at 12×12 (`text-red-500`), `text-xs` (12px). Non-core categories use `bg-[#e4ecf4]` without a heart icon.
- Rows are filterable by search
- **Add row button:** Right-aligned (`justify-end`) within each accordion group. Clicking adds a new blank row where all fields are editable inline (name, category, descriptions, design/dev effort as `<input>` fields with placeholders). Pre-loaded data rows remain read-only.

**Right Column — Estimation Panel** (shared component, see below)

---

### Screen 3: Templates Selection (`/templates`)

Same layout as Components page, but:
- Title: "Templates List"
- Grouped by template `name` field
- Extra column: "Additional effort per page" with numeric input per template
- Template effort = base + (additionalPages × perPage rate)
- **Add row button:** Right-aligned, adds editable blank row (same pattern as Components)
- **Category label:** Same Core tag styling as Components (red heart, pink pill)

---

### Screen 4: Global Principles (`/global-principles`)

**Layout:** AppHeader + two-column (table left, estimation panel right). Same top-level flex row layout as Components/Templates — header inside left column, estimation panel full height on right.

**Table content (loaded from `/data/global-principles.json`):**
| Global Parameter | Design Description | Development Description |
|---|---|---|
| Responsiveness | All designs are fully responsive... | All designs are fully responsive... |
| Accessibility | All components and screens should be accessible... | All components and screens should be accessible... |
| Languages | Translations are out of scope for design... | Market and translations should be scoped separately. |
| Analytics | N/A for design. | Implementing the analytics layer... |
| CSS Layout Changes | Anything that can be achieved with CSS... | Building author-configurable style controls... |

- No checkboxes in this table (unlike Components/Templates pages)
- Desktop: 3-column table with borders
- Mobile: stacked card layout
- Data fetched on mount via `loadGlobalPrinciples()` from `/data/global-principles.json`

---

### Screen 5: Estimation Panel (shared right sidebar)

**Container:** The estimation panel wrapper uses `lg:sticky lg:top-0 lg:h-screen` so it sticks to the viewport and spans full height. The panel itself uses `h-full overflow-y-auto` to fill its container and scroll internally if content overflows. Background: `#e3e7ef`, `rounded-[60px]` on desktop, `w-[529px]` fixed width on desktop.

**Metrics displayed (conditionally based on project scope):**
- Total Components (components icon) — only shown if `project.scope.components` is true
- Total Variants (graph icon) — same count as components, only shown if `project.scope.components` is true
- Total Templates (file-copy icon) — only shown if `project.scope.templates` is true
- Additional Pages (add-to-queue icon) — only shown if `project.scope.templates` is true

**Development Card:**
- Developer mode icon in cobalt badge
- "{X} days" (large text)
- "{Y} weeks" + "Incl. 20% buffer time"
- "Includes both Front-end & Back-end"

**Design Card:**
- Pencil icon in cobalt badge
- "{X} days" (large text)
- "{Y} weeks" + "Incl. 20% buffer time"
- "Includes both UX & UI"

**Export Buttons:**
- "Export PDF Report" — cobalt filled pill button
- "Export Excel Report" — cobalt outlined pill button

---

## TypeScript Interfaces

```typescript
interface Component {
  id: number;
  group: string;            // accordion grouping key
  name: string;
  category: string;
  designDescription: string;
  developmentDescription: string;
  designEffort: number;     // days
  devEffort: number;        // days
  assumptions: string;
}

interface SelectedComponent extends Component {
  isSelected: boolean;
}

interface Template {
  id: number;
  name: string;             // grouped by this
  category: string;
  description: string;
  designEffortBase: number;
  designEffortPerPage: number;
  devEffortBase: number;
  devEffortPerPage: number;
}

interface SelectedTemplate extends Template {
  isSelected: boolean;
  additionalPages: number;  // user input
}

interface Project {
  projectName: string;
  liveUrl: string;
  scope: { components: boolean; templates: boolean };
  platform: "AEM";
}

interface EstimationSummary {
  totalComponents: number;
  totalTemplates: number;
  totalAdditionalPages: number;
  designDays: number;
  designDaysWithBuffer: number;
  designWeeks: number;
  devDays: number;
  devDaysWithBuffer: number;
  devWeeks: number;
}
```

---

## Estimation Formulas

```typescript
const BUFFER_MULTIPLIER = 1.2;  // 20% buffer
const DAYS_PER_WEEK = 5;

// Component effort = sum of selected components' designEffort / devEffort

// Template effort per template:
templateDesignEffort = designEffortBase + (additionalPages * designEffortPerPage)
templateDevEffort = devEffortBase + (additionalPages * devEffortPerPage)

// Totals:
designDaysWithBuffer = totalDesignDays * 1.2
devDaysWithBuffer = totalDevDays * 1.2
designWeeks = Math.ceil(designDaysWithBuffer / 5)
devWeeks = Math.ceil(devDaysWithBuffer / 5)
```

---

## Zustand Store

```typescript
// Key: "feasibly-storage" in localStorage
// State:
- project: Project
- setProject(project)
- components: SelectedComponent[]
- setComponents(components)
- toggleComponent(id)         // toggle isSelected
- addComponent(group)         // add blank editable row to group (marked with assumptions="__custom__")
- updateComponent(id, updates) // update any field on a component (for editable custom rows)
- templates: SelectedTemplate[]
- setTemplates(templates)
- toggleTemplate(id)          // toggle isSelected
- setAdditionalPages(id, pages)
- addTemplate(group)          // add blank editable row
- updateTemplate(id, updates) // update any field on a template (for editable custom rows)
- resetStore()                 // clears project, components, templates back to defaults (called on onboarding mount)
- getEstimation(): EstimationSummary  // computed from selections
```

Use `persist` middleware from `zustand/middleware` with localStorage.

---

## Data Loading

Components, templates, and global principles are stored as JSON in `public/data/` and loaded via `fetch()`:

```typescript
// src/lib/data.ts
export interface GlobalPrinciple {
  id: number;
  name: string;
  designDescription: string;
  developmentDescription: string;
}

export async function loadComponents(): Promise<Component[]> {
  const response = await fetch("/data/components.json");
  return response.json();
}

export async function loadTemplates(): Promise<Template[]> {
  const response = await fetch("/data/templates.json");
  return response.json();
}

export async function loadGlobalPrinciples(): Promise<GlobalPrinciple[]> {
  const response = await fetch("/data/global-principles.json");
  return response.json();
}
```

On mount, if store is empty, load data and map to `SelectedComponent[]` / `SelectedTemplate[]` (with `isSelected: false`, `additionalPages: 0`). Global Principles page loads its own data independently via `loadGlobalPrinciples()`.

---

## Sample Data

### Components (417 total, 37 groups)

Groups include: CTA (5), Accordion (9), Breadcrumbs (19), Carousel (8), Forms (28), Image (10), Search (13), Teaser (16), Tabs (12), etc.

Sample component:
```json
{
  "id": 1,
  "group": "CTA",
  "name": "CTA with icon (3 sizes, default states)",
  "category": "Core",
  "designDescription": "CTA may include an icon positioned left, right, or shown on hover...",
  "developmentDescription": "Uses Core Button component with icon support...",
  "designEffort": 2,
  "devEffort": 8,
  "assumptions": ""
}
```

### Templates (32 total)

Categories: Homepage, Listing Page, PDP, Article Page, Event Page, Landing Page, Checkout (5 steps), My Account (8 pages), Registration & Login (3), Store Locator, Gift Finder, etc.

Sample template:
```json
{
  "id": 1,
  "name": "Homepage",
  "category": "Core",
  "description": "High-level layout defining key entry points, hero areas...",
  "designEffortBase": 32,
  "designEffortPerPage": 8,
  "devEffortBase": 24,
  "devEffortPerPage": 6
}
```

---

## SVG Icon Sprite System

Create an SVG sprite at `public/images/icons.svg` with these icons (referenced via `<use href>`):
- `icon-feasibly-logo` — Feasibly brand mark
- `icon-folder-shared` — Folder icon
- `icon-components` — Grid/components icon
- `icon-file-copy` — Documents/templates icon
- `icon-flag` — Flag/principles icon
- `icon-graph` — Chart/variants icon
- `icon-add-to-queue` — Plus/queue icon
- `icon-developer-mode` — Code brackets icon
- `icon-pencil` — Pencil/edit icon
- `icon-info` — Info circle icon

Reusable component:
```tsx
function SvgIcon({ name, className, width = 16, height = 16 }) {
  return (
    <svg className={className} width={width} height={height} aria-hidden="true">
      <use href={`/images/icons.svg#icon-${name}`} />
    </svg>
  );
}
```

---

## PDF Export (jsPDF)

Generates a branded A4 PDF with:
1. **Cover section** — Cobalt header bar with "Feasibly" + project name
2. **Project details** — Name, URL, Scope, Platform, Date
3. **Estimation summary** — Dev days/weeks, Design days/weeks (with buffer)
4. **Components table** — Grouped by category, with effort columns
5. **Templates table** — With base + additional page effort

Use Feasibly color tokens for styling (cobalt headers, sky-blue group rows, alternating row backgrounds).

---

## Excel Export (ExcelJS)

Generates a styled .xlsx with 3 sheets:
1. **Summary** — Project details + estimation totals
2. **Components** — All selected components grouped by category
3. **Templates** — All selected templates with page calculations

Styling: Cobalt headers with white text, sky-blue group headers, alternating row colors, borders.

---

## Key Implementation Details

1. **Tailwind v4**: No `tailwind.config.js`. All tokens defined as CSS custom properties in `globals.css` using `@theme inline {}` block.

2. **Shadcn v4**: Install via `npx shadcn@latest init`. Components needed: Button, Input, Checkbox, Card, Table, Accordion, Tabs, Label.

3. **App Router**: All pages are in `src/app/[route]/page.tsx`. Use `"use client"` directive for interactive pages.

4. **Root page** (`/`): Simply redirects to `/onboarding`.

5. **Responsive**: All pages use `flex-col lg:flex-row` patterns. Mobile stacks vertically, desktop shows side-by-side.

6. **Export code splitting**: PDF and Excel exports use dynamic `import()` to avoid bundling large libraries on initial load.

7. **Estimation Panel**: Shared component used on Components, Templates, and Global Principles pages.

8. **Search/Filter**: Components and Templates pages have a search input that filters by name, group/category, and descriptions.

9. **Group accordions**: Click chevron to expand/collapse. Click group checkbox to select/deselect all items in that group.

---

## Setup Commands

```bash
# Create the project
npx create-next-app@latest feasibly-app --typescript --tailwind --eslint --app --src-dir

# Install dependencies
cd feasibly-app
npm install zustand react-hook-form @hookform/resolvers zod jspdf exceljs html2canvas lucide-react @tanstack/react-table @base-ui/react class-variance-authority clsx tailwind-merge tw-animate-css

# Initialize Shadcn
npx shadcn@latest init
npx shadcn@latest add button input checkbox card table accordion tabs label

# Run dev server
npm run dev
```

---

## Build Order (Recommended)

1. **Setup** — Create Next.js project, install deps, configure Tailwind tokens in globals.css
2. **Types** — Define all TypeScript interfaces in `src/types/index.ts`
3. **Store** — Create Zustand store with persist middleware
4. **Data** — Create JSON data files and loader functions
5. **Shared Components** — SvgIcon, AppHeader, EstimationPanel
6. **Onboarding Page** — Form with validation
7. **Components Page** — Table with accordions + search
8. **Templates Page** — Similar to components + additional pages input
9. **Global Principles Page** — Table loaded from JSON (no hardcoded data)
10. **Exports** — PDF and Excel generation
11. **Polish** — Responsive design, edge cases

---

## Notes

- The estimation panel background is `#e3e7ef` (slightly darker than page background)
- Estimation cards (dev/design) are white with border-strokes and `rounded-[40px]`
- The panel itself is `rounded-[60px]` on desktop
- All pill inputs are `h-[60px] rounded-full` on desktop
- Tab navigation container is a white pill with border
- Active tab has `bg-background-blue border border-cobalt`
- Icon badges (in onboarding + header) are `w-[50px] h-[50px] bg-sky-blue rounded-[15px]`

---

## UI Component States (from Figma Design System)

### Input Fields (5 states)
- **Default**: Border `#D9D9D9`, placeholder text `#A6A6A6`
- **Input/Active**: Border `#0029DA` (cobalt), text `#000000`
- **Hover**: Border slightly darker
- **Selected/Focused**: Ring/outline cobalt
- **Error**: Border `#EF4444` (destructive red), error message below

### Checkboxes (4 states)
- **Default**: White background, border `#CCD3E1`, `rounded-[5px]`, unchecked
- **Hover**: Border darkens slightly
- **Selected**: Fill dark navy `#020E4E` (NOT cobalt), white checkmark
- **Selected by default**: Same as selected (used for AEM platform checkbox)

### Tabs (3 states)
- **Default**: Text `#484A4B`, no background
- **Hover**: Light grey background
- **Selected/Active**: `bg-background-blue`, `border border-cobalt`, text black, icon turns cobalt

### CTA Buttons
- Primary: `bg-cobalt text-white`, pill shape, hover `bg-cobalt/90`
- Outline: `border-cobalt text-cobalt`, pill shape, hover `bg-cobalt/10`

### Accordions (2 states)
- **Collapsed**: Chevron pointing right/down, content hidden
- **Expanded**: Chevron rotated, content visible below

---

## Responsive Breakpoints

```
Mobile:  < 768px   → Single column, stacked layouts
Tablet:  768-1023px → Intermediate sizing
Desktop: ≥ 1024px  → Side-by-side (lg: prefix in Tailwind)
```

Key responsive patterns:
- Onboarding: `flex-col lg:flex-row` (stacks on mobile)
- Component/Template pages: Table + Panel → stacks vertically on mobile
- AppHeader: Logo row + tabs row on mobile, single row on desktop
- Tables: Full columns on desktop, simplified/stacked on mobile
- Estimation Panel: Full width on mobile, fixed 529px on desktop

---

## Excel-to-JSON Import Script

The project includes `scripts/importExcel.js` for converting Excel data to JSON. It reads 3 sheets:
- **Components** → `public/data/components.json`
- **Templates** → `public/data/templates.json`
- **Global Principles** → `public/data/global-principles.json`

```javascript
// scripts/importExcel.js
// Usage: node scripts/importExcel.js
// Reads from "FF - Data Set 1.xlsx" (relative to project root)
// Uses ExcelJS (not xlsx package) for parsing

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function convertExcel() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(__dirname, '../../FF - Data Set 1.xlsx'));

  // Components sheet (data starts row 3)
  // Col 2: Name/Group, Col 3: Category, Col 4: Variant/Name
  // Col 5: Design Desc, Col 6: Dev Desc, Col 7: Design Effort, Col 9: Dev Effort, Col 11: Assumptions

  // Templates sheet (data starts row 4)
  // Col 2: Name, Col 3: Category, Col 4: Description
  // Col 5: Design Effort Base, Col 7: Design Per Page, Col 8: Dev Effort Base, Col 10: Dev Per Page

  // Global Principles sheet (data starts row 4)
  // Col 2: Global Parameter, Col 3: Design Description, Col 4: Development Description

  // ... parsing logic ...

  const outDir = path.resolve(__dirname, '../public/data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'components.json'), JSON.stringify(components, null, 2));
  fs.writeFileSync(path.join(outDir, 'templates.json'), JSON.stringify(templates, null, 2));
  fs.writeFileSync(path.join(outDir, 'global-principles.json'), JSON.stringify(globalPrinciples, null, 2));
}

convertExcel().catch(console.error);
```

### Global Principles JSON format:
```json
[
  {
    "id": 1,
    "name": "Responsiveness",
    "designDescription": "All designs are fully responsive...",
    "developmentDescription": "All designs are fully responsive..."
  }
]
```

To update data: modify Excel → run `node scripts/importExcel.js` → refresh app. No rebuild needed.

---

## Deployment (Vercel)

```bash
# 1. Push code to GitHub
git init && git add . && git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main

# 2. Go to vercel.com → "New Project" → select GitHub repo → Deploy
# No config needed — Vercel auto-detects Next.js

# 3. Auto-deploys on every push to main
# Live at: https://your-project.vercel.app
```

Free tier is sufficient for this project (no backend, no database).

---

## Success Criteria

- [ ] App loads in < 3 seconds
- [ ] All 4 pages render without errors
- [ ] JSON data (417 components, 32 templates, 5 global principles) loads and displays correctly
- [ ] Search/filter works across name, group, and descriptions
- [ ] Accordion expand/collapse and group select/deselect works
- [ ] Real-time estimation updates when toggling selections
- [ ] Calculation matches: `(sum of efforts) × 1.2` buffer, weeks = `ceil(days/5)`
- [ ] PDF export generates a valid, branded .pdf file
- [ ] Excel export generates a valid, styled .xlsx file
- [ ] localStorage persists project + selections across page refreshes
- [ ] Works on mobile (iPhone/Android) — responsive layouts
- [ ] Works on Chrome, Safari, Firefox, Edge

---

## MVP Limitations

- Data is stored in browser `localStorage` — cleared if user clears browser cache
- No user accounts — each browser/device has separate data
- No project sharing or collaboration
- No cross-device sync
- No analytics or usage tracking
- Component data updates require redeployment (or manual JSON file swap)

---

## Future Enhancements (not part of MVP)

- User authentication + database backend
- AI-powered component suggestions from URL analysis
- Team collaboration & project sharing
- Historical project tracking & comparison
- Budget/cost estimation (not just effort days)
- Multi-platform support beyond AEM
