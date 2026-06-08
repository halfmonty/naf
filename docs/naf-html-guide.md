# NAF-HTML API Guide

NAF-HTML is a minimal reactive library for progressive enhancement. Your HTML renders first, then JavaScript binds reactivity to existing elements.

## API Overview

| Function | Purpose |
|----------|---------|
| `signal(value)` | Reactive state |
| `computed(fn)` | Derived state |
| `effect(fn)` | Side effects |
| `$(selector, root?)` | Query one element |
| `$$(selector, root?)` | Query all elements |
| `$on(el, event, handler)` | Event listener |
| `fx(el, fn)` | Reactive DOM binding |
| `model(el, signal, opts?)` | Two-way input binding |
| `list(container, template, items, key, setup)` | Keyed list rendering |
| `text(str)` | Escape HTML |

## Vanilla JS vs NAF-HTML

### Querying Elements

```js
// Vanilla
const btn = document.querySelector('button');
const items = Array.from(document.querySelectorAll('li'));

// NAF-HTML
const btn = $('button');
const items = $$('li');

// With type hints
const input = $<HTMLInputElement>('input[name="email"]');

// Scoped query
const btn = $('button', form);
```

### Event Listeners

```js
// Vanilla
const btn = document.querySelector('button');
btn.addEventListener('click', handleClick);

// NAF-HTML - chainable, null-safe, typed events
$on($('button'), 'click', handleClick);

// Event type is inferred (e is MouseEvent)
$on(btn, 'click', (e) => console.log(e.clientX));
```

### Reactive State

```js
// Vanilla - manual updates everywhere
let count = 0;
const display = document.querySelector('.count');
const increment = () => {
  count++;
  display.textContent = String(count);
  // Must update every place that uses count...
};

// NAF-HTML - automatic updates
const count = signal(0);
fx($('.count'), el => el.textContent = String(count()));
const increment = () => count(count() + 1); // UI updates automatically
```

### Derived Values

```js
// Vanilla - manual recalculation
let todos = [];
const getActiveCount = () => todos.filter(t => !t.done).length;
// Must call getActiveCount() after every change to todos

// NAF-HTML - automatic dependency tracking
const todos = signal([]);
const activeCount = computed(() => todos().filter(t => !t.done).length);
// activeCount() always returns current value, recalculates only when todos changes
```

### Updating Text Content

```js
// Vanilla - one-time set
document.querySelector('.count').textContent = count;

// NAF-HTML - reactive, updates when count changes
fx($('.count'), el => el.textContent = String(count()));
```

### Toggling Classes

```js
// Vanilla - manual toggle
const el = document.querySelector('.item');
el.classList.toggle('active', isActive);

// NAF-HTML - reactive, updates when isActive() changes
fx($('.item'), el => el.classList.toggle('active', isActive()));
```

### Setting Attributes

```js
// Vanilla
btn.disabled = !isValid;
link.setAttribute('href', url);

// NAF-HTML - reactive
fx(btn, el => el.toggleAttribute('disabled', !isValid()));
fx(link, el => el.setAttribute('href', url()));
```

### Form Input Binding

```js
// Vanilla - manual two-way binding
const input = document.querySelector('input');
input.value = initialValue;
input.addEventListener('input', (e) => {
  value = e.target.value;
  // Must manually update anything that depends on value...
});

// NAF-HTML - automatic two-way binding
const value = signal('');
model($('input'), value);
// Input updates signal, signal initializes input

// With reactive sync (signal changes update input)
model($('input'), value, { reactive: true });
```

### Checkbox Binding

```js
// Vanilla
const checkbox = document.querySelector('input[type="checkbox"]');
checkbox.checked = initialState;
checkbox.addEventListener('change', () => {
  state = checkbox.checked;
});

// NAF-HTML - auto-detects checkbox type
const checked = signal(false);
model($('input[type="checkbox"]'), checked);
```

### Rendering Lists

```html
<!-- HTML template -->
<ul class="todo-list"></ul>
<template id="todo-tpl">
  <li class="todo-item">
    <span class="text"></span>
    <button class="delete">X</button>
  </li>
</template>
```

```js
// Vanilla - manual DOM manipulation
const container = document.querySelector('.todo-list');
const template = document.querySelector('#todo-tpl');

function render(todos) {
  container.innerHTML = '';
  todos.forEach(todo => {
    const el = template.content.cloneNode(true);
    el.querySelector('.text').textContent = todo.text;
    el.querySelector('.delete').addEventListener('click', () => {
      todos = todos.filter(t => t.id !== todo.id);
      render(todos);
    });
    container.appendChild(el);
  });
}

// NAF-HTML - declarative, efficient keyed updates
const todos = signal([{ id: 1, text: 'Learn NAF' }]);

list(
  $('.todo-list'),
  $<HTMLTemplateElement>('#todo-tpl'),
  () => todos(),
  t => t.id,  // key function for efficient updates
  (el, item) => {
    fx($('.text', el), e => e.textContent = item().text);
    $on($('.delete', el), 'click', () => {
      todos(todos().filter(t => t.id !== item().id));
    });
  }
);
```

### Side Effects

```js
// Vanilla - must remember to update
localStorage.setItem('count', count);
document.title = `Count: ${count}`;

// NAF-HTML - runs automatically when dependencies change
effect(() => localStorage.setItem('count', String(count())));
effect(() => document.title = `Count: ${count()}`);
```

### Cleanup

```js
// Vanilla - manual cleanup
const handler = () => { ... };
el.addEventListener('click', handler);
// Later...
el.removeEventListener('click', handler);

// NAF-HTML - effects return cleanup functions
const stop = effect(() => console.log(count()));
stop(); // Stops tracking, no more logs

const stopFx = fx(el, e => e.textContent = count());
stopFx(); // Stops reactive updates
```

## Patterns

### Conditional Rendering

```js
// Use fx with native DOM
fx($('.panel'), el => el.hidden = !showPanel());

// Or toggle a class
fx($('.panel'), el => el.classList.toggle('hidden', !showPanel()));
```

### Multiple Reactive Bindings on One Element

```js
const el = $('.item');
fx(el, e => e.textContent = item().text);
fx(el, e => e.classList.toggle('done', item().done));
fx(el, e => e.classList.toggle('urgent', item().priority === 'high'));
```

### Escaping User Content

```js
import { text } from 'naf-html';

// Prevent XSS when inserting user content
el.innerHTML = `<span>${text(userInput)}</span>`;
```

### Combining Signals

```js
const firstName = signal('');
const lastName = signal('');
const fullName = computed(() => `${firstName()} ${lastName()}`.trim());

fx($('.full-name'), el => el.textContent = fullName());
```

## Key Differences from Vanilla

1. **Reactivity is automatic** - Change a signal, all dependent UI updates
2. **Null-safe** - `$`, `$on`, `fx`, `model` all handle null gracefully
3. **Less boilerplate** - No manual DOM queries and updates scattered everywhere
4. **Efficient lists** - `list()` does keyed diffing, only updates what changed
5. **Cleanup built-in** - Effects return cleanup functions

## When to Use What

| Scenario | Use |
|----------|-----|
| One-time DOM query | `$()` or `$$()` |
| Event handling | `$on()` |
| Reactive text/class/attribute | `fx()` |
| Form input binding | `model()` |
| Dynamic list | `list()` |
| Derived state | `computed()` |
| Side effects (logging, storage) | `effect()` |
| Escape HTML | `text()` |

## Advanced Patterns

### Sharing Signals Across Components

Break your UI into component-like modules that share state via imported signals.

```
src/
  state/
    user.ts        # Shared user state
    cart.ts        # Shared cart state
  components/
    header.ts      # Header component
    cart-icon.ts   # Cart icon component
    cart-drawer.ts # Cart drawer component
  pages/
    home.ts
    product.ts
```

**state/cart.ts** - Shared cart state
```ts
import { signal, computed } from 'naf-html';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export const cartItems = signal<CartItem[]>([]);
export const cartOpen = signal(false);

// Derived state available to all components
export const cartCount = computed(() => 
  cartItems().reduce((sum, item) => sum + item.quantity, 0)
);

export const cartTotal = computed(() =>
  cartItems().reduce((sum, item) => sum + item.price * item.quantity, 0)
);

// Actions
export function addToCart(item: Omit<CartItem, 'quantity'>) {
  const existing = cartItems().find(i => i.id === item.id);
  if (existing) {
    cartItems(cartItems().map(i => 
      i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
    ));
  } else {
    cartItems([...cartItems(), { ...item, quantity: 1 }]);
  }
}

export function removeFromCart(id: number) {
  cartItems(cartItems().filter(i => i.id !== id));
}
```

**components/cart-icon.ts** - Uses shared state
```ts
import { $, $on, fx } from 'naf-html';
import { cartCount, cartOpen } from '../state/cart';

export function initCartIcon() {
  const icon = $('.cart-icon');
  const badge = $('.cart-badge', icon);
  
  // Badge updates automatically when cart changes
  fx(badge, el => el.textContent = String(cartCount()));
  fx(badge, el => el.hidden = cartCount() === 0);
  
  // Toggle cart drawer
  $on(icon, 'click', () => cartOpen(!cartOpen()));
}
```

**components/cart-drawer.ts** - Uses same shared state
```ts
import { $, $on, fx, list } from 'naf-html';
import { cartItems, cartOpen, cartTotal, removeFromCart } from '../state/cart';

export function initCartDrawer() {
  const drawer = $('.cart-drawer');
  
  // Drawer visibility bound to cartOpen signal
  fx(drawer, el => el.classList.toggle('open', cartOpen()));
  
  // Close button
  $on($('.cart-close', drawer), 'click', () => cartOpen(false));
  
  // Cart items list
  list(
    $('.cart-items', drawer),
    $<HTMLTemplateElement>('#cart-item-tpl'),
    () => cartItems(),
    item => item.id,
    (el, item) => {
      fx($('.item-name', el), e => e.textContent = item().name);
      fx($('.item-price', el), e => e.textContent = `$${item().price}`);
      fx($('.item-qty', el), e => e.textContent = `x${item().quantity}`);
      $on($('.remove-btn', el), 'click', () => removeFromCart(item().id));
    }
  );
  
  // Total updates automatically
  fx($('.cart-total', drawer), el => el.textContent = `$${cartTotal().toFixed(2)}`);
}
```

**pages/product.ts** - Imports and uses shared cart
```ts
import { $, $on } from 'naf-html';
import { addToCart } from '../state/cart';

export function initProductPage() {
  const product = {
    id: Number($('.product')?.dataset.id),
    name: $('.product-name')?.textContent ?? '',
    price: Number($('.product-price')?.dataset.price),
  };
  
  $on($('.add-to-cart'), 'click', () => addToCart(product));
}
```

### Persistent Signals with localStorage

Create signals that automatically sync with localStorage for persistence across page loads.

**state/persistent.ts**
```ts
import { signal, effect, Signal } from 'naf-html';

/**
 * Creates a signal that persists to localStorage.
 * Initializes from localStorage if available, falls back to defaultValue.
 * Automatically saves to localStorage when signal changes.
 */
export function persistentSignal<T>(key: string, defaultValue: T): Signal<T> {
  // Load initial value from localStorage
  const stored = localStorage.getItem(key);
  const initial = stored ? JSON.parse(stored) : defaultValue;
  
  const sig = signal<T>(initial);
  
  // Auto-save to localStorage when value changes
  effect(() => {
    localStorage.setItem(key, JSON.stringify(sig()));
  });
  
  return sig;
}

/**
 * Creates a signal that persists to sessionStorage.
 * Clears when browser tab is closed.
 */
export function sessionSignal<T>(key: string, defaultValue: T): Signal<T> {
  const stored = sessionStorage.getItem(key);
  const initial = stored ? JSON.parse(stored) : defaultValue;
  
  const sig = signal<T>(initial);
  
  effect(() => {
    sessionStorage.setItem(key, JSON.stringify(sig()));
  });
  
  return sig;
}
```

**Usage - state/user.ts**
```ts
import { computed } from 'naf-html';
import { persistentSignal } from './persistent';

interface User {
  id: number;
  name: string;
  email: string;
}

// Persists across page refreshes and navigation
export const authToken = persistentSignal<string | null>('auth_token', null);
export const currentUser = persistentSignal<User | null>('current_user', null);

// Derived state
export const isLoggedIn = computed(() => authToken() !== null);

// Actions
export function login(token: string, user: User) {
  authToken(token);
  currentUser(user);
}

export function logout() {
  authToken(null);
  currentUser(null);
}
```

**Usage - state/preferences.ts**
```ts
import { persistentSignal } from './persistent';

// User preferences persist across sessions
export const theme = persistentSignal<'light' | 'dark'>('theme', 'light');
export const sidebarOpen = persistentSignal('sidebar_open', true);
export const itemsPerPage = persistentSignal('items_per_page', 10);
```

**Usage - components/theme-toggle.ts**
```ts
import { $, $on, fx } from 'naf-html';
import { theme } from '../state/preferences';

export function initThemeToggle() {
  const toggle = $('.theme-toggle');
  
  // Apply theme to document
  fx(document.documentElement, el => el.dataset.theme = theme());
  
  // Toggle button state
  fx(toggle, el => el.textContent = theme() === 'light' ? '🌙' : '☀️');
  
  $on(toggle, 'click', () => {
    theme(theme() === 'light' ? 'dark' : 'light');
  });
}
```

**Usage - state/cart.ts with persistence**
```ts
import { computed } from 'naf-html';
import { persistentSignal, sessionSignal } from './persistent';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

// Cart persists across page refreshes
export const cartItems = persistentSignal<CartItem[]>('cart_items', []);

// Cart drawer state only persists for session
export const cartOpen = sessionSignal('cart_open', false);

export const cartCount = computed(() => 
  cartItems().reduce((sum, item) => sum + item.quantity, 0)
);
```

### Cross-Tab Synchronization

Sync signals across browser tabs using the storage event.

**state/synced.ts**
```ts
import { signal, effect, Signal } from 'naf-html';

/**
 * Creates a signal that syncs across browser tabs via localStorage.
 */
export function syncedSignal<T>(key: string, defaultValue: T): Signal<T> {
  const stored = localStorage.getItem(key);
  const initial = stored ? JSON.parse(stored) : defaultValue;
  
  const sig = signal<T>(initial);
  
  // Save changes to localStorage
  effect(() => {
    localStorage.setItem(key, JSON.stringify(sig()));
  });
  
  // Listen for changes from other tabs
  window.addEventListener('storage', (e) => {
    if (e.key === key && e.newValue) {
      const newVal = JSON.parse(e.newValue);
      // Only update if different to avoid loops
      if (JSON.stringify(sig()) !== e.newValue) {
        sig(newVal);
      }
    }
  });
  
  return sig;
}
```

**Usage**
```ts
import { syncedSignal } from './synced';

// Changes in one tab appear in all tabs
export const cartItems = syncedSignal('cart', []);
export const theme = syncedSignal('theme', 'light');
```
