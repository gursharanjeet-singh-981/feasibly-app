---
name: react-dev
description: 'React development, debugging, and testing guidance. Use when working on React components, hooks, state management (Redux, Zustand, Context, TanStack Query), forms, React Testing Library tests, or React performance and re-render issues.'
---

# React Development

## Component Patterns
- Function components + hooks only. One component per file; name file after component.
- Type props with an interface/type (`type ButtonProps = { ... }`); prefer composition (`children`) over prop drilling.
- Derive values during render instead of syncing them into state. If it can be computed, don't `useState` it.
- Lift state only as high as needed; use Context for low-frequency global values (theme, auth), a store (Zustand/Redux Toolkit) for shared app state, and TanStack Query/SWR for server state.
- Lists need stable, unique `key`s (never array index for reorderable lists).

## Hooks Rules
- `useEffect` is for synchronizing with external systems, not for data transformation or event handling.
- Include every reactive value in dependency arrays; fix the design rather than disabling `react-hooks/exhaustive-deps`.
- Return cleanup functions for subscriptions, timers, and `AbortController` on fetches.
- Extract reusable logic into custom hooks named `useXxx`.
- `useMemo`/`useCallback`/`React.memo` only when profiling shows a cost or referential stability is required.

## Debugging Checklist
| Symptom | Likely cause |
|---|---|
| Infinite render loop | setState in render, or effect updating its own dependency |
| Stale values in callbacks | closure captured old state; use functional update `setX(x => ...)` or add deps |
| Effect runs twice in dev | StrictMode double-invoke; make effect idempotent with cleanup |
| UI doesn't update | state mutated in place; create new object/array |
| "Cannot update a component while rendering another" | setState called during render of another component |
| Invalid hook call | hook in condition/loop, or duplicate React copies (`npm ls react`) |

Use React DevTools Profiler ("Highlight updates") for re-render issues.

## Testing (React Testing Library)
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './Counter';

it('increments when clicked', async () => {
  const user = userEvent.setup();
  render(<Counter />);
  await user.click(screen.getByRole('button', { name: /increment/i }));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```
- Wrap components needing providers in a custom `renderWithProviders` helper.
- Test hooks with `renderHook` from `@testing-library/react`.
- Mock network with MSW handlers, not by mocking `fetch` per test.

## Recommendations
- Vite for new SPAs; Next.js when SSR/SEO/routing is needed (CRA is deprecated).
- ESLint with `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y`.
- Forms: `react-hook-form` + `zod` resolver.
- Avoid `dangerouslySetInnerHTML`; if unavoidable, sanitize with DOMPurify.
