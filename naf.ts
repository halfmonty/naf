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

/** Valid values that can be interpolated in templates */
type TemplateValue = Component | string | number | boolean | null | undefined;

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
export function signal<T>(initialValue: T): { (): T; (value: T): T } {
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
export function computed<T>(fn: () => T): () => T {
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
        component.el = parent.querySelector<T>(options.root) ?? undefined;
      }
      options?.onMount?.(component.el, parent);
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

/** Creates a reactive slot placeholder for dynamic content (used by when/each) */
function reactiveSlot(
  dataAttr: string,
  setupEffect: (placeholder: Element) => () => void,
): Component {
  const id = `naf-${slotId++}`;
  let cleanup: (() => void) | undefined;
  const html = `<span data-${dataAttr}="${id}"></span>`;

  return {
    html,
    mount(parent: Element) {
      let placeholder = parent.querySelector(`[data-${dataAttr}="${id}"]`);
      if (!placeholder) {
        parent.innerHTML = html;
        placeholder = parent.querySelector(`[data-${dataAttr}="${id}"]`);
        if (!placeholder) {
          throw new Error(
            `Could not find placeholder data-${dataAttr}="${id}"`,
          );
        }
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
 * Efficiently renders different components based on a boolean.
 * Automatically unmounts the previous component before mounting the new one.
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
 */
export function when(
  condition: () => boolean,
  then: () => Component,
  otherwise?: () => Component,
): Component {
  let currentComponent: Component | undefined;

  return reactiveSlot("when", (placeholder) => {
    const stopEffect = effect(() => {
      currentComponent?.unmount?.();
      currentComponent = condition() ? then() : otherwise?.();
      placeholder.innerHTML = currentComponent?.html ?? "";
      currentComponent?.mount(placeholder);
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

      placeholder.innerHTML = html;
      components.forEach((c) => c.mount(placeholder));
    });

    return () => {
      stopEffect();
      components.forEach((c) => c.unmount?.());
    };
  });
}

/**
 * Binds a reactive value to an element property.
 *
 * @example
 * const count = signal(0);
 * const display = document.querySelector('#display');
 * bind(display, 'textContent', () => `Count: ${count()}`);
 */
export function bind<K extends keyof HTMLElement>(
  el: HTMLElement,
  prop: K,
  getter: () => HTMLElement[K],
): () => void {
  return effect(() => {
    el[prop] = getter();
  });
}

/**
 * Binds a reactive value to an element attribute.
 * Setting value to null removes the attribute.
 *
 * @example
 * const isDisabled = signal(false);
 * const button = document.querySelector('button');
 * bindAttr(button, 'disabled', () => isDisabled() ? 'disabled' : null);
 */
export function bindAttr(
  el: Element,
  attr: string,
  getter: () => string | null,
): () => void {
  return effect(() => {
    const value = getter();
    if (value === null) {
      el.removeAttribute(attr);
    } else {
      el.setAttribute(attr, value);
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
 * Short alias for querySelectorAll.
 *
 * @example
 * const buttons = $$(el, 'button');
 */
export function $$<T extends Element = Element>(
  root: Element | Document,
  selector: string,
): NodeListOf<T> {
  return root.querySelectorAll<T>(selector);
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
