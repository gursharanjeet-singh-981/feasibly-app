---
name: vue-dev
description: 'Vue 3 and Nuxt development, debugging, and testing guidance. Use when working on Vue single-file components, Composition API, script setup, refs and reactivity, composables, Pinia stores, Vue Router, Nuxt pages, or Vue Test Utils / Vitest tests.'
---

# Vue Development

## Component Patterns
- Vue 3 with `<script setup lang="ts">` and the Composition API (unless the project uses the Options API consistently).
- Type props/emits: `defineProps<{ title: string }>()`, `defineEmits<{ (e: 'save', id: number): void }>()`. Use `defineModel()` for `v-model` (Vue 3.4+).
- Never mutate props; emit events or use `defineModel`.
- `computed` for derived state; `watch`/`watchEffect` only for side effects.
- Reusable stateful logic goes into composables (`useXxx.ts`) returning refs.
- Global state: **Pinia** (setup-store style). Use `storeToRefs()` when destructuring.
- Never use `v-if` and `v-for` on the same element; always add `:key` in `v-for`.

## Reactivity Pitfalls
| Symptom | Likely cause |
|---|---|
| Value not updating in template | destructured `reactive()` or props (use `toRefs`/`storeToRefs`) |
| `[object Object]` or wrong value in script | forgot `.value` on a ref |
| Watcher not firing on nested change | needs `{ deep: true }` or watch a getter |
| Watcher not firing initially | needs `{ immediate: true }` |
| DOM not updated yet in code | `await nextTick()` |
| Hydration mismatch (Nuxt) | browser-only APIs in setup; wrap in `<ClientOnly>` or `onMounted` |

Use Vue DevTools to inspect component state, Pinia stores, and events.

## Testing (Vitest + Vue Test Utils or Testing Library)
```ts
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import Counter from './Counter.vue';

it('increments on click', async () => {
  const wrapper = mount(Counter, { global: { plugins: [createTestingPinia({ createSpy: vi.fn })] } });
  await wrapper.get('button').trigger('click');
  expect(wrapper.text()).toContain('Count: 1');
});
```
- Await `trigger`/`setValue`; they return promises.
- Test composables directly; wrap in a host component only if they use lifecycle hooks.
- Nuxt: use `@nuxt/test-utils` (`mountSuspended`).

## Recommendations
- Vite + Vitest for tooling; `eslint-plugin-vue` with the `recommended` config; `vue-tsc --noEmit` for type checks.
- Avoid `v-html` with untrusted content; sanitize if required.
- Lazy-load routes: `component: () => import('./views/Page.vue')`.
