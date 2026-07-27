# Feasibly App — QA Audit Report

**Date:** 2025-07-24  
**Auditor:** QA Lead (Automated)  
**Figma Design Reference:** [Figma File](https://www.figma.com/design/geXfeUtvC7bjnGZOQUKCKZ/Feasibly--Feasibility-Framework-?node-id=45-431&m=dev)  
**App URL:** http://localhost:3000  
**Tech Stack:** Next.js 16.2.11, React 19.2.4, Zustand, Tailwind CSS, @base-ui/react

---

## Executive Summary

This report documents the QA audit comparing the live Feasibly web application against its Figma designs. The audit covers all 4 pages (Onboarding, Components, Templates, Global Principles), the shared AppHeader, and the EstimationPanel sidebar. **19 issues** were found across severity levels: **4 Critical**, **6 High**, **6 Medium**, and **3 Low**.

---

## Issue Severity Legend

| Severity | Description |
|----------|-------------|
| 🔴 **P0 — Critical** | Major missing features or structural deviations from design |
| 🟠 **P1 — High** | Significant visual deviations affecting brand/UX |
| 🟡 **P2 — Medium** | Minor visual or behavioral deviations |
| 🟢 **P3 — Low** | Cosmetic polish items |

---

## 1. Global / Shared Components

### 1.1 AppHeader (all inner pages)

| # | Severity | Issue | Figma | App | File |
|---|----------|-------|-------|-----|------|
| G-01 | ✅ Fixed | **Feasibly brand logo missing** | Header shows Feasibly logo with arrow/chevron mark icon + "a Merkle tool" subtitle at top-left | ~~No Feasibly logo in header.~~ **FIXED:** Logo with red triangle mark (#F1012F), "Feasibly" text (#020E4E), and "a Merkle tool" subtitle added using exact Figma SVG paths. | `src/components/AppHeader.tsx` |
| G-02 | 🟡 P2 | **Accordion group count display** | Accordion headers show group name only (e.g., "CTA") | App shows count in parentheses: "CTA (5)", "Other (1)", "Accordion (9)" | `src/app/components/page.tsx` |
| G-03 | ✅ Fixed | **Tab icons** | Figma tabs use specific custom icons (4-diamond for Components, stacked documents for Templates, flag for Global Principles) | ~~App uses lucide-react icons.~~ **FIXED:** All tab icons replaced with exact Figma SVG paths — ComponentsIcon (4-diamond), FileCopyIcon (stacked documents), FlagIcon (flag). | `src/components/AppHeader.tsx` |

### 1.2 EstimationPanel (all inner pages)

| # | Severity | Issue | Figma | App | File |
|---|----------|-------|-------|-----|------|
| G-04 | ✅ Fixed | **Missing info (ⓘ) icon** | Development and Design cards have an info circle icon (ⓘ) in the top-right corner | ~~No info icon present.~~ **FIXED:** InfoIcon added to both Development and Design cards using exact Figma SVG path (circle-i at fillOpacity 0.54). | `src/components/EstimationPanel.tsx` |
| G-05 | 🟢 P3 | **Estimation panel background** | Panel uses a slightly different shade of grey-blue | App uses `bg-[#e3e7ef]`; Figma appears slightly lighter/different | `src/components/EstimationPanel.tsx` |

### 1.3 Typography / Font

| # | Severity | Issue | Figma | App | File |
|---|----------|-------|-------|-----|------|
| G-06 | 🟠 P1 | **Primary font mismatch** | Design uses **Proxima Nova** (Bold, Regular, Semibold, Black) | App uses **Inter** as primary font with Proxima Nova as fallback only. Since Proxima Nova is a paid/licensed font, Inter may be used intentionally, but the visual weight and character widths differ. | `src/app/globals.css` |

---

## 2. Onboarding Page (`/onboarding`)

| # | Severity | Issue | Figma | App | File |
|---|----------|-------|-------|-----|------|
| O-01 | ✅ Fixed | **Missing Feasibly logo icon** | Left panel shows the Feasibly arrow/chevron mark icon before the "Feasibly" text, plus "a Merkle tool" subtitle underneath | ~~Only plain "Feasibly" bold text.~~ **FIXED:** Logo with white triangle mark (for dark background), "Feasibly" text, and "a Merkle tool" subtitle added using exact Figma SVG paths. | `src/app/onboarding/page.tsx` |
| O-02 | 🟢 P3 | **Scope description has extra quotes** | Description reads: `Select what you will be estimating:` (plain text) | App renders: `"Select what you will be estimating:"` (with quotation marks wrapping the text) | `src/app/onboarding/page.tsx` |

**What matches well ✅:**
- Left panel cobalt blue background color
- Hero text "Great projects start with great scope" and tagline paragraph
- Right panel form sections with icon + label + description layout
- Blue rounded square icon backgrounds with white icons
- Input field styling (rounded pill, placeholder text)
- Checkbox components and templates selection
- AEM platform checkbox (checked, disabled)
- "Create Project" button styling (blue rounded pill, full-width)

---

## 3. Components Page (`/components`)

| # | Severity | Issue | Figma | App | File |
|---|----------|-------|-------|-----|------|
| C-01 | 🔴 P0 | **Missing "Add component" button** | Toolbar has a blue pill button "Add component ⊕" between the AI checkbox and search bar. Also a blue circle ⊕ button at the bottom of expanded accordion groups. | Neither button exists in the app. | `src/app/components/page.tsx` |
| C-02 | 🟠 P1 | **Extra "Assumptions" column** | Component table has 6 columns: Variant, Category, Design, Development, Design Effort, Dev Effort | App table has 7 columns — adds an "Assumptions" column not present in Figma design | `src/app/components/page.tsx:147` |
| C-03 | 🟡 P2 | **Accordion header styling** | Collapsed accordions show as rounded cards with subtle border | App uses `bg-[#e3e7ef]` with `rounded-full` for collapsed, `rounded-t-2xl` for expanded — generally close but the background color differs slightly from Figma's white cards | `src/app/components/page.tsx:116-127` |

**What matches well ✅:**
- Accordion group structure (expandable sections by component group)
- Table layout with checkbox + variant name
- Category badge with heart icon for "Core" category
- Search bar with magnifying glass icon
- "Activate AI-Powered Estimation" checkbox in toolbar
- Overall two-column layout (content + estimation panel)

---

## 4. Templates Page (`/templates`)

| # | Severity | Issue | Figma | App | File |
|---|----------|-------|-------|-----|------|
| T-01 | 🔴 P0 | **Missing accordion groups** | Templates are organized in accordion groups (Homepage, Listing Page (PLP), PDP, Article Page, Event Page, Landing Page) — same pattern as Components page | App shows a flat table with all templates listed without any grouping | `src/app/templates/page.tsx` |
| T-02 | 🟠 P1 | **Missing "Add template" button** | Toolbar has a blue pill button "Add template ⊕" and a blue circle ⊕ button at the bottom of groups | Neither button exists | `src/app/templates/page.tsx` |
| T-03 | 🟠 P1 | **Missing "Activate AI-Powered Estimation" checkbox** | Toolbar shows "Activate AI-Powered Estimation" checkbox (same as Components page) | Checkbox is missing from Templates toolbar | `src/app/templates/page.tsx` |
| T-04 | 🟠 P1 | **Column name mismatch** | Table columns: Variant, Category, Template Description, Design Effort, Additional effort per page, Dev Effort, Additional effort per page | App columns: Template, Category, Description, Design Effort, Extra Design/pg, Dev Effort, Extra Dev/pg, Additional Pages — different column names and has an extra "Additional Pages" input column | `src/app/templates/page.tsx:90-99` |
| T-05 | 🟡 P2 | **Missing "Additional Pages" as inline input** | Figma does not show a separate "Additional Pages" number input column | App has a numeric input field in the last column for entering additional pages | `src/app/templates/page.tsx` |

**What matches well ✅:**
- Category badge styling (Core with heart)
- Search bar present
- Overall page layout (left content + right estimation panel)
- Table header styling (blue background row)

---

## 5. Global Principles Page (`/global-principles`)

| # | Severity | Issue | Figma | App | File |
|---|----------|-------|-------|-----|------|
| GP-01 | 🟡 P2 | **Text truncation** | Design and Development descriptions are fully visible in the table | App truncates long description text in narrow viewport, especially the Design Description column | `src/app/global-principles/page.tsx` |
| GP-02 | 🟢 P3 | **Checkbox in Global Parameter column** | Figma shows "Responsiveness" text without a prominent checkbox | App shows a checked blue checkbox next to "Responsiveness" text — subtle difference | `src/app/global-principles/page.tsx` |

**What matches well ✅:**
- Three-column table layout (Global Parameter, Design Description, Development Description)
- Page title "Global Principles"
- Content text matches design
- No search bar (matching Figma — no search needed for small dataset)

---

## 6. Component States Audit

| State | Expected Behavior | Status |
|-------|-------------------|--------|
| **Checkbox — unchecked** | Empty square with border | ✅ Works |
| **Checkbox — checked** | Blue filled square with white checkmark | ✅ Works |
| **Checkbox — disabled** | Checked with reduced opacity (AEM platform) | ✅ Works |
| **Accordion — collapsed** | Rounded pill shape with chevron down | ✅ Works |
| **Accordion — expanded** | Top rounded with chevron rotated 180° | ✅ Works |
| **Tab — active** | Blue border, blue-tinted background, black text | ✅ Works |
| **Tab — inactive** | No border, grey text, transparent background | ✅ Works |
| **Input — empty** | Placeholder text visible, rounded pill border | ✅ Works |
| **Input — focused** | Ring/outline appears | ✅ Works |
| **Button — default** | Blue cobalt background, white text, rounded pill | ✅ Works |
| **Button — hover** | Slightly darker blue (cobalt/90) | ✅ Works |
| **Category badge — Core** | Pink/rose background with heart icon + "Core" text | ✅ Works |
| **Search input** | Magnifying glass icon on right side | ✅ Works |

---

## 7. Logo & Branding Audit

| Element | Figma Design | App Implementation | Status |
|---------|-------------|-------------------|--------|
| **Onboarding logo** | Arrow/chevron mark + "Feasibly" + "a Merkle tool" | White triangle mark + "Feasibly" + "a Merkle tool" | ✅ Fixed |
| **Header logo** | Arrow/chevron mark + "Feasibly" + "a Merkle tool" | Red triangle mark (#F1012F) + "Feasibly" (#020E4E) + "a Merkle tool" | ✅ Fixed |
| **Favicon** | Not audited | Default Next.js | ⚠️ Should match Feasibly branding |
| **Page title** | "Feasibly — Project Estimation Tool" | Matches | ✅ Correct |

---

## 8. Responsive Behavior (Spot Check)

The audit was performed at desktop viewport. Mobile-specific checks:
- Pages use responsive Tailwind classes (`lg:`, `md:`, `sm:`)
- Mobile card layouts are implemented for component/template rows
- Tab labels hide on small screens (`hidden sm:inline`)
- Layout switches from side-by-side to stacked on mobile

**Note:** A dedicated mobile/tablet QA pass is recommended.

---

## 9. Issue Summary by Priority

| Priority | Count | Issues |
|----------|-------|--------|
| 🔴 P0 — Critical | 2 (2 fixed) | ~~G-01~~, ~~O-01~~, C-01, T-01 |
| 🟠 P1 — High | 6 | G-06, C-02, T-02, T-03, T-04, GP-01 |
| 🟡 P2 — Medium | 3 (3 fixed) | G-02, ~~G-03~~, ~~G-04~~, C-03, T-05, GP-01 |
| 🟢 P3 — Low | 3 | G-05, O-02, GP-02 |
| ✅ Fixed | **5** | G-01, G-03, G-04, O-01 + EstimationPanel icons |
| **Remaining** | **14** | |

---

## 10. Recommendations

1. ~~**Immediate:** Add the Feasibly logo mark (arrow/chevron icon) and "a Merkle tool" subtitle to both the onboarding left panel and the AppHeader.~~ ✅ **DONE**
2. **High Priority:** Restructure the Templates page to use accordion groups matching the Components page pattern.
3. **High Priority:** Add "Add component" and "Add template" action buttons to the respective toolbars.
4. **High Priority:** Add "Activate AI-Powered Estimation" checkbox to the Templates page toolbar.
5. **Medium:** Review whether the "Assumptions" column in Components table should be removed to match Figma.
6. **Medium:** Evaluate font licensing — if Proxima Nova is available, use it as primary; otherwise document the Inter substitution as intentional.
7. **Low:** Address cosmetic items (extra quotes, info icons, background color precision).

---

*Report generated from visual comparison of live app vs Figma design file `geXfeUtvC7bjnGZOQUKCKZ`.*

---

## 11. Development Instructions — Icons & Logo Accuracy

> **All icons and logos MUST be sourced from the Figma file** (`geXfeUtvC7bjnGZOQUKCKZ`).  
> Do NOT use generic icon libraries (lucide-react, heroicons, etc.) as substitutes for Figma-designed icons.

### Icon Source of Truth

| Icon | Figma Location | Implementation |
|------|---------------|----------------|
| **Feasibly Logo** (red triangles) | Icons page (2:726) — "Union" paths | Inline SVG in `AppHeader.tsx` and `onboarding/page.tsx` |
| **Folder Shared** | Icons page — `folder_shared_24px` | Inline SVG in `AppHeader.tsx` |
| **Components** (4-diamond) | Icons page — component icon | Inline SVG in `AppHeader.tsx` + `EstimationPanel.tsx` |
| **File Copy** (stacked docs) | Icons page — `file_copy_24px` | Inline SVG in `AppHeader.tsx` + `EstimationPanel.tsx` |
| **Flag** | Icons page — `flag_24px` | Inline SVG in `AppHeader.tsx` |
| **Graph** (trend line) | Icons page — graph/chart icon | Inline SVG in `EstimationPanel.tsx` |
| **Add to Queue** | Icons page — `add_to_queue_24px` | Inline SVG in `EstimationPanel.tsx` |
| **Developer Mode** (< > brackets) | Icons page — `developer_mode_24px` | Inline SVG in `EstimationPanel.tsx` |
| **Pencil** (edit) | Icons page — pencil/edit stroke icon | Inline SVG in `EstimationPanel.tsx` |
| **Info** (circle-i) | Icons page — `info_24px` | Inline SVG in `EstimationPanel.tsx` |

### Rules for Future Development

1. **Always extract SVG paths from Figma** — use the Figma MCP or export assets directly.
2. **Use inline SVG components** — define them as React function components at the top of the file where they're used.
3. **Preserve exact fill colors and opacity** — e.g., `fill="#F1012F"` for logo, `fillOpacity="0.54"` for info icons.
4. **Logo colors**: Red mark `#F1012F`, text `#020E4E` (dark navy), "a Merkle tool" at `opacity-50`.
5. **Tab active icon color**: `#0029DA` (cobalt) — pass via `color` prop to icon components.
6. **Only `Download` and `FileSpreadsheet`** remain from lucide-react (used in export buttons).
