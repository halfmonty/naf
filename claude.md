# naf.ts - (Not A Framework) Vanilla SPA Framework

A ~2KB gzipped reactive framework for building SPAs without dependencies.

## Core Architecture

### Reactivity System (Lines 1-230)
**Based on alien-signals (MIT)** - Simplified implementation with only essential features.

- **signal()** - Reactive state primitive
- **computed()** - Cached derived values with dirty flag tracking
- **effect()** - Side effects with automatic dependency tracking and cleanup

**Key Implementation Details:**
- Uses `Link` interface for bidirectional dependency tracking (Dependency ↔ Subscriber)
- `activeSub` global tracks current executing context
- `link()` function manages dependency graph connections
- `notify()` propagates changes through subscriber chain
- Computed caching: `dirty` flag prevents unnecessary re-computation

### Component System (Lines 231-240)

```typescript
interface Component<T extends Element = Element> {
  html: string;           // Template string
  el?: T;                // Optional DOM reference after mount
  mount: (parent) => void;   // Setup lifecycle
  unmount?: () => void;      // Cleanup lifecycle
}
```

### Core Functions

**`text(str)` (Line 248)** - XSS prevention via HTML escaping

**`template` (Lines 342-387)** - Tagged template for component composition
- Auto-registers child components for mount/unmount
- Supports `{ root, onMount, onUnmount }` options
- Two modes: direct call or with options object

**`when(condition, then, otherwise?)` (Lines 405-424)** - Reactive conditional rendering
- Uses `reactiveSlot` pattern
- Unmounts previous component before mounting new one
- Returns Component with effect cleanup

**`each(items, render)` (Lines 454-482)** - Reactive list rendering
- **IMPORTANT**: Index capture uses `const index = i` to avoid closure bug
- Re-renders all items on array change (no keying)
- Unmounts old components before creating new ones

**`bind(el, prop, getter)` (Line 494)** - Reactive DOM property binding

**`bindAttr(el, attr, getter)` (Line 505)** - Reactive attribute binding

**`createRouter(options)` (Lines 1022-1142)** - Hash-based SPA router
- Takes `{ root, routes, notFound? }` options
- Returns `{ navigate, current, destroy }` interface
- Auto-cleans up previous page on navigation
- Handles both `hashchange` and `load` events

## Important Patterns

### Helper Functions

**`isComponent(value)` (Line 258)** - Type guard with minimal checks for bundle size

**`buildTemplate(strings, values)` (Line 271)** - Processes tagged template
- Extracts Component objects into array
- Uses array.join() for performance
- Filters falsy values (null, undefined, false)

**`createComponent(html, components, options?)` (Line 293)** - Component factory
- Handles mount/unmount of child components
- Populates `el` if root selector provided
- Calls lifecycle hooks

**`reactiveSlot(dataAttr, setupEffect)` (Line 320)** - Reactive container pattern
- Used by `when()` and `each()`
- Creates placeholder span with unique ID
- Returns cleanup function from setupEffect

## Known Limitations

1. **No keyed rendering** - `each()` re-renders all items on change
2. **innerHTML-based** - Direct DOM manipulation would be faster
3. **No batching** - Multiple signal updates trigger multiple effects
4. **No SSR** - Client-only rendering
5. **XSS risk** - Must manually use `text()` for user content

## Critical Bug Fixes Applied

- ✅ Computed caching (dirty flag pattern)
- ✅ Each index closure (const index = i)
- ✅ Link-based reactivity structure (fixed type errors)

## Bundle Size

- **Framework only**: ~2KB gzipped
- **No external dependencies** for reactivity
- Includes signal/computed/effect implementation

## Usage Pattern

```typescript
import { signal, computed, effect, template, when, each, text, createRouter } from './naf';

// State
const count = signal(0);
const doubled = computed(() => count() * 2);

// Effects run automatically
effect(() => console.log(count()));

// Components
export function Counter(): Component {
  return template`
    <div>
      <p>Count: ${count()}</p>
      <button onclick="${() => count(count() + 1)}">+</button>
    </div>
  `;
}

// Router
createRouter({
  root: document.querySelector('#app')!,
  routes: {
    '#/': HomePage,
    '#/counter': Counter,
  },
  notFound: () => template`<h1>404</h1>`,
});
```

## Testing Notes

When debugging reactivity:
1. Check `activeSub` is set during dependency tracking
2. Verify `link()` creates bidirectional connections
3. Ensure `dirty` flag resets in computed after execute
4. Confirm effect cleanup runs on unmount

## Performance Characteristics

- **Good for**: <50 pages, <100 items per list, internal tools
- **Not ideal for**: Large tables, high-frequency updates, complex animations
- **Bottlenecks**: innerHTML updates, querySelector in mount(), no reconciliation

## Example App Structure

```
example/src/
├── main.ts                    # Router setup, app entry point
└── components/
    ├── types.ts               # Shared types (Todo, Filter)
    ├── Card.ts                # Reusable card wrapper
    ├── Button.ts              # Reusable button component
    ├── Nav.ts                 # Navigation links
    ├── Layout.ts              # Page layout wrapper
    ├── Home.ts                # Home/about page
    ├── Header.ts              # Todo app header
    ├── AddTodoForm.ts         # New todo input form
    ├── FilterButtons.ts       # All/Active/Completed filter
    ├── TodoItem.ts            # Single todo item
    ├── TodoList.ts            # List of todos using each()
    ├── EmptyState.ts          # Empty state message
    ├── Stats.ts               # Active/total count display
    └── TodoPage.ts            # Todo app page component
```

The example demonstrates:
- Hash-based routing with `createRouter()`
- Component composition with `template`
- Reactive state with `signal()` and `computed()`
- Conditional rendering with `when()`
- List rendering with `each()`
- Lifecycle hooks with `onMount`/`onUnmount`
