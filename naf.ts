// ============================================================================
// NAF (Not A Framework) - Vanilla SPA Helper Functions
// ============================================================================
// A ~1.3KB gzipped reactive framework for building SPAs with zero dependencies.
// Simplified Set-based reactivity optimized for small to medium websites.
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Component interface - represents a mountable piece of UI.
 *
 * @template T - The type of the root element (defaults to Element)
 */
export interface Component<T extends Element = Element> {
  /** HTML string to render */
  html: string;
  /** Optional DOM reference (populated if root selector used) */
  el?: T;
  /** Called when component enters DOM */
  mount: (parent: Element) => void;
  /** Called when component leaves DOM */
  unmount?: () => void;
}

/**
 * Options for template function when using root selector and lifecycle hooks.
 *
 * @template T - The type of the root element
 */
interface TemplateOptions<T extends Element = Element> {
  /** CSS selector for the root element to capture in el property */
  root?: string;
  /** Called after component is mounted */
  onMount?: (el: T | undefined, parent: Element) => void;
  /** Called before component is unmounted */
  onUnmount?: () => void;
}

/**
 * Options for template function WITH root selector - guarantees el is non-null.
 *
 * @template T - The type of the root element
 */
interface TemplateOptionsWithRoot<T extends Element = Element> {
  /** CSS selector for the root element to capture in el property */
  root: string;
  /** Called after component is mounted - el is guaranteed to exist */
  onMount?: (el: T, parent: Element) => void;
  /** Called before component is unmounted */
  onUnmount?: () => void;
}

/** Valid values that can be interpolated in templates */
type TemplateValue = Component | string | number | boolean | null | undefined;

/**
 * Signal type - a reactive getter/setter function.
 * Use this type for function parameters and props instead of verbose function signatures.
 *
 * @example
 * // Instead of: props: { count: () => number }
 * // Use: props: { count: Signal<number> }
 */
export type Signal<T> = { (): T; (value: T): T };

/**
 * Computed type - a reactive getter-only function.
 * Use this type for computed values in function parameters and props.
 *
 * @example
 * // Instead of: props: { doubled: () => number }
 * // Use: props: { doubled: Computed<number> }
 */
export type Computed<T> = () => T;

// ============================================================================
// REACTIVITY SYSTEM
// ============================================================================

type Subs = Set<() => void>;

let activeSub: (() => void) | undefined;
let activeSets: Subs[] | undefined;

/** Tracks the current subscriber with a dependency set */
const track = (subs: Subs) => {
  if (activeSub) {
    subs.add(activeSub);
    activeSets?.push(subs);
  }
};

/** Notifies all subscribers in a set */
const notify = (subs: Subs) => [...subs].forEach((fn) => fn());

/**
 * Creates a reactive signal that holds a value.
 *
 * Signals are both getters and setters:
 * - Call with no arguments to read: `count()`
 * - Call with a value to write: `count(5)`
 *
 * Only notifies subscribers if the value changes (uses !== comparison).
 *
 * @example
 * const count = signal(0);
 * console.log(count()); // 0
 * count(5);             // Set value
 * console.log(count()); // 5
 */
export function signal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const subs: Subs = new Set();

  return function (newValue?: T): T {
    if (arguments.length > 0) {
      if (value !== newValue) {
        value = newValue!;
        notify(subs);
      }
      return newValue!;
    }
    track(subs);
    return value;
  } as { (): T; (value: T): T };
}

/**
 * Creates a computed value that automatically tracks dependencies.
 *
 * Computed values:
 * - Only recompute when dependencies change (lazy evaluation)
 * - Cache their result until marked dirty
 * - Automatically track all signals/computeds accessed
 *
 * @example
 * const count = signal(5);
 * const doubled = computed(() => count() * 2);
 * console.log(doubled()); // 10
 * count(10);
 * console.log(doubled()); // 20
 */
export function computed<T>(fn: () => T): Computed<T> {
  let value: T;
  let dirty = true;
  const subs: Subs = new Set();

  const markDirty = () => {
    dirty = true;
    notify(subs);
  };

  return () => {
    track(subs);
    if (dirty) {
      const prevSub = activeSub;
      activeSub = markDirty;
      value = fn();
      activeSub = prevSub;
      dirty = false;
    }
    return value;
  };
}

/**
 * Creates an effect that runs when dependencies change.
 *
 * Effects:
 * - Run immediately on creation
 * - Re-run whenever accessed signals/computeds change
 * - Automatically track dependencies (no manual subscription)
 * - Return a cleanup function to stop tracking
 *
 * @example
 * const count = signal(0);
 * const cleanup = effect(() => {
 *   console.log(`Count: ${count()}`);
 * });
 * count(5); // Logs: "Count: 5"
 * cleanup(); // Stop tracking
 */
export function effect(fn: () => void): () => void {
  let running = false;
  const subscribedTo: Subs[] = [];

  const run = () => {
    if (running) return;
    running = true;

    // Clear previous subscriptions before re-running
    subscribedTo.forEach((set) => set.delete(run));
    subscribedTo.length = 0;

    const prevSub = activeSub;
    const prevSets = activeSets;
    activeSub = run;
    activeSets = subscribedTo;
    fn();
    activeSub = prevSub;
    activeSets = prevSets;
    running = false;
  };

  run();

  return () => {
    subscribedTo.forEach((set) => set.delete(run));
    subscribedTo.length = 0;
  };
}

// ============================================================================
// COMPONENT SYSTEM
// ============================================================================

/**
 * Escapes HTML to prevent XSS attacks. Always use for user-provided content.
 *
 * @example
 * const userInput = '<script>alert("xss")</script>';
 * template`<p>${text(userInput)}</p>`;
 * // Renders safe: <p>&lt;script&gt;...&lt;/script&gt;</p>
 */
export function text(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Type guard to check if a value is a Component */
function isComponent(value: unknown): value is Component {
  return (
    value != null &&
    typeof value === "object" &&
    "html" in value &&
    "mount" in value
  );
}

/** Builds HTML string and extracts components from template parts */
function buildTemplate(
  strings: TemplateStringsArray,
  values: TemplateValue[],
): { html: string; components: Component[] } {
  const components: Component[] = [];
  const parts: string[] = [strings[0]];

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (isComponent(value)) {
      components.push(value);
      parts.push(value.html);
    } else if (typeof value === "string") {
      // Plain strings are treated as raw HTML without component wrapper
      parts.push(value);
    } else if (value != null && value !== false) {
      parts.push(String(value));
    }
    parts.push(strings[i + 1]);
  }

  return { html: parts.join(""), components };
}

/** Creates a component with mount/unmount logic and lifecycle hooks */
function createComponent<T extends Element>(
  html: string,
  components: Component[],
  options?: TemplateOptions<T>,
): Component<T> {
  const component: Component<T> = {
    html,
    el: undefined,
    mount(parent: Element) {
      if (!parent.innerHTML) {
        parent.innerHTML = html;
      }
      for (const c of components) c.mount(parent);
      if (options?.root) {
        const foundEl = parent.querySelector<T>(options.root);
        if (!foundEl) {
          throw new Error(`Element not found for selector: ${options.root}`);
        }
        component.el = foundEl;
      }
      options?.onMount?.(component.el as T, parent);
    },
    unmount() {
      for (const c of components) c.unmount?.();
      options?.onUnmount?.();
    },
  };
  return component;
}

/** Counter for generating unique slot IDs */
let slotId = 0;

/** Reusable temporary element for parsing HTML strings */
const tempDiv = document.createElement("div");

/**
 * Updates content between comment markers in a reactive slot.
 * Removes old content and inserts new HTML between start and end markers.
 */
function updateSlotContent(
  placeholder: Comment,
  commentId: string,
  html: string,
): void {
  const parent = placeholder.parentNode!;

  // Find end marker
  let node = placeholder.nextSibling;
  while (node && node.textContent !== `/naf-${commentId}`) {
    node = node.nextSibling;
  }
  const end = node;

  // Remove old content (everything between markers)
  node = placeholder.nextSibling;
  while (node && node !== end) {
    const next = node.nextSibling;
    parent.removeChild(node);
    node = next;
  }

  // Insert new content
  if (html) {
    tempDiv.innerHTML = html;
    while (tempDiv.firstChild) {
      parent.insertBefore(tempDiv.firstChild, end);
    }
  }
}

/** Creates a reactive slot placeholder for dynamic content (used by when/each) */
function reactiveSlot(
  dataAttr: string,
  setupEffect: (placeholder: Comment) => () => void,
): Component {
  const id = slotId++;
  let cleanup: (() => void) | undefined;
  const html = `<!--naf-${id}--><!--/naf-${id}-->`;

  return {
    html,
    mount(parent: Element) {
      // Ensure HTML is in DOM first
      if (!parent.innerHTML) {
        parent.innerHTML = html;
      }

      // Find comment node with matching id
      const walker = document.createTreeWalker(
        parent,
        NodeFilter.SHOW_COMMENT,
        null,
      );
      let placeholder: Comment | null = null;
      let endMarker: Comment | null = null;
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent === `naf-${id}`) {
          placeholder = node as Comment;
        } else if (node.textContent === `/naf-${id}`) {
          endMarker = node as Comment;
          break;
        }
      }
      if (!placeholder || !endMarker) {
        throw new Error(`Could not find placeholder comments: naf-${id}`);
      }
      cleanup = setupEffect(placeholder);
    },
    unmount() {
      cleanup?.();
    },
  };
}

/**
 * Tagged template for creating components with automatic child management.
 *
 * Can be called two ways:
 * 1. Direct: template`<div>...</div>`
 * 2. With options: template({ root: '#id' })`<div>...</div>`
 *
 * @example
 * // Basic usage
 * function Header() {
 *   return template`<h1>My App</h1>`;
 * }
 *
 * @example
 * // With lifecycle hooks
 * function Counter() {
 *   const count = signal(0);
 *   return template({
 *     root: '#counter',
 *     onMount(el) {
 *       effect(() => {
 *         if (el) el.textContent = `Count: ${count()}`;
 *       });
 *     }
 *   })`<div id="counter"></div>`;
 * }
 */
export function template<T extends Element = Element>(
  options: TemplateOptionsWithRoot<T>,
): (strings: TemplateStringsArray, ...values: TemplateValue[]) => Component<T>;
export function template<T extends Element = Element>(
  options: TemplateOptions<T>,
): (strings: TemplateStringsArray, ...values: TemplateValue[]) => Component<T>;
export function template(
  strings: TemplateStringsArray,
  ...values: TemplateValue[]
): Component;
export function template<T extends Element = Element>(
  optionsOrStrings: TemplateOptions<T> | TemplateStringsArray,
  ...valuesOrNothing: TemplateValue[]
):
  | Component<T>
  | ((
      strings: TemplateStringsArray,
      ...values: TemplateValue[]
    ) => Component<T>) {
  if (
    !Array.isArray(optionsOrStrings) &&
    typeof optionsOrStrings === "object" &&
    !("raw" in optionsOrStrings)
  ) {
    const options = optionsOrStrings as TemplateOptions<T>;
    return (strings: TemplateStringsArray, ...values: TemplateValue[]) => {
      const { html, components } = buildTemplate(strings, values);
      return createComponent(html, components, options);
    };
  }

  const strings = optionsOrStrings as TemplateStringsArray;
  const values = valuesOrNothing;
  const { html, components } = buildTemplate(strings, values);
  return createComponent(html, components);
}

/**
 * Conditional rendering based on a reactive condition.
 *
 * Efficiently renders different components based on a truthy/falsy value.
 * Automatically unmounts the previous component before mounting the new one.
 * Passes the condition result to callbacks to avoid double computation.
 *
 * @example
 * const isLoggedIn = signal(false);
 * template`
 *   <div>
 *     ${when(
 *       () => isLoggedIn(),
 *       () => template`<p>Welcome back!</p>`,
 *       () => template`<p>Please log in</p>`
 *     )}
 *   </div>
 * `;
 *
 * @example
 * // Avoid double computation by using the passed value
 * const filteredTodos = computed(() => todos().filter(t => !t.done));
 * template`
 *   ${when(
 *     () => filteredTodos(),
 *     (todos) => TodoList({ todos }),  // Uses passed value, no re-computation
 *     () => template`<p>No todos</p>`
 *   )}
 * `;
 */
export function when<T>(
  condition: () => T,
  then: (value: T) => Component,
  otherwise?: (value: T) => Component,
): Component {
  let currentComponent: Component | undefined;

  return reactiveSlot("when", (placeholder) => {
    // Capture id from comment node
    const commentId = placeholder.textContent?.replace("naf-", "") || "0";

    const stopEffect = effect(() => {
      currentComponent?.unmount?.();
      const value = condition();
      currentComponent = value ? then(value) : otherwise?.(value);

      const html = currentComponent?.html ?? "";
      updateSlotContent(placeholder, commentId, html);
      currentComponent?.mount(placeholder.parentNode as Element);
    });

    return () => {
      stopEffect();
      currentComponent?.unmount?.();
    };
  });
}

/**
 * Reactive list rendering that re-renders when the array changes.
 *
 * Note: Re-renders ALL items when the array changes (no keyed diffing).
 *
 * @example
 * const todos = signal([
 *   { id: 1, text: 'Learn NAF' },
 *   { id: 2, text: 'Build app' }
 * ]);
 *
 * template`
 *   <ul>
 *     ${each(
 *       () => todos(),
 *       (todo) => template`<li>${text(todo.text)}</li>`
 *     )}
 *   </ul>
 * `;
 */
export function each<T>(
  items: () => T[],
  render: (item: T, index: () => number) => Component,
): Component {
  let components: Component[] = [];

  return reactiveSlot("each", (placeholder) => {
    // Capture id from comment node
    const commentId = placeholder.textContent?.replace("naf-", "") || "0";

    const stopEffect = effect(() => {
      components.forEach((c) => c.unmount?.());
      components = [];

      const itemsArray = items();
      const html = itemsArray
        .map((item, i) => {
          const comp = render(item, () => i);
          components.push(comp);
          return comp.html;
        })
        .join("");

      updateSlotContent(placeholder, commentId, html);
      components.forEach((c) => c.mount(placeholder.parentNode as Element));
    });

    return () => {
      stopEffect();
      components.forEach((c) => c.unmount?.());
    };
  });
}

/**
 * Reactively binds a value to an element attribute.
 * Handles boolean attributes, string values, and removal.
 *
 * Value handling:
 * - `true`: Sets attribute with empty string (boolean attribute)
 * - `false` or `null`: Removes the attribute
 * - string: Sets attribute with that value
 *
 * @param el - The element to update
 * @param name - The attribute name
 * @param value - A function that returns the attribute value
 * @returns Cleanup function to stop the effect
 *
 * @example
 * // Boolean attribute (disabled)
 * const isDisabled = signal(false);
 * attr(button, 'disabled', () => isDisabled());
 *
 * @example
 * // String attribute
 * const label = signal('Click me');
 * attr(button, 'aria-label', () => label());
 *
 * @example
 * // Conditional attribute
 * attr(button, 'disabled', () => !isValid());
 * attr(input, 'required', () => isRequired());
 */
export function attr(
  el: Element | null | undefined,
  name: string,
  value: () => string | boolean | null,
): () => void {
  if (!el) return () => {};

  return effect(() => {
    const v = value();
    if (v === false || v === null) {
      el.removeAttribute(name);
    } else if (v === true) {
      el.setAttribute(name, "");
    } else {
      el.setAttribute(name, String(v));
    }
  });
}

// ============================================================================
// DOM UTILITIES
// ============================================================================

/**
 * Short alias for querySelector.
 *
 * @example
 * const input = $(el, 'input[type="text"]');
 */
export function $<T extends Element = Element>(
  root: Element | Document,
  selector: string,
): T | null {
  return root.querySelector<T>(selector);
}

/**
 * Short alias for querySelectorAll that returns an array.
 * Enables use of array methods like map, filter, find, etc.
 *
 * @example
 * const buttons = $$(el, 'button');
 * buttons.map(btn => btn.textContent);
 */
export function $$<T extends Element = Element>(
  root: Element | Document,
  selector: string,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/**
 * Finds an element and attaches an event listener.
 * Returns the element for chaining or further use.
 *
 * @example
 * $on(el, 'button', 'click', () => handleClick());
 *
 * @example
 * // Chaining to nested elements
 * const form = $on(el, 'form', 'submit', handleSubmit);
 * if (form) {
 *   $on(form, 'input', 'change', handleChange);
 * }
 */
export function $on<T extends Element = Element>(
  root: Element,
  selector: string,
  event: string,
  handler: (e: Event) => void,
): T | null {
  const el = root.querySelector<T>(selector);
  if (el) el.addEventListener(event, handler);
  return el;
}

/**
 * Creates two-way binding between an input element and a signal.
 * Sets initial value, listens to input events, and optionally syncs signal changes back to input.
 *
 * @param root - The root element to search within
 * @param selector - CSS selector for the input element
 * @param sig - The signal to bind to
 * @param options - Optional configuration
 * @returns The input element or null if not found
 *
 * @example
 * const text = signal('');
 * model(el, 'input', text);
 *
 * @example
 * // With reactive sync (updates input when signal changes externally)
 * model(el, 'input', text, { reactive: true });
 *
 * @example
 * // For checkboxes
 * const checked = signal(false);
 * model(el, 'input[type="checkbox"]', checked, { type: 'checkbox' });
 */
export function model<
  T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
>(
  root: Element,
  selector: string,
  sig: { (): any; (value: any): any },
  options?: { reactive?: boolean; type?: "text" | "checkbox" | "radio" },
): T | null {
  const el = root.querySelector<T>(selector);
  if (!el) return null;

  const type = options?.type || "text";

  // Set initial value
  if (type === "checkbox" && el instanceof HTMLInputElement) {
    el.checked = sig();
  } else if ("value" in el) {
    el.value = sig();
  }

  // Listen to changes
  const eventType = type === "checkbox" ? "change" : "input";
  el.addEventListener(eventType, () => {
    if (type === "checkbox" && el instanceof HTMLInputElement) {
      sig(el.checked);
    } else if ("value" in el) {
      sig(el.value);
    }
  });

  // Optional: Keep input synced with signal changes
  if (options?.reactive) {
    effect(() => {
      const value = sig();
      if (type === "checkbox" && el instanceof HTMLInputElement) {
        el.checked = value;
      } else if ("value" in el && el.value !== value) {
        el.value = value;
      }
    });
  }

  return el;
}

/**
 * Reactively toggles CSS classes on an element based on a condition.
 * Automatically adds/removes the class when the condition changes.
 *
 * @param el - The element to toggle classes on
 * @param className - The CSS class name to toggle
 * @param condition - A function that returns true to add the class, false to remove it
 * @returns Cleanup function to stop the effect
 *
 * @example
 * const isActive = signal(false);
 * toggleClass(button, 'active', () => isActive());
 *
 * @example
 * // Multiple classes
 * toggleClass(el, 'disabled', () => !isValid());
 * toggleClass(el, 'loading', () => isPending());
 */
export function toggleClass(
  el: Element | null | undefined,
  className: string,
  condition: () => boolean,
): () => void {
  if (!el) return () => {};

  return effect(() => {
    if (condition()) {
      el.classList.add(className);
    } else {
      el.classList.remove(className);
    }
  });
}

/**
 * @deprecated Use `attr()` instead. This will be removed in a future version.
 * @example
 * // Old: toggleAttr(button, 'disabled', 'disabled', () => isDisabled())
 * // New: attr(button, 'disabled', () => isDisabled())
 */
export function toggleAttr(
  el: Element | null | undefined,
  attrName: string,
  value: string,
  condition: () => boolean,
): () => void {
  return attr(el, attrName, () => (condition() ? value || true : false));
}

/**
 * Reactively binds a value to an element's textContent.
 * Automatically updates the text when the getter returns a new value.
 *
 * @param el - The element to update
 * @param getter - A function that returns the text value
 * @returns Cleanup function to stop the effect
 *
 * @example
 * const count = signal(0);
 * setText(counterEl, () => count());
 *
 * @example
 * const name = signal('World');
 * setText(greetingEl, () => `Hello, ${name()}!`);
 */
export function setText(
  el: Element | null | undefined,
  getter: () => any,
): () => void {
  if (!el) return () => {};

  return effect(() => {
    el.textContent = String(getter());
  });
}

// ============================================================================
// ROUTER
// ============================================================================

/** Configuration options for the router */
export interface RouterOptions {
  /** The root element to mount pages into */
  root: Element;
  /** Route definitions mapping hash paths to page factories */
  routes: Record<string, () => Component>;
  /** Optional component to show when no route matches */
  notFound?: () => Component;
}

/** Router instance returned by createRouter */
export interface Router {
  /** Navigate programmatically to a route */
  navigate: (path: string) => void;
  /** Get the current route path */
  current: () => string;
  /** Stop the router and clean up event listeners */
  destroy: () => void;
}

/**
 * Creates a hash-based router for single-page applications.
 *
 * The router:
 * - Uses hash-based routing (#/path) for compatibility
 * - Automatically handles browser navigation (back/forward)
 * - Cleans up previous page before mounting new one
 *
 * @example
 * const router = createRouter({
 *   root: document.querySelector('#app')!,
 *   routes: {
 *     '#/': HomePage,
 *     '#/about': AboutPage,
 *     '#/todos': TodoPage,
 *   },
 *   notFound: () => template`<h1>404</h1>`,
 * });
 */
export function createRouter(options: RouterOptions): Router {
  const { root, routes, notFound } = options;
  let currentPage: Component | null = null;

  const current = () => window.location.hash || "#/";

  const handleRoute = () => {
    currentPage?.unmount?.();
    const factory = routes[current()] ?? notFound;

    if (factory) {
      currentPage = factory();
      root.innerHTML = currentPage.html;
      currentPage.mount(root);
    } else {
      currentPage = null;
      root.innerHTML = `<h1>Page Not Found</h1>`;
    }
  };

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("load", handleRoute);

  if (document.readyState === "complete") {
    handleRoute();
  }

  const destroy = () => {
    window.removeEventListener("hashchange", handleRoute);
    window.removeEventListener("load", handleRoute);
    currentPage?.unmount?.();
    currentPage = null;
  };

  return { navigate, current, destroy };
}
