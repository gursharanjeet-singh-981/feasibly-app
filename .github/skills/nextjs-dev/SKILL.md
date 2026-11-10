---
name: nextjs-dev
description: 'Next.js development, debugging, and testing guidance for App Router and Pages Router. Use when working on Next.js pages, layouts, Server Components, Client Components, Server Actions, Route Handlers, middleware, caching, revalidation, hydration errors, next/image, metadata, or Next.js deployment.'
---

# Next.js Development

## First: Identify the Router and Version
- `app/` directory → **App Router** (Server Components by default). `pages/` → **Pages Router**.
- Check the `next` version in `package.json`; caching defaults and async request APIs (`cookies()`, `headers()`, `params`) changed across majors. Verify against official docs for the installed version.

## App Router Patterns
- Keep components as **Server Components** by default; add `"use client"` only for state, effects, event handlers, or browser APIs. Push the client boundary as deep (leaf-level) as possible.
- Fetch data in Server Components directly (async component); do not call your own Route Handlers from the server.
- File conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` (must be client), `not-found.tsx`, `route.ts`.
- Mutations via **Server Actions** (`"use server"`): validate inputs with `zod`, check authentication/authorization inside every action, then `revalidatePath`/`revalidateTag`.
- Use `import 'server-only'` in modules holding secrets or DB access.
- SEO: export `metadata` or `generateMetadata`.
- Images: `next/image`; fonts: `next/font`; links: `next/link`.

## Pages Router Patterns
- Data: `getServerSideProps`, `getStaticProps` (+ `revalidate`), `getStaticPaths`.
- API: `pages/api/*` handlers; validate method and body.

## Environment Variables
- Only `NEXT_PUBLIC_*` vars reach the browser. Never prefix secrets with it.

## Debugging Checklist
| Symptom | Likely cause |
|---|---|
| Hydration mismatch | `Date.now()`, `Math.random()`, `window`/`localStorage`, locale formatting in render; invalid HTML nesting (`<div>` in `<p>`) |
| "useState only works in Client Components" | missing `"use client"` |
| Stale data after mutation | missing `revalidatePath`/`revalidateTag`, or fetch cached; check `cache`/`next.revalidate` options |
| Env var undefined on client | missing `NEXT_PUBLIC_` prefix or server needs restart |
| "Module not found: fs" in client | server-only module imported into client component |
| Middleware not running | `matcher` config or file location (root or `src/`) |

Clear `.next` only after asking the user if caches seem stale.

## Testing
- Unit/component: Vitest or Jest (`next/jest`) + React Testing Library. Async Server Components are best tested via Playwright or by testing extracted data functions.
- Mock `next/navigation`:
```ts
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
```
- Route Handlers: import `GET`/`POST` and call with `new Request(...)`; assert on the returned `Response`.
- E2E: Playwright against `next build && next start`.

## Recommendations
- Use the App Router for new work; colocate components by route segment.
- Use Route Segment Config (`dynamic`, `revalidate`) deliberately and document the caching choice.
- Add security headers in `next.config` and validate all Server Action inputs.
