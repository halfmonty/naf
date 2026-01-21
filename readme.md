# NAF (not a framework) Vanilla SPA Helper Functions

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Bundle Size](https://img.shields.io/badge/bundle%20size-~2KB-success)](https://github.com/yourusername/naf)

A ~2KB gzipped reactive functions library for building SPAs with zero dependencies.

## ⚡ Quick Install

**Just copy one file into your project:**

```bash
# Download directly
curl -O https://raw.githubusercontent.com/yourusername/naf/main/naf.ts

# Or copy from the repository
cp naf.ts /path/to/your/project/src/
```

**That's it!** No npm install, no node_modules, no build step required (though you can use bundlers if you want).

```typescript
import { signal, computed, template } from './naf';
// Start building!
```

### Why Copy Instead of Install?

- ✅ **Zero dependencies** - Literally none
- ✅ **Full ownership** - Modify the code as you need
- ✅ **No version conflicts** - Your copy, your rules
- ✅ **Understandable** - Small enough to read (13KB source)
- ✅ **No breaking changes** - Update only when you want to

> **Why copy instead of install?** Read our [philosophy document](PHILOSOPHY.md) to understand the copy-first approach.

## Quick Start

```typescript
import { signal, computed, template, each, text } from './naf';

// Create reactive state
const count = signal(0);
const doubled = computed(() => count() * 2);

// Create a component
function Counter() {
  return template({
    html: `
      <div>
        <p>Count: ${count()}</p>
        <p>Doubled: ${doubled()}</p>
        <button id="inc">+</button>
      </div>
    `,
    root: 'div',
    onMount() {
      this.el!.querySelector('#inc')!.addEventListener('click', () => {
        count(count() + 1);
      });
    }
  });
}

// Mount to DOM
const app = Counter();
app.mount(document.querySelector('#app')!);
```

## Running the Example

A complete todo app example is included in the `example/` directory:

```bash
cd example
npm install
npm run dev
```

Visit `http://localhost:3000` to see the todo app in action.

## Core Concepts

### Components

Components are plain objects with HTML strings and lifecycle methods:

```typescript
interface Component<T extends Element = Element> {
  html: string;              // Template string to render
  el?: T;                    // Optional DOM reference (populated if root selector used)
  mount: (parent: Element) => void;   // Called when component enters DOM
  unmount?: () => void;      // Called when component leaves DOM
}
```

### Reactivity

The functions library includes a fine-grained reactivity system based on [alien-signals](https://github.com/stackblitz/alien-signals):

- **`signal(value)`** - Creates reactive state
- **`computed(fn)`** - Creates derived state that automatically tracks dependencies
- **`effect(fn)`** - Runs side effects when dependencies change

```typescript
import { signal, computed, effect } from './util';

const count = signal(0);
const doubled = computed(() => count() * 2);

effect(() => {
  console.log(`Count is ${count()}, doubled is ${doubled()}`);
});

count(5);  // Logs: "Count is 5, doubled is 10"
```

**Key Points:**
- Signals are both getters and setters: `count()` reads, `count(5)` writes
- Computed values are cached and only re-compute when dependencies change
- Effects automatically track which signals they depend on
- Effects return a cleanup function to stop tracking

## Features

### `template` - Component Composition

The `template` tagged template literal creates components and automatically manages child component lifecycles.

**Basic Usage:**

```typescript
function Home(): Component {
  const header = Header();
  const button = Button({
    text: 'Click me',
    onClick: () => console.log('clicked')
  });

  return template`
    <div class="page">
      ${header}
      <main>${button}</main>
    </div>
  `;
}
```

**With Root Selector:**

Use the `root` option to get a reference to a specific element after mounting:

```typescript
const view = template({ root: '#about-page' })`
  ${header}
  <main id="about-page">
    ${button}
  </main>
`;

view.mount(document.body);
console.log(view.el);  // HTMLElement with id="about-page"
```

**With TypeScript Typing:**

```typescript
const form = template<HTMLFormElement>({ root: '#my-form' })`
  <form id="my-form">
    ${submitButton}
  </form>
`;

form.mount(document.body);
form.el;  // Typed as HTMLFormElement
```

**With Lifecycle Hooks:**

```typescript
const count = signal(0);
let stopEffect: (() => void) | undefined;

return template({
  root: '#about',
  onMount: (el, parent) => {
    // el is the element matched by root selector
    // parent is the container passed to mount()
    stopEffect = effect(() => {
      if (el) {
        el.textContent = `Count: ${count()}`;
      }
    });
  },
  onUnmount: () => {
    stopEffect?.();
  }
})`
  <main id="about">${button}</main>
`;
```

### `when` - Conditional Rendering

Reactively render different components based on a condition:

```typescript
function LoginPage(): Component {
  const isLoggedIn = signal(false);

  return template`
    <div>
      ${when(
        () => isLoggedIn(),
        () => template`
          <div>
            <p>Welcome back!</p>
            <button onclick="${() => isLoggedIn(false)}">Logout</button>
          </div>
        `,
        () => template`
          <div>
            <p>Please log in</p>
            <button onclick="${() => isLoggedIn(true)}">Login</button>
          </div>
        `
      )}
    </div>
  `;
}
```

**Signature:**
```typescript
function when(
  condition: () => boolean,
  then: () => Component,
  otherwise?: () => Component
): Component
```

**How it works:**
- Creates a reactive effect that tracks the condition
- When condition changes, unmounts old component and mounts new one
- The `otherwise` parameter is optional
- Automatically cleans up effects on unmount

### `each` - List Rendering

Reactively render a list of items:

```typescript
function TodoList(): Component {
  const todos = signal([
    { id: 1, text: 'Learn vanilla SPA', done: false },
    { id: 2, text: 'Build something cool', done: false }
  ]);

  return template`
    <ul>
      ${each(
        () => todos(),
        (todo, index) => template`
          <li>
            <span>${text(todo.text)} (${index()})</span>
            <button onclick="${() => {
              const list = todos();
              todos(list.map(t => 
                t.id === todo.id 
                  ? { ...t, done: !t.done }
                  : t
              ));
            }}">
              ${todo.done ? 'Undo' : 'Done'}
            </button>
          </li>
        `
      )}
    </ul>
  `;
}
```

**With Component Children:**

```typescript
const users = signal([...]);

return template`
  <div class="users">
    ${each(
      () => users(),
      (user) => UserCard({ user })
    )}
  </div>
`;
```

**Signature:**
```typescript
function each<T>(
  items: () => T[],
  render: (item: T, index: () => number) => Component
): Component
```

**Important Notes:**
- Re-renders all items when the array changes (no keyed reconciliation)
- Index is a getter function, not a plain number
- All previous components are unmounted before new ones are created
- For best performance, keep item counts under ~100

### `bind` - Property Binding

Bind a reactive signal to a DOM element property:

```typescript
function Counter(): Component {
  const count = signal(0);

  const view = template({ root: '#display' })`
    <div>
      <div id="display"></div>
      <button onclick="${() => count(count() + 1)}">Increment</button>
    </div>
  `;

  let cleanup: (() => void) | undefined;

  return template({
    onMount: (_, parent) => {
      const displayEl = parent.querySelector('#display') as HTMLElement;
      cleanup = bind(displayEl, 'textContent', () => `Count: ${count()}`);
    },
    onUnmount: () => cleanup?.()
  })`${view}`;
}
```

**Signature:**
```typescript
function bind<K extends keyof HTMLElement>(
  el: HTMLElement,
  prop: K,
  getter: () => HTMLElement[K]
): () => void
```

**Returns:** A cleanup function to stop the effect

### `bindAttr` - Attribute Binding

Bind a reactive signal to a DOM element attribute:

```typescript
function Form(): Component {
  const isDisabled = signal(false);

  const view = template({ root: 'button' })`
    <button>Submit</button>
  `;

  let cleanup: (() => void) | undefined;

  return template({
    onMount: (_, parent) => {
      const buttonEl = parent.querySelector('button')!;
      cleanup = bindAttr(buttonEl, 'disabled', () => 
        isDisabled() ? '' : null
      );
    },
    onUnmount: () => cleanup?.()
  })`${view}`;
}
```

**Signature:**
```typescript
function bindAttr(
  el: Element,
  attr: string,
  getter: () => string | null
): () => void
```

**Returns:** A cleanup function to stop the effect

**Notes:**
- Return `null` to remove the attribute
- Return a string (even empty string `''`) to set the attribute

### `text` - XSS Prevention

Always use `text()` to escape user-generated content:

```typescript
function UserProfile(): Component {
  const userInput = signal('<script>alert("xss")</script>');

  return template`
    <div>
      <p>${text(userInput())}</p>
    </div>
  `;
  // Renders: <p>&lt;script&gt;alert("xss")&lt;/script&gt;</p>
}
```

**Signature:**
```typescript
function text(str: string): string
```

**Escapes:**
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#39;`

**⚠️ Important:** NAF does NOT automatically escape content. You must use `text()` for any user-generated content to prevent XSS attacks.

## Complete Example

Here's a full TodoMVC-style application showing all features:

```typescript
import { signal, computed, template, when, each, text } from './util';

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

function TodoPage(): Component {
  // State
  const todos = signal<Todo[]>([
    { id: 1, text: 'Learn vanilla SPA', done: false },
    { id: 2, text: 'Build something cool', done: false }
  ]);
  const newTodoText = signal('');
  const filter = signal<'all' | 'active' | 'done'>('all');

  // Computed
  const filteredTodos = computed(() => {
    const all = todos();
    const f = filter();
    if (f === 'active') return all.filter(t => !t.done);
    if (f === 'done') return all.filter(t => t.done);
    return all;
  });

  const activeCount = computed(() => {
    return todos().filter(t => !t.done).length;
  });

  // Actions
  const addTodo = () => {
    const text = newTodoText().trim();
    if (!text) return;

    todos([
      ...todos(),
      { id: Date.now(), text, done: false }
    ]);
    newTodoText('');
  };

  const toggleTodo = (id: number) => {
    todos(todos().map(t => 
      t.id === id ? { ...t, done: !t.done } : t
    ));
  };

  const deleteTodo = (id: number) => {
    todos(todos().filter(t => t.id !== id));
  };

  // Components
  const header = template`
    <header><h1>Todo App</h1></header>
  `;

  const addButton = template`
    <button 
      onclick="${addTodo}"
      disabled="${computed(() => !newTodoText().trim())}"
    >
      Add Todo
    </button>
  `;

  const todoCard = (todo: Todo) => template`
    <div class="todo-card ${todo.done ? 'done' : ''}">
      <input 
        type="checkbox" 
        ${todo.done ? 'checked' : ''}
        onchange="${() => toggleTodo(todo.id)}"
      />
      <span>${text(todo.text)}</span>
      <button onclick="${() => deleteTodo(todo.id)}">Delete</button>
    </div>
  `;

  const statsCard = template`
    <div class="stats">
      <p>${computed(() => `${activeCount()} items left`)}</p>
    </div>
  `;

  // Main view
  return template({
    root: '#todo-app',
    onMount: (el, parent) => {
      // Setup input binding
      const input = parent.querySelector('#new-todo-input') as HTMLInputElement;
      if (input) {
        input.addEventListener('input', (e) => {
          newTodoText((e.target as HTMLInputElement).value);
        });
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') addTodo();
        });
      }

      // Setup filter buttons
      const filterBtns = parent.querySelectorAll('[data-filter]');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const f = btn.getAttribute('data-filter') as 'all' | 'active' | 'done';
          filter(f);
        });
      });
    }
  })`
    <div id="todo-app" class="container">
      ${header}
      
      <div class="input-section">
        <input 
          id="new-todo-input" 
          type="text" 
          placeholder="What needs to be done?"
        />
        ${addButton}
      </div>

      <div class="filters">
        <button data-filter="all">All</button>
        <button data-filter="active">Active</button>
        <button data-filter="done">Done</button>
      </div>

      <div class="todo-list">
        ${each(
          () => filteredTodos(),
          (todo) => todoCard(todo)
        )}
      </div>

      ${statsCard}
    </div>
  `;
}
```

## Best Practices

### 1. Keep Components Small

Break down large components into smaller, reusable pieces:

**❌ Bad:**
```typescript
function MegaPage(): Component {
  // 500 lines of mixed concerns...
}
```

**✅ Good:**
```typescript
function TodoPage(): Component {
  return template`
    ${Header()}
    ${TodoInput()}
    ${TodoList()}
    ${Footer()}
  `;
}
```

### 2. Use Computed for Derived State

Don't manually track derived values - use `computed()`:

**❌ Bad:**
```typescript
const todos = signal([...]);
const count = signal(0);
// Manually updating count is error-prone
```

**✅ Good:**
```typescript
const todos = signal([...]);
const count = computed(() => todos().length);
```

### 3. Clean Up Effects

Always clean up effects to prevent memory leaks:

```typescript
function MyComponent(): Component {
  let stopEffect: (() => void) | undefined;

  return template({
    onMount: (el) => {
      stopEffect = effect(() => {
        // ... reactive code
      });
    },
    onUnmount: () => {
      stopEffect?.();
    }
  })`...`;
}
```

### 4. Use Global Signals for App State

For state shared across pages, define signals at module scope:

```typescript
// appState.ts
export const appState = {
  user: signal(null),
  theme: signal('light'),
  isLoading: signal(false)
};

// Use anywhere:
import { appState } from './appState';
appState.user({ name: 'Alice' });
```

### 5. Organize by Feature

Structure your project by feature, not by type:

```
src/
  features/
    todos/
      TodoPage.ts
      TodoList.ts
      TodoItem.ts
    users/
      UserPage.ts
      UserCard.ts
  util.ts
  main.ts
```

## Router Integration

Simple hash-based routing:

```typescript
import { signal, effect } from './util';

const routes = {
  '#/': () => HomePage(),
  '#/about': () => AboutPage(),
  '#/todos': () => TodoPage()
};

let currentPage: Component | null = null;

function handleRoute() {
  // Unmount old page
  currentPage?.unmount?.();
  
  // Get route and render
  const hash = window.location.hash || '#/';
  const pageFactory = routes[hash] || routes['#/'];
  currentPage = pageFactory();
  
  // Mount new page
  const root = document.getElementById('app')!;
  root.innerHTML = currentPage.html;
  currentPage.mount(root);
}

window.addEventListener('hashchange', handleRoute);
handleRoute(); // Initial route
```

## Performance Tips

1. **Keep lists under ~100 items** - `each()` re-renders all items on change
2. **Use computed() for expensive calculations** - Results are cached
3. **Avoid deeply nested templates** - Flatter structures are faster
4. **Debounce frequent updates** - Especially for user input
5. **Use `text()` selectively** - Only for user-generated content

## Honest Limitations

### What's Missing

**No Virtual DOM / Reconciliation**
- `each()` re-renders all items when the array changes
- No keyed updates or minimal DOM patches
- innerHTML-based rendering is simple but not optimal for large lists

**No Batching**
- Multiple signal updates trigger multiple effect runs
- No automatic batching of DOM updates
- Can cause unnecessary re-renders

**No Server-Side Rendering**
- Client-only rendering
- Initial page load shows blank screen
- Not suitable for SEO-critical applications

**No Built-in Routing**
- Must implement your own router (see example above)
- No route parameters parsing
- No nested routes

**No Dev Tools**
- No browser extension for debugging reactivity
- Manual console.log debugging required

**XSS Risk**
- NAF does NOT auto-escape content
- Must manually use `text()` for user content
- Easy to forget and introduce vulnerabilities

### Performance Characteristics

**Good for:**
- Small to medium apps (< 50 pages)
- Internal tools and admin panels
- Prototypes and MVPs
- Lists with < 100 items
- Apps with infrequent updates

**Not ideal for:**
- Large data tables (> 100 rows)
- High-frequency updates (animations, games)
- Complex drag-and-drop interfaces
- SEO-critical landing pages
- Real-time collaborative apps

### Comparison to Major Frameworks

**vs React:**
- ✅ Much smaller bundle size (~2KB vs ~40KB)
- ✅ Simpler mental model (no hooks rules)
- ❌ No reconciliation (re-renders everything)
- ❌ No ecosystem (no component libraries)

**vs Vue:**
- ✅ No build step required (optional)
- ✅ Fine-grained reactivity (similar to Vue 3)
- ❌ No template compiler optimizations
- ❌ No directives (v-if, v-for, v-model)

**vs Svelte:**
- ✅ No build step required (runtime-only)
- ❌ Larger runtime (Svelte compiles away)
- ❌ No compiler optimizations
- ❌ More verbose syntax

### When to Use This

**Use this framework when:**
- Bundle size is critical (< 5KB total)
- You want zero dependencies
- You're building internal tools
- You need something simple to learn/teach
- You want full control over the code

**Use a major framework when:**
- Building a production app with a team
- Need ecosystem support (UI libraries, plugins)
- SEO is critical (need SSR)
- Performance is critical (need optimized reconciliation)
- Need mature dev tools and debugging

### Known Issues

1. **Memory leaks:** Must manually clean up effects in `onUnmount`
1. **Event handler memory:** Inline onclick handlers are recreated on every render
1. **Query selector cost:** Every mount() calls querySelector for root element

### Future Improvements

**Could be added:**
- Keyed reconciliation for `each()`
- Batched updates (scheduler)
- Event delegation for better performance
- Dev mode warnings (forgot to call signal as function, etc)
- Better TypeScript inference for template strings

**Won't be added:**
- SSR (out of scope)
- Virtual DOM (defeats the purpose of being tiny)
- Build step (want to keep it optional)

## Learn More

**Reactivity System:**
- Based on [alien-signals](https://github.com/stackblitz/alien-signals)
- Uses Link-based dependency tracking
- Similar to Vue 3's reactivity but simplified

**Inspiration:**
- Vue 3 reactivity
- Solid.js rendering model
- Lit HTML template syntax

## Using in Your Project

### With a Bundler (Vite, Webpack, etc.)

1. Copy `naf.ts` into your `src/` directory
2. Import what you need:
   ```typescript
   import { signal, computed, template } from './naf';
   ```

### Without a Bundler

NAF is written in TypeScript but uses standard ES modules. You can:

1. Use it directly in modern browsers with `type="module"`
2. Transpile with TypeScript if you need broader compatibility
3. Use with Deno out of the box

### With Vite (Recommended)

```bash
npm create vite@latest my-app -- --template vanilla-ts
cd my-app
# Copy naf.ts into src/
npm install
npm run dev
```

## Development

### Running Tests

```bash
# Clone the repository
git clone https://github.com/yourusername/naf.git
cd naf

# Install dev dependencies (for testing only)
npm install

# Run tests
npm test              # Run tests once
npm run test:watch    # Watch mode
npm run test:ui       # Open Vitest UI
npm run test:coverage # Generate coverage report
```

### Project Structure

```
naf/
├── naf.ts              # Main library (~2KB) - Copy this file!
├── test/               # Test suite
│   ├── reactivity.test.ts
│   └── components.test.ts
├── example/            # Todo app example
│   ├── src/
│   │   └── main.ts
│   └── index.html
└── readme.md
```

## Contributing

Contributions are welcome! Please ensure:
- All tests pass (`npm test`)
- New features include tests
- Keep the bundle size small
- Maintain zero runtime dependencies

The philosophy is to keep NAF as a single, self-contained file that anyone can copy and use.

## Philosophy

NAF embraces a **copy-first approach** - we encourage you to copy `naf.ts` directly into your project rather than installing it as a dependency. This gives you true zero dependencies, full code ownership, and complete control.

**Read the full philosophy:** [PHILOSOPHY.md](PHILOSOPHY.md)

### Core Values

This lib prioritizes:
1. **Simplicity** - Easy to understand, no magic
2. **Size** - < 2KB gzipped for the runtime
3. **No dependencies** - Fully self-contained
4. **No build step** - Works directly in the browser
5. **Honest trade-offs** - Clear about what it can't do

It's designed for small apps where React/Vue would be overkill, but you still want reactivity and component composition. Perfect for internal tools, prototypes, and learning.
