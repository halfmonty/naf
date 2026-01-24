# NAF (Not A Framework)

Tiny reactive libraries for vanilla JS apps. Zero dependencies.

| Library | Size (gzip) | Approach |
|---------|-------------|----------|
| [naf.ts](./naf.ts) | ~1.9 KB | SPA - JS generates HTML |
| [naf-html.ts](./naf-html.ts) | ~1.2 KB | MPA - JS binds to existing HTML |

**Live demos:** [SPA Example](https://anthropics.github.io/naf/) | [HTML-First Example](https://anthropics.github.io/naf/html/)

## Quick Start

Copy the file you need into your project:

```bash
curl -O https://raw.githubusercontent.com/anthropics/naf/main/naf.ts
# or
curl -O https://raw.githubusercontent.com/anthropics/naf/main/naf-html.ts
```

## Core Reactivity (shared by both)

```typescript
import { signal, computed, effect } from './naf';

const count = signal(0);
const doubled = computed(() => count() * 2);

effect(() => console.log(count(), doubled()));

count(5);  // logs: 5, 10
```

---

## NAF (SPA)

Components return HTML strings. JS controls everything.

```typescript
import { signal, template, each, text } from './naf';

const todos = signal([{ id: 1, text: 'Learn NAF', done: false }]);

function TodoList() {
  return template`
    <ul>
      ${each(() => todos(), (todo) => template`
        <li>${text(todo.text)}</li>
      `)}
    </ul>
  `;
}

// Mount
const app = TodoList();
document.querySelector('#app')!.innerHTML = app.html;
app.mount(document.querySelector('#app')!);
```

### Key Features

- **`template`** - Tagged template for components with lifecycle hooks
- **`when(condition, then, else)`** - Conditional rendering
- **`each(items, render)`** - List rendering  
- **`createRouter({ root, routes })`** - Hash-based SPA router
- **`attr()`, `toggleClass()`, `setText()`** - Reactive DOM bindings
- **`model()`** - Two-way input binding
- **`text()`** - XSS escaping

### Example Component

```typescript
function Counter() {
  const count = signal(0);
  
  return template({
    root: '#counter',
    onMount(el) {
      setText(el, () => `Count: ${count()}`);
      $on(el, 'button', 'click', () => count(count() + 1));
    }
  })`
    <div id="counter">
      <span></span>
      <button>+</button>
    </div>
  `;
}
```

---

## NAF-HTML (Progressive Enhancement)

HTML renders first. JS binds reactivity to existing elements.

```typescript
import { signal, $, setText, toggleClass, list } from './naf-html';

const todos = signal([{ id: 1, text: 'Learn NAF', done: false }]);

// Bind to existing HTML
setText($('.count'), () => todos().length);

list(
  $('.todo-list'),
  $<HTMLTemplateElement>('#todo-tpl'),
  () => todos(),
  (t) => t.id,
  (el, item) => {
    setText($('.text', el), () => item().text);
    toggleClass(el, 'done', () => item().done);
  }
);
```

### Key Features

- **`bind(el, setup)`** - Bind reactive behavior to existing element
- **`list(container, template, items, key, setup)`** - Keyed list rendering with efficient diffing
- **`$()`, `$$()`, `$on()`** - DOM query helpers
- **`setText()`, `toggleClass()`, `attr()`** - Reactive bindings
- **`model()`** - Two-way input binding

### When to Use Which

| Use Case | Recommendation |
|----------|----------------|
| Dashboard / Admin panel | NAF (SPA) |
| Content site with interactivity | NAF-HTML |
| SEO matters | NAF-HTML |
| Complex nested components | NAF (SPA) |
| Must work without JS | NAF-HTML |

---

## DOM Utilities

Both libraries include:

```typescript
// Query
const el = $<HTMLInputElement>('#my-input');
const items = $$('.item');

// Events  
$on(form, 'button', 'click', handler);

// Two-way binding
model(form, 'input[name="email"]', emailSignal);

// Reactive bindings
setText(el, () => count());
toggleClass(el, 'active', () => isActive());
attr(el, 'disabled', () => isDisabled());
```

---

## Running Examples

```bash
# SPA example
npm run example

# HTML-first example  
npm run example-html
```

---

## Limitations

- No virtual DOM - `each()` in NAF re-renders all items (NAF-HTML's `list()` is keyed)
- No SSR
- No batching - multiple signal updates trigger multiple effects
- Must manually use `text()` for XSS prevention

## When to Use

Use NAF when you want something tiny (~2KB) with reactivity and don't need a full framework. Good for internal tools, prototypes, and small apps where React/Vue would be overkill.

## License

MIT
