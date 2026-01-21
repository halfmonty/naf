# Getting Started with NAF

Welcome to NAF (Not A Framework)! This guide will help you build your first application.

## What is NAF?

NAF is a ~2KB reactive library for building single-page applications with zero dependencies. It provides:

- **Reactive state management** with signals and computed values
- **Component system** with template literals
- **Conditional rendering** with `when`
- **List rendering** with `each`
- **Two-way binding** with `bind` and `bindAttr`

## Installation

### Just Copy the File!

Copy [`naf.ts`](../naf.ts) directly into your project:

```bash
# From the NAF repository
curl -O https://raw.githubusercontent.com/yourusername/naf/main/naf.ts

# Or just download and copy the file manually
```

Then place it in your project:

```
your-project/
├── src/
│   ├── naf.ts      # <-- Copied file goes here
│   └── main.ts     # Your app
└── index.html
```

**That's it!** No npm install, no dependencies, no build step required (though you can use a bundler if you want).

## Your First Component

Let's build a simple counter app.

### 1. Create your HTML file

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My NAF App</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### 2. Create your app

```typescript
// src/main.ts
import { signal, template, Component } from './naf';

function Counter(): Component {
  // Create reactive state
  const count = signal(0);

  // Return a component
  return template({
    html: `
      <div>
        <h1>Counter: ${count()}</h1>
        <button id="dec">-</button>
        <button id="inc">+</button>
      </div>
    `,
    root: 'div',
    onMount() {
      // Access the root element
      const dec = this.el!.querySelector('#dec')!;
      const inc = this.el!.querySelector('#inc')!;

      // Add event listeners
      dec.addEventListener('click', () => count(count() - 1));
      inc.addEventListener('click', () => count(count() + 1));
    }
  });
}

// Mount the app
const app = Counter();
const root = document.querySelector('#app');
if (root) {
  app.mount(root);
}
```

### 3. Run with Vite

```bash
npm create vite@latest my-naf-app -- --template vanilla-ts
cd my-naf-app

# Copy naf.ts into the src/ directory
curl -o src/naf.ts https://raw.githubusercontent.com/yourusername/naf/main/naf.ts

npm install
npm run dev
```

## Core Concepts

### Signals - Reactive State

Signals are the foundation of reactivity in NAF:

```typescript
import { signal } from './naf';

// Create a signal
const count = signal(0);

// Read the value
console.log(count()); // 0

// Update the value
count(5);
console.log(count()); // 5
```

### Computed - Derived State

Computed values automatically update when their dependencies change:

```typescript
import { signal, computed } from './naf';

const count = signal(10);
const doubled = computed(() => count() * 2);

console.log(doubled()); // 20

count(15);
console.log(doubled()); // 30
```

### Effects - Side Effects

Effects run automatically when their dependencies change:

```typescript
import { signal, effect } from './naf';

const name = signal('Alice');

effect(() => {
  console.log(`Hello, ${name()}!`);
}); // Logs: "Hello, Alice!"

name('Bob'); // Logs: "Hello, Bob!"
```

### Components

Components are objects with HTML and lifecycle methods:

```typescript
import { template } from './naf';

const myComponent = template`
  <div>
    <h1>Hello World</h1>
  </div>
`;

myComponent.mount(document.body);
```

## Building a Todo List

Let's build something more practical:

```typescript
import { signal, computed, template, each, text } from './naf';

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

function TodoApp() {
  // State
  const todos = signal<Todo[]>([]);
  const newTodoText = signal("");

  // Computed
  const activeCount = computed(() => {
    return todos().filter((t) => !t.done).length;
  });

  // Actions
  const addTodo = () => {
    const text = newTodoText().trim();
    if (!text) return;

    todos([...todos(), { id: Date.now(), text, done: false }]);
    newTodoText("");
  };

  const toggleTodo = (id: number) => {
    todos(todos().map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  // Component
  return template({
    root: "div",
    onMount(el) {
      const input = el!.querySelector("#new-todo") as HTMLInputElement;
      const addBtn = el!.querySelector("#add-btn");

      input.addEventListener("input", (e) => {
        newTodoText((e.target as HTMLInputElement).value);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addTodo();
      });

      addBtn?.addEventListener("click", addTodo);
    },
  })`
    <div>
      <h1>Todo List</h1>
      
      <div>
        <input type="text" id="new-todo" placeholder="What needs to be done?" />
        <button id="add-btn">Add</button>
      </div>

      <div id="todo-list">
        ${each(
          todos,
          (todo) => template({
            root: `[data-id="${todo.id}"]`,
            onMount(el) {
              const checkbox = el!.querySelector("input");
              checkbox?.addEventListener("change", () => toggleTodo(todo.id));
            },
          })`
            <div data-id="${todo.id}">
              <input type="checkbox" ${todo.done ? "checked" : ""} />
              <span>${text(todo.text)}</span>
            </div>
          `,
        )}
      </div>

      <p>${activeCount()} tasks remaining</p>
    </div>
  `;
}

// Mount
const app = TodoApp();
app.mount(document.querySelector('#app')!);
```

## Conditional Rendering

Use `when` for conditional rendering:

```typescript
import { signal, template, when } from './naf';

function LoginPage() {
  const isLoggedIn = signal(false);

  return template`
    <div>
      ${when(
        isLoggedIn,
        () => template`<h1>Welcome back!</h1>`,
        () => template`<h1>Please log in</h1>`
      )}
      <button onclick="${() => isLoggedIn(!isLoggedIn())}">
        Toggle
      </button>
    </div>
  `;
}
```

## Best Practices

### 1. Keep Components Small

Break large components into smaller, reusable pieces:

```typescript
function Header() {
  return template`<header><h1>My App</h1></header>`;
}

function Footer() {
  return template`<footer>© 2024</footer>`;
}

function App() {
  return template`
    <div>
      ${Header()}
      <main>Content here</main>
      ${Footer()}
    </div>
  `;
}
```

### 2. Use Computed for Derived State

Don't recalculate in multiple places:

```typescript
// ❌ Bad
// ❌ Bad - recalculates on every render
function Stats() {
  const todos = signal([...]);
  
  return template`
    <div>
      <p>Active: ${todos().filter((t) => !t.done).length}</p>
      <p>Done: ${todos().filter((t) => t.done).length}</p>
    </div>
  `;
}

// ✅ Good - computed and cached
function Stats() {
  const todos = signal([...]);
  const activeCount = computed(() => todos().filter((t) => !t.done).length);
  const doneCount = computed(() => todos().filter((t) => t.done).length);
  
  return template`
    <div>
      <p>Active: ${activeCount()}</p>
      <p>Done: ${doneCount()}</p>
    </div>
  `;
}
```

### 3. Clean Up Effects

Always clean up effects when components unmount:

```typescript
function MyComponent() {
  let stopEffect: (() => void) | undefined;

  return template({
    onMount() {
      stopEffect = effect(() => {
        // Effect logic
      });
    },
    onUnmount() {
      stopEffect?.();
    },
  })`<div>Content</div>`;
}
```

### 4. Use `text()` for User Input

Always escape user-provided content:

```typescript
import { text } from "./naf";

const userInput = signal('<script>alert("xss")</script>');

// ✅ Safe - content is escaped
const comp = template`<div>${text(userInput())}</div>`;
```

## Next Steps

- Check out the [complete example app](../example/) for a full todo application
- Read the [full documentation](../readme.md) for all features
- Explore the [test suite](../test/) for more examples

## Common Questions

### How do I handle forms?

Use the input event and update signals:

```typescript
const name = signal("");

const form = template({
  root: "form",
  onMount(el) {
    const input = el!.querySelector("#name") as HTMLInputElement;
    input.addEventListener("input", (e) => {
      name((e.target as HTMLInputElement).value);
    });
  },
})`
  <form>
    <input type="text" id="name" />
  </form>
`;
```

### How do I fetch data?

Use effects or onMount:

```typescript
function UserList() {
  const users = signal([]);
  const loading = signal(true);

  return template({
    root: "div",
    onMount() {
      fetch("/api/users")
        .then((r) => r.json())
        .then((data) => {
          users(data);
          loading(false);
        });
    },
  })`<div id="users"></div>`;
}
```

### How do I add routing?

Listen to hashchange events:

```typescript
const currentRoute = signal(window.location.hash || "#/");

window.addEventListener("hashchange", () => {
  currentRoute(window.location.hash);
});

function App() {
  return when(
    () => currentRoute() === "#/",
    () => HomePage(),
    () => (currentRoute() === "#/about" ? AboutPage() : NotFoundPage()),
  );
}
```

## Why Copy Instead of Install?

**Philosophy**: By copying `naf.ts` into your project, you:

- ✅ Have zero dependencies (truly!)
- ✅ Own the code and can modify it
- ✅ Understand exactly what's running
- ✅ Never worry about breaking changes
- ✅ Can customize for your needs
- ✅ Keep your bundle small

This is intentional. NAF is designed to be simple enough to copy, read, and understand.

## Need Help?

- Check example in the repo
- The code is small enough to read through!

Happy coding with NAF! 🚀
