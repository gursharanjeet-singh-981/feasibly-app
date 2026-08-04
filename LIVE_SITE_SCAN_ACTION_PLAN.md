# Live Site URL Scan — Action Plan

Concrete, code-anchored plan to deliver the functionality described in
[LIVE_SITE_SCAN_PLAN.docx](LIVE_SITE_SCAN_PLAN.docx), mapped to this repo's
existing Next.js 16 App Router + Zustand + Tailwind 4 setup.

---

## 0. Prerequisites (before writing any code)

| Item | Where | Notes |
|---|---|---|
| Read Next.js 16 route handler & streaming docs | `node_modules/next/dist/docs/` | Per [AGENTS.md](AGENTS.md) — APIs may differ from training data. Confirm `route.ts`, `Request`/`Response`, and streaming (`ReadableStream`) shapes for 16.x. |
| Decide AI provider | env | Default: OpenAI GPT‑4o vision. Provider must be swappable behind an interface (see §3). |
| Add env keys | `.env.local` | `OPENAI_API_KEY`, `SCAN_MAX_PAGES` (default 50), `SCAN_TIMEOUT_MS` (default 60_000), `SCAN_RATE_LIMIT_PER_HOUR` (default 3). |
| Install deps | `package.json` | `cheerio`, `openai`, `fuse.js`, `p-limit`, `robots-parser`. Skip `eventsource-parser` (that is a **client-side** parser; we already receive `text/event-stream` in the browser and can parse it with `Response.body.getReader()` or the native `EventSource`). |
| Feature flag | `src/lib/constants.ts` | `SCAN_FEATURE_ENABLED` — hide UI until backend is stable. |

> `sleep`, `puppeteer`, and headless browsers are **not** in scope for MVP.
> SPA-only sites will be reported as "insufficient content" with a graceful
> fallback (see §7).

---

## 1. What already exists — do not duplicate

| Concern | Existing file | Reuse strategy |
|---|---|---|
| Component / Template JSON library | [public/data/components.json](public/data/components.json), [public/data/templates.json](public/data/templates.json) | Matcher reads these via existing `loadJson` in [src/lib/data.ts](src/lib/data.ts). No Excel→JSON conversion needed for MVP — the JSON is the library. |
| Types for library items | [src/types/index.ts](src/types/index.ts) — `Component`, `Template`, `SelectedComponent`, `SelectedTemplate` | Scan output must produce these shapes so the existing Components/Templates pages consume them unchanged. |
| Estimation math | [src/lib/calculations.ts](src/lib/calculations.ts) | Scan does not re-implement estimation. It only pre-selects items in the store; `getEstimation()` in [src/store/index.ts](src/store/index.ts) already computes the summary. |
| Persisted store + migration | [src/store/index.ts](src/store/index.ts) | Add scan slice to the same store (bump `STORAGE_VERSION` → 3, add v2→v3 migrate that seeds empty scan slice). Do **not** create a second persisted store — one storage key only. |
| Onboarding form | [src/app/onboarding/page.tsx](src/app/onboarding/page.tsx) | Wire "Continue" to trigger scan when `liveUrl` is present and either scope box is checked. |
| Components / Templates pages | [src/app/components/page.tsx](src/app/components/page.tsx), [src/app/templates/page.tsx](src/app/templates/page.tsx) | Read `scan.matched*` on mount to derive `isSelected` for library items. No structural changes to the tables. |

**Consequence**: the docx's "Phase 4 scanStore" collapses into the existing store; the "MatchedItem / MatchedTemplateItem" shapes reduce to `Component` + `Template` + `{ confidence, foundOnPages, matchedById }`.

---

## 2. Files to add

```
src/
  lib/scanner/
    types.ts              // ScanState, DiscoveredPage, PageAnalysis, MatchResult
    constants.ts          // heuristic selectors, HTTP timeouts, limits
    urlGuard.ts           // SSRF guard (public URL only, DNS resolve check)
    crawler.ts            // sitemap.xml + BFS link crawl (Cheerio)
    analyzer.ts           // heuristic DOM → detected components
    aiAnalyzer.ts         // provider-agnostic vision call (OpenAI first)
    matcher.ts            // detections → JSON library rows (Fuse.js)
    orchestrator.ts       // pure fn: url → ScanResult (used by route + tests)
  app/api/scan/
    full/route.ts         // POST, streams SSE progress + final result
  components/scan/
    ScanProgressDialog.tsx  // modal on onboarding submit
    ConfidenceBadge.tsx     // shown next to auto-selected rows
    ScanSummaryBanner.tsx   // top of Components / Templates pages
  hooks/
    useScan.ts            // client hook: start scan, subscribe to SSE, write to store
```

**Store slice extension** (in existing [src/store/index.ts](src/store/index.ts), not a new file):

```ts
scan: {
  status: 'idle' | 'crawling' | 'analyzing' | 'matching' | 'complete' | 'error';
  progress: number;              // 0..100
  scanId: string | null;
  pagesScanned: number;
  discoveredPages: DiscoveredPage[];
  matchedComponentIds: Record<number, { confidence: number; pages: string[] }>;
  matchedTemplateIds:  Record<number, { confidence: number; pages: string[] }>;
  unmatched: UnmatchedItem[];
  error: string | null;
};
setScan(partial): void;
resetScan(): void;
```

Storing only **IDs → metadata** (not duplicated component objects) keeps the store small and lets the Components/Templates pages own rendering.

---

## 3. Phase-by-phase task list

Each task is small enough to close as a single PR. Estimates are AI-assisted implementation only, matching the doc's baseline.

### Phase A — Foundation (0.5 day)
1. Add deps + env vars, wire feature flag.
2. `src/lib/scanner/types.ts` — mirror shapes in §2, re-export from `@/lib/scanner`.
3. `src/lib/scanner/urlGuard.ts` — reject non-http(s), localhost, RFC1918, link-local, `.local`, `.internal`, redirect chains that resolve to private IPs. **SSRF is a hard gate; do not skip.**
4. Extend store with `scan` slice + migrate `v2→v3`. Bump `STORAGE_VERSION` in [src/lib/constants.ts](src/lib/constants.ts).

### Phase B — Crawler (0.5 day)
5. `crawler.ts`:
   - Try `/sitemap.xml` → `/sitemap_index.xml` → `/robots.txt` for sitemap refs.
   - Fallback BFS from base URL via Cheerio, `max depth = 3`, `max pages = SCAN_MAX_PAGES`.
   - Concurrency 4 via `p-limit`, 500ms jitter, 10s per-page timeout, custom UA.
   - Respect `robots.txt` disallow with `robots-parser`.
   - Classify `pageType` by URL pattern + title heuristics.
6. Vitest: `crawler.test.ts` with fixture HTML and a stubbed `fetch`.

### Phase C — Heuristic analyzer (1 day)
7. `constants.ts` — selector rules per component group (CTA, Accordion, Form, Carousel, Header, Search, Breadcrumbs, Tabs, Teaser, Image, Table, Embed, plus the rest of the 36 groups). Each rule → `{ groupName, selector, minCount, confidence }`.
8. `analyzer.ts` — Cheerio-based rule runner; returns `DetectedComponent[]` + `DetectedTemplate | null` (template inferred from combined signals).
9. Vitest: for each rule, a positive + negative HTML fixture.

### Phase D — Matcher (0.5 day)
10. `matcher.ts`:
    - Build Fuse index from `components.json` groups + variants once per request.
    - `exact` = group name match (case-insensitive).
    - `probable` = Fuse score ≥ threshold across `name` + `group` + `designDescription`.
    - Same for `templates.json`.
    - Return `{ matchedComponentIds, matchedTemplateIds, unmatched }`.
11. Vitest: match against real `public/data/*.json`; assert stable IDs.

### Phase E — Orchestrator + AI (1.5 day)
12. `aiAnalyzer.ts` — thin provider interface `analyzePage({ url, screenshot, html }) → DetectedComponent[]`. First impl: OpenAI `gpt-4o` with a compact library summary in the system prompt. Response schema validated with Zod; malformed → treat as empty and fall back to heuristics.
13. `orchestrator.ts` — pure async generator that `yield`s progress events (`{stage, progress, message}`) and finally yields `ScanResult`. Reused by the route and tests.
14. `app/api/scan/full/route.ts` — POST handler. Verify against Next.js 16 docs before writing:
    - `runtime = 'nodejs'` (Cheerio + timeouts need node).
    - Body: `{ url, useAi }` validated with Zod.
    - Response: `text/event-stream` from a `ReadableStream` fed by the orchestrator generator.
    - Per-IP rate limit via in-memory `Map` for MVP; TODO: swap to Upstash/Redis when deployed.

### Phase F — UI wiring (1 day)
15. `hooks/useScan.ts`:
    - `startScan(url, useAi)` → `fetch('/api/scan/full', { method: 'POST' })`, parse SSE with `response.body.getReader()` + `TextDecoder`.
    - On each progress event, `setScan({ status, progress, ... })`.
    - On final event, write `matchedComponentIds` / `matchedTemplateIds` / `unmatched` and route to next screen.
16. `ScanProgressDialog.tsx` — Base UI dialog with progress bar + current stage + cancel.
17. Hook `onboarding/page.tsx` submit: if `liveUrl` is set → open dialog, call `startScan`; else route as today.
18. `ScanSummaryBanner.tsx` on Components + Templates pages: reads store, renders "N components detected across M pages" + link to unmatched.
19. `ConfidenceBadge.tsx` — green/yellow/red dot, tooltip listing pages. Rendered next to the row name.
20. Components/Templates pages: when hydrating list from JSON, seed `isSelected = matchedIds[id]?.confidence >= 0.5`. Preserve user overrides on revisit (don't overwrite `isSelected` if scan already applied — track a `scanAppliedAt` timestamp in the scan slice).

### Phase G — Safety, edge cases, polish (1 day)
21. Auth wall / 401 / 403 → surface as "site requires authentication".
22. SPA detected (very sparse `<body>` after fetch) → warn, skip AI pass, return heuristics only.
23. Timeout > `SCAN_TIMEOUT_MS` → return partial results with warning.
24. AI call fails → downgrade to heuristics-only, keep result.
25. Invalid URL → block in Zod before hitting orchestrator.
26. Concurrency + rate-limit tests.
27. Manual QA against 3 target sites (marketing, PLP/PDP, article-heavy). Log any component group that never matches → tune rules.

---

## 4. Contract between orchestrator and store

Single point of truth. The orchestrator returns:

```ts
interface ScanResult {
  scanId: string;
  liveUrl: string;
  scanDate: string;
  scanDuration: number;
  pagesScanned: number;
  discoveredPages: DiscoveredPage[];
  matchedComponentIds: Record<number, { confidence: number; pages: string[] }>;
  matchedTemplateIds:  Record<number, { confidence: number; pages: string[] }>;
  unmatched: UnmatchedItem[];
  warnings: string[];
}
```

The UI never sees "MatchedItem" — it looks up the existing `Component` / `Template` in the JSON library by ID. This keeps the scan pipeline decoupled from the estimation model.

---

## 5. What the doc proposes that we are deliberately deferring

| Doc item | Decision | Reason |
|---|---|---|
| Puppeteer / headless browser fallback for SPA | Not in MVP | Adds ~200MB, cold-start cost, and infra complexity. Ship heuristics-only warning first; add if analytics show >20% SPA sites. |
| `/api/scan/{crawl,analyze,match}` sub-routes | Skipped | Only `/api/scan/full` is called by the UI; splitting adds surface area with no consumer. Orchestrator is already composed of the same three phases and unit-testable. |
| Excel → JSON parser script | Skipped | [public/data/*.json](public/data) is already the source of truth. `scripts/importExcel.mjs` already exists for offline updates. |
| Separate `scanStore.ts` | Merged into `useAppStore` | One persisted store, one migration story. |
| Anthropic Claude vision as day-1 alt | Interface only | Ship OpenAI first; provider abstraction lets us add Claude later without touching orchestrator/UI. |

---

## 6. Sequenced deliverables (working backward from a demo)

| Day | Deliverable | Verifiable outcome |
|---|---|---|
| 1 | Phase A + B | `curl` `/api/scan/full` on a small static site returns SSE progress and a `discoveredPages` list; store slice populated. |
| 2 | Phase C + D | Same call now populates `matchedComponentIds` / `matchedTemplateIds` using heuristics only, `useAi: false`. |
| 3 | Phase E | `useAi: true` upgrades matches; heuristics fallback verified by killing the OpenAI key. |
| 4 | Phase F | Onboarding → progress dialog → Components page with pre-selected rows + confidence badges + summary banner. |
| 5 | Phase G | SSRF guard, rate limit, timeout, SPA warning, error surface. |

Total: **5 working days AI-assisted** (vs the doc's 7.5) — the reduction comes from reusing the existing store, calculations, and JSON library.

---

## 7. Definition of done

- `npm run typecheck` and `npm run lint` clean.
- Vitest suites for `urlGuard`, `crawler`, `analyzer`, `matcher`, `orchestrator` all pass.
- Feature flag off → onboarding behaves exactly as today.
- Feature flag on → running against `https://example.com` returns a `complete` scan with 0 unmatched detections and no server errors.
- Running against an internal IP is rejected before any network request.
- Running with `OPENAI_API_KEY` unset succeeds via heuristics-only path.
- No new persisted-store keys outside the existing `feasibly-storage`; migration `v2→v3` verified with a stored v2 snapshot fixture.

---

## 8. Open questions to resolve before coding

1. **Runtime**: Vercel deploy or self-hosted Node? Vercel serverless has 10s default (60s on Pro); may need to move `/api/scan/full` to an Edge Function _or_ chunk the crawl into resumable jobs. Confirm before Phase E.
2. **Persistence of scan results**: keep in Zustand persist only, or also POST to a DB for revisit? MVP: persist-only in browser.
3. **AI toggle placement**: doc mentions an "Activate AI-Powered Estimation" checkbox in the Figma. Confirm it lives on the onboarding form (where `useAi` is captured) vs. the components screen.
4. **Concurrency budget**: OpenAI rate limits vs. `SCAN_MAX_PAGES`. Cap AI pass at ~15 representative pages (one per detected `pageType`), heuristics on the rest.
