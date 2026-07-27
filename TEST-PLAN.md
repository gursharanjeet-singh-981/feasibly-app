# Feasibly App — Test Plan

**Version:** 1.0  
**Created:** 2025-07-24  
**Last Updated:** 2025-07-24  
**Figma Design:** [Feasibly Feasibility Framework](https://www.figma.com/design/geXfeUtvC7bjnGZOQUKCKZ/Feasibly--Feasibility-Framework-?node-id=45-431&m=dev)

---

## 1. Purpose

This test plan provides a reusable, structured framework for QA testing the Feasibly web application. It covers functional testing, visual/design fidelity, state management, responsive behavior, and accessibility. It is designed to be executed after each sprint or significant code change.

---

## 2. Scope

### In Scope
- Onboarding page (`/onboarding`)
- Components page (`/components`)
- Templates page (`/templates`)
- Global Principles page (`/global-principles`)
- Shared components: AppHeader, EstimationPanel
- State management (Zustand store persistence)
- Cross-browser compatibility (Chrome, Firefox, Safari)
- Responsive design (Desktop, Tablet, Mobile)
- Navigation flows
- Data loading & error states

### Out of Scope
- Backend/API testing (app uses static JSON data)
- Performance/load testing
- Security testing
- PDF export functionality (button exists but not implemented)
- AI-Powered Estimation feature (checkbox exists but not functional)

---

## 3. Test Environment

| Item | Details |
|------|---------|
| **Framework** | Next.js 16.x (App Router) |
| **Node.js** | v18+ |
| **Dev Command** | `npm run dev` (uses `--webpack` flag) |
| **URL** | http://localhost:3000 |
| **Browsers** | Chrome (latest), Firefox (latest), Safari (latest) |
| **Viewports** | Desktop (1920×1080), Tablet (768×1024), Mobile (375×812) |

---

## 4. Test Cases

### 4.1 Onboarding Page (`/onboarding`)

#### TC-ONB-001: Page Load & Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/` or `/onboarding` | Onboarding page loads with two-panel layout |
| 2 | Verify left panel | Cobalt blue (#0029DA) background, Feasibly logo with mark + "a Merkle tool" subtitle, hero text at bottom |
| 3 | Verify right panel | Form with "LET'S SET IT UP" label, "Create a new project" heading |
| 4 | Verify form sections | 4 sections visible: Project Name, Live URL, Scope, Platform |

#### TC-ONB-002: Form Fields — Empty State
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check project name field | Placeholder: "Name your project", rounded pill shape, empty |
| 2 | Check live URL field | Placeholder: "Paste brand URL", rounded pill shape, empty |
| 3 | Check scope checkboxes | "Components" and "Templates" both unchecked |
| 4 | Check platform checkbox | "AEM" checked and disabled |

#### TC-ONB-003: Form Section Icons
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify each section icon | Blue rounded square (sky-blue #0094FA) background with white icon |
| 2 | Verify icon types | Folder (project name), Link (URL), Clipboard (scope), Monitor (platform) |
| 3 | Verify icon size | ~50×50px on desktop, ~40×40px on mobile |

#### TC-ONB-004: Form Validation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Create Project" with empty fields | Validation error for Project Name (required) |
| 2 | Enter project name only | Validation passes (URL optional, scope optional) |
| 3 | Enter project name, check Components | Form submits successfully |
| 4 | Enter project name, check Templates | Form submits successfully |
| 5 | Enter project name, check both | Form submits successfully |

#### TC-ONB-005: Form Submission & Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill form with valid data | No errors shown |
| 2 | Click "Create Project" | Navigates to `/components` |
| 3 | Verify data persistence | Project name appears in AppHeader input on components page |
| 4 | Refresh browser | Data persists (Zustand localStorage) |

#### TC-ONB-006: Onboarding Logo & Branding
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check logo in left panel | Feasibly arrow/chevron icon + "Feasibly" text |
| 2 | Check subtitle | "a Merkle tool" text below logo |
| 3 | Verify logo color | White text and icon on cobalt background |

---

### 4.2 Components Page (`/components`)

#### TC-CMP-001: Page Load & Data
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/components` | Page loads with components data from `/data/components.json` |
| 2 | Verify accordion groups | Components grouped by `group` field (e.g., CTA, Accordions, Forms) |
| 3 | Verify data loading | No empty state; all groups populated |

#### TC-CMP-002: AppHeader
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify Feasibly logo | Logo mark + "Feasibly" + "a Merkle tool" at top-left |
| 2 | Verify Project section | Folder icon + "Project" label + Brand Name input |
| 3 | Verify navigation tabs | Components (active), Templates, Global Principles tabs in pill container |
| 4 | Verify active tab style | Blue border + blue background tint for "Components" tab |

#### TC-CMP-003: Toolbar
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify title | "Components List" heading visible |
| 2 | Verify AI checkbox | "Activate AI-Powered Estimation" checkbox present, unchecked |
| 3 | Verify "Add component" button | Blue pill button with "Add component ⊕" text |
| 4 | Verify search bar | Rounded pill input with "Search for component" placeholder and search icon |

#### TC-CMP-004: Accordion Behavior
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify initial state | All accordion groups collapsed |
| 2 | Click accordion header | Group expands, chevron rotates 180°, table appears |
| 3 | Click expanded header | Group collapses, chevron returns to default |
| 4 | Expand multiple groups | Multiple groups can be open simultaneously |

#### TC-CMP-005: Component Table Columns
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand any accordion group | Table with columns visible |
| 2 | Verify columns | Variant, Category, Design, Development, Design Effort, Dev Effort |
| 3 | Verify header row | Blue background row with bold text |
| 4 | Verify "select all" checkbox | Checkbox in Variant column header selects all rows in group |

#### TC-CMP-006: Component Selection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click checkbox on a component row | Checkbox toggles to checked (blue) |
| 2 | Verify estimation update | EstimationPanel "Total Components" count increments |
| 3 | Uncheck component | Count decrements, estimation recalculates |
| 4 | Click "select all" checkbox | All components in group selected |
| 5 | Verify bulk estimation | All effort values added to estimation |

#### TC-CMP-007: Category Badge
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find "Core" category in table | Pink/rose pill badge with heart icon + "Core" text |
| 2 | Verify badge styling | Rounded corners, readable text |

#### TC-CMP-008: Search Functionality
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type search query | Accordion groups filter in real-time |
| 2 | Search by component name | Only matching components/groups shown |
| 3 | Clear search | All groups visible again |
| 4 | Search with no results | Empty state or no groups shown |

---

### 4.3 Templates Page (`/templates`)

#### TC-TPL-001: Page Load & Data
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/templates` via tab | Page loads with templates from `/data/templates.json` |
| 2 | Verify active tab | "Templates" tab has active styling |
| 3 | Verify data loading | All templates loaded and displayed |

#### TC-TPL-002: Toolbar
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify title | "Templates List" heading visible |
| 2 | Verify AI checkbox | "Activate AI-Powered Estimation" checkbox present |
| 3 | Verify "Add template" button | Blue pill button with "Add template ⊕" text |
| 4 | Verify search bar | Rounded pill input with placeholder and icon |

#### TC-TPL-003: Template Structure (Accordion Groups)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify template grouping | Templates organized in accordion groups (matching Figma) |
| 2 | Expand a group | Table with rows appears |
| 3 | Verify table columns | Variant, Category, Template Description, Design Effort, Additional effort per page, Dev Effort, Additional effort per page |

#### TC-TPL-004: Template Selection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check template checkbox | Template selected, estimation updates |
| 2 | Verify "Total Templates" | Count increments in EstimationPanel |
| 3 | Select all in group | All templates in group selected |

#### TC-TPL-005: Additional Pages Input
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find additional pages input | Number input field per template row |
| 2 | Enter a positive number | Value accepted, estimation recalculates |
| 3 | Enter 0 | Value resets to 0, no extra effort added |
| 4 | Enter negative number | Value clamped to 0 |

#### TC-TPL-006: Search Functionality
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type template name | Results filter in real-time |
| 2 | Search by category | Matching templates shown |
| 3 | Search by description | Matching templates shown |

---

### 4.4 Global Principles Page (`/global-principles`)

#### TC-GP-001: Page Load & Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/global-principles` | Page loads with table |
| 2 | Verify title | "Global Principles" heading visible |
| 3 | Verify active tab | "Global Principles" tab has active styling |

#### TC-GP-002: Table Structure
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify columns | Global Parameter, Design Description, Development Description |
| 2 | Verify header row | Blue background, bold text |
| 3 | Verify data row | "Responsiveness" with full descriptions visible |

#### TC-GP-003: Content
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Read Design Description | Text about responsive design across breakpoints — fully visible, not truncated |
| 2 | Read Development Description | Text about CSS media queries and fluid grids — fully visible, not truncated |

---

### 4.5 EstimationPanel (Shared Component)

#### TC-EST-001: Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify title | "Your estimation" heading |
| 2 | Verify stats grid | 4 stats: Total Components, Total Variants, Total Templates, Additional Pages |
| 3 | Verify stat icons | Each stat has an icon + label + subtitle + number |
| 4 | Verify cards | Development card and Design card with blue icons |

#### TC-EST-002: Calculation Accuracy
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select 1 component (e.g., 3h design, 8h dev) | Total Components = 1, Design days = 3×1.2 = 3.6, Dev days = 8×1.2 = 9.6 |
| 2 | Select 1 template with 2 additional pages | Effort = base + (2 × per_page), multiplied by 1.2 buffer |
| 3 | Verify weeks calculation | Days ÷ 5, rounded up |
| 4 | Deselect all | All values return to 0 |

#### TC-EST-003: Development Card
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify icon | Blue square with code icon |
| 2 | Verify days display | "X.X days" format with buffer |
| 3 | Verify weeks | "X weeks" |
| 4 | Verify buffer note | "Incl. 20% buffer time" |
| 5 | Verify subtitle | "Includes both Front-end & Back-end" |
| 6 | Verify info icon | ⓘ icon in top-right corner |

#### TC-EST-004: Design Card
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify icon | Blue square with pencil icon |
| 2 | Verify content | Same format as Development card |
| 3 | Verify subtitle | "Includes both UX & UI" |

#### TC-EST-005: Export Button
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify button | "Export PDF Report" with download icon |
| 2 | Verify styling | Blue cobalt, rounded pill, full-width |
| 3 | Click button | Expected behavior (PDF download or placeholder) |

---

### 4.6 Navigation & Routing

#### TC-NAV-001: Tab Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Components" tab | Navigates to `/components`, tab becomes active |
| 2 | Click "Templates" tab | Navigates to `/templates`, tab becomes active |
| 3 | Click "Global Principles" tab | Navigates to `/global-principles`, tab becomes active |
| 4 | Use browser back | Returns to previous page |

#### TC-NAV-002: Direct URL Access
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/` | Redirects to `/onboarding` |
| 2 | Navigate to `/components` directly | Components page loads |
| 3 | Navigate to `/templates` directly | Templates page loads |
| 4 | Navigate to `/global-principles` directly | Global Principles page loads |
| 5 | Navigate to `/nonexistent` | 404 page or redirect |

#### TC-NAV-003: State Persistence
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Complete onboarding | Data saved to localStorage |
| 2 | Navigate between tabs | Data persists across pages |
| 3 | Refresh browser | All data remains (Zustand persist) |
| 4 | Open in new tab | Data available (shared localStorage) |

---

### 4.7 Responsive Design

#### TC-RES-001: Desktop (1920×1080)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View onboarding | Two-panel side-by-side layout |
| 2 | View inner pages | Content + EstimationPanel side-by-side |
| 3 | Verify tables | Full table with all columns visible |

#### TC-RES-002: Tablet (768×1024)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View onboarding | Panels may stack vertically |
| 2 | View inner pages | Content and panel may stack |
| 3 | Verify tables | Horizontal scroll or responsive layout |
| 4 | Verify tabs | Tab labels visible, may be more compact |

#### TC-RES-003: Mobile (375×812)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View onboarding | Panels stack vertically |
| 2 | View inner pages | Content above, estimation panel below |
| 3 | Verify component/template rows | Card layout instead of table |
| 4 | Verify tabs | Icons only, labels hidden |
| 5 | Verify inputs | Full-width, touch-friendly (min 44px height) |

---

### 4.8 Visual Design Fidelity

#### TC-VIS-001: Colors
| Token | Expected Value | Where to Check |
|-------|---------------|----------------|
| `--cobalt` | `#0029DA` | Buttons, active states, icons |
| `--sky-blue` | `#0094FA` | Icon backgrounds (onboarding) |
| `--background-blue` | `#F1F5F9` | Page backgrounds, table headers |
| `--light-grey-text` | `#484A4B` | Subtitles, descriptions |
| `--strokes` | `#D9D9D9` | Borders, table dividers |
| `--dark-background` | `#CCD3E1` | Estimation panel background |

#### TC-VIS-002: Border Radius
| Element | Expected Radius |
|---------|----------------|
| Input fields | `rounded-full` (fully rounded pill) |
| Buttons | `rounded-full` |
| Content cards | `rounded-[40px]` (desktop) |
| Estimation panel | `rounded-[60px]` (desktop) |
| Icon containers | `rounded-[15px]` or `rounded-lg` |
| Table container | `rounded-2xl` |
| Checkboxes | `rounded-[5px]` |

#### TC-VIS-003: Typography
| Element | Size | Weight |
|---------|------|--------|
| Page title | 30px (desktop) | Semibold (600) |
| Section headings | 20px | Semibold (600) |
| Table headers | 14px (sm) | Semibold (600) |
| Table body | 12px (xs) | Regular (400) |
| Button text | 16px (base) | Medium (500) |
| Stat numbers | 40px (desktop) | Regular (400) |

---

## 5. Component State Matrix

| Component | States to Test |
|-----------|---------------|
| **Checkbox** | Unchecked, Checked, Disabled, Hover |
| **Accordion** | Collapsed, Expanded, Hover on header |
| **Tab** | Active, Inactive, Hover |
| **Input** | Empty (placeholder), Filled, Focused, Error |
| **Button** | Default, Hover, Active/Pressed, Disabled |
| **Category Badge** | Core (pink + heart), Other categories |
| **Search Input** | Empty, Typing, Has results, No results |

---

## 6. Data Validation

#### TC-DATA-001: Components JSON
| Check | Expected |
|-------|----------|
| File exists | `/public/data/components.json` |
| Structure | Array of objects with: id, group, name, category, designDescription, developmentDescription, designEffort, devEffort, assumptions |
| Groups | At least 3 groups (CTA, Accordions, Forms, etc.) |

#### TC-DATA-002: Templates JSON
| Check | Expected |
|-------|----------|
| File exists | `/public/data/templates.json` |
| Structure | Array with: id, name, category, description, designEffortBase, designEffortPerPage, devEffortBase, devEffortPerPage |
| Data | At least 5 templates |

---

## 7. Regression Checklist (Quick Smoke Test)

Use this checklist for rapid regression testing after each deployment:

- [ ] `/` redirects to `/onboarding`
- [ ] Onboarding form loads with all 4 sections
- [ ] Onboarding form submits and navigates to `/components`
- [ ] Components page loads with grouped data
- [ ] Accordion expand/collapse works
- [ ] Component checkbox toggles update estimation
- [ ] Templates page loads with data
- [ ] Template checkbox toggles update estimation
- [ ] Additional pages input works
- [ ] Global Principles page loads with table
- [ ] Tab navigation works between all 3 inner pages
- [ ] EstimationPanel shows correct totals
- [ ] Development/Design days calculate with 1.2× buffer
- [ ] Data persists on page refresh (localStorage)
- [ ] No console errors on any page
- [ ] Feasibly logo visible on all pages

---

## 8. Bug Report Template

When logging issues, use this format:

```
**Title:** [Short description]
**Severity:** P0/P1/P2/P3
**Page:** [Page name and URL]
**Steps to Reproduce:**
1. ...
2. ...
3. ...
**Expected Result:** [What should happen per Figma design]
**Actual Result:** [What actually happens]
**Screenshots:** [Attach Figma screenshot + app screenshot]
**Figma Reference:** [Node ID or link]
**File:** [Source file path]
```

---

## 9. Test Execution Log Template

| Date | Tester | Browser | Viewport | Tests Run | Pass | Fail | Blocked | Notes |
|------|--------|---------|----------|-----------|------|------|---------|-------|
| | | | | | | | | |

---

*This test plan should be reviewed and updated when new pages, features, or design changes are introduced.*
