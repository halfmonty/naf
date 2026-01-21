// ============================================================================
// NAF (Not A Framework) - Vanilla SPA Helper Functions
// ============================================================================
// A ~2KB gzipped reactive framework for building SPAs with zero dependencies.
// Based on alien-signals (MIT) for the reactivity system.
// https://github.com/stackblitz/alien-signals
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Component interface - represents a mountable piece of UI.
 *
 * Components have an HTML string, lifecycle hooks, and an optional DOM reference.
 *
 * @template T - The type of the root element (defaults to Element)
 *
 * @example
 * const myComponent: Component = {
 *   html: '<div>Hello</div>',
 *   mount(parent) {
 *     parent.innerHTML = this.html;
 *   },
 *   unmount() {
 *     console.log('Cleanup');
 *   }
 * };
 */
export interface Component<T extends Element = Element> {
  /** Template string to render */
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
  /** Called after component is mounted, receives the root element and parent */
  onMount?: (el: T | undefined, parent: Element) => void;
  /** Called before component is unmounted */
  onUnmount?: () => void;
}

/** Valid values that can be interpolated in templates */
type TemplateValue = Component | string | number | boolean | null | undefined;

// ============================================================================
// REACTIVITY SYSTEM
// ============================================================================
// Based on alien-signals (MIT License)
// Implements a fine-grained reactivity system with signals, computed, and effects
// ============================================================================

/**
 * Link between a dependency and a subscriber in the reactivity graph.
 * Forms a doubly-linked list structure for efficient tracking.
 * @internal
 */
interface Link {
  dep: Dependency;
  sub: Subscriber;
  nextDep?: Link;
  prevDep?: Link;
  nextSub?: Link;
  prevSub?: Link;
}

/**
 * A dependency that can notify its subscribers when it changes.
 * @internal
 */
interface Dependency {
  subs?: Link;
  subsTail?: Link;
  execute(): void;
}

/**
 * A subscriber that tracks its dependencies.
 * @internal
 */
interface Subscriber {
  deps?: Link;
  depsTail?: Link;
}

/**
 * Effect subscriber with a function to run.
 * @internal
 */
interface EffectSubscriber extends Subscriber {
  fn: () => void;
}

/**
 * Signal dependency that holds a value.
 * @internal
 */
interface SignalDependency<T> extends Dependency {
  value: T;
}

/** The currently active subscriber during dependency tracking */
let activeSub: Subscriber | undefined;

/**
 * Links a dependency to a subscriber for reactivity tracking.
 * Creates a bidirectional link in the reactivity graph.
 * @internal
 */
function link(dep: Dependency, sub: Subscriber): void {
  const currentTail = sub.depsTail;

  // Optimization: reuse next link if it's the same dependency
  if (currentTail !== undefined) {
    const nextLink = currentTail.nextDep;
    if (nextLink !== undefined && nextLink.dep === dep) {
      sub.depsTail = nextLink;
      return;
    }
  }

  // Create new link
  const newLink: Link = {
    dep,
    sub,
    nextDep: undefined,
    prevDep: currentTail,
    nextSub: undefined,
    prevSub: dep.subsTail,
  };

  // Add to subscriber's dependency list
  if (currentTail !== undefined) {
    currentTail.nextDep = newLink;
  } else {
    sub.deps = newLink;
  }

  // Add to dependency's subscriber list
  if (dep.subsTail !== undefined) {
    dep.subsTail.nextSub = newLink;
  } else {
    dep.subs = newLink;
  }

  dep.subsTail = newLink;
  sub.depsTail = newLink;
}

/**
 * Notifies all subscribers of a dependency that it has changed.
 * Collects all subscribers first to avoid issues with mid-iteration modifications.
 * @internal
 */
function notify(dep: Dependency): void {
  let link = dep.subs;
  if (link === undefined) return;

  // Collect all subscribers first to avoid infinite loops
  // when effects modify subscriptions during notification
  const subscribers: EffectSubscriber[] = [];
  const seen = new Set<EffectSubscriber>();

  do {
    const sub = link.sub as EffectSubscriber;
    // Only add each subscriber once to prevent duplicate notifications
    if (!seen.has(sub)) {
      seen.add(sub);
      subscribers.push(sub);
    }
    link = link.nextSub;
  } while (link !== undefined);

  // Now notify all collected subscribers
  for (const sub of subscribers) {
    sub.fn();
  }
}

/**
 * Creates a reactive signal that can hold a value and notify subscribers on change.
 *
 * Signals are both getters and setters:
 * - Call with no arguments to read: `signal()`
 * - Call with a value to write: `signal(newValue)`
 *
 * Only notifies subscribers if the value actually changes (uses !== comparison).
 *
 * @template T - The type of value the signal holds
 * @param initialValue - The initial value of the signal
 * @returns A function that gets or sets the signal value
 *
 * @example
 * // Create a signal
 * const count = signal(0);
 *
 * // Read the value
 * console.log(count()); // 0
 *
 * // Set a new value (returns the new value)
 * const newValue = count(5); // newValue = 5
 * console.log(count()); // 5
 *
 * @example
 * // Signals work with any type
 * const user = signal({ name: 'Alice', age: 30 });
 * const isActive = signal(true);
 * const items = signal<string[]>([]);
 */
export function signal<T>(initialValue: T): {
  (): T;
  (value: T): T;
} {
  const dep: SignalDependency<T> = {
    value: initialValue,
    subs: undefined,
    subsTail: undefined,
    execute() {
      notify(dep);
    },
  };

  function signalFn(newValue?: T): T | void {
    // Setter: signal(value)
    if (arguments.length > 0) {
      if (dep.value !== newValue) {
        dep.value = newValue!;
        notify(dep);
      }
      return newValue!;
    }

    // Getter: signal()
    if (activeSub !== undefined) {
      link(dep, activeSub);
    }
    return dep.value;
  }

  return signalFn as any;
}

/**
 * Creates a computed value that automatically tracks and caches dependencies.
 *
 * Computed values:
 * - Only recompute when dependencies change (lazy evaluation)
 * - Cache their result until marked dirty
 * - Can be used as dependencies for other computeds or effects
 * - Automatically track all signals/computeds accessed during computation
 *
 * @template T - The type of computed value
 * @param fn - Function that computes the value
 * @returns A function that returns the cached or recomputed value
 *
 * @example
 * // Basic computed
 * const count = signal(5);
 * const doubled = computed(() => count() * 2);
 * console.log(doubled()); // 10
 * count(10);
 * console.log(doubled()); // 20
 *
 * @example
 * // Computed with multiple dependencies
 * const firstName = signal('John');
 * const lastName = signal('Doe');
 * const fullName = computed(() => `${firstName()} ${lastName()}`);
 *
 * @example
 * // Chained computeds
 * const todos = signal([{ done: false }, { done: true }]);
 * const activeCount = computed(() => todos().filter(t => !t.done).length);
 * const message = computed(() => `${activeCount()} tasks remaining`);
 */
export function computed<T>(fn: () => T): () => T {
  let dirty = true;
  let value: T;

  // Dependency that consumers subscribe to
  const dep: Dependency = {
    subs: undefined,
    subsTail: undefined,
    execute() {
      notify(dep);
    },
  };

  // Subscriber that tracks our dependencies
  const sub: EffectSubscriber = {
    deps: undefined,
    depsTail: undefined,
    fn() {
      // When dependencies change, mark dirty and notify consumers
      dirty = true;
      dep.execute();
    },
  };

  return function computedFn(): T {
    // Register as dependency for consumers (effects/other computeds)
    if (activeSub !== undefined) {
      link(dep, activeSub);
    }

    // Recompute only if dirty
    if (dirty) {
      const prevSub = activeSub;
      activeSub = sub; // Start tracking dependencies

      // Clear old dependencies completely
      let link = sub.deps;
      while (link !== undefined) {
        const nextLink = link.nextDep;
        const dep = link.dep;

        // Remove this subscriber from dependency's list
        if (link.prevSub !== undefined) {
          link.prevSub.nextSub = link.nextSub;
        } else {
          dep.subs = link.nextSub;
        }

        if (link.nextSub !== undefined) {
          link.nextSub.prevSub = link.prevSub;
        } else {
          dep.subsTail = link.prevSub;
        }

        link = nextLink;
      }

      sub.deps = undefined;
      sub.depsTail = undefined;

      try {
        value = fn();
      } finally {
        activeSub = prevSub;
      }
      dirty = false;
    }
    return value;
  };
}

/**
 * Creates an effect that automatically runs when its dependencies change.
 *
 * Effects:
 * - Run immediately on creation
 * - Re-run whenever accessed signals/computeds change
 * - Automatically track dependencies (no manual subscription needed)
 * - Clean up old dependencies before re-running (supports conditional logic)
 * - Return a cleanup function to stop tracking
 *
 * Use effects for side effects like:
 * - DOM updates
 * - Logging
 * - API calls
 * - Local storage updates
 *
 * @param fn - Function to run (and re-run on dependency changes)
 * @returns Cleanup function to stop the effect
 *
 * @example
 * // Basic effect
 * const count = signal(0);
 * effect(() => {
 *   console.log(`Count is: ${count()}`);
 * }); // Logs immediately: "Count is: 0"
 * count(5); // Logs: "Count is: 5"
 *
 * @example
 * // Effect with cleanup
 * const isActive = signal(true);
 * const stopEffect = effect(() => {
 *   if (isActive()) {
 *     console.log('Active');
 *   }
 * });
 * // Later, stop the effect
 * stopEffect();
 *
 * @example
 * // Conditional dependencies
 * const showA = signal(true);
 * const a = signal(1);
 * const b = signal(2);
 * effect(() => {
 *   // Only tracks the signal that's actually accessed
 *   console.log(showA() ? a() : b());
 * });
 */
export function effect(fn: () => void): () => void {
  let running = false;

  const sub: EffectSubscriber = {
    fn: () => {}, // Will be set to run function
    deps: undefined,
    depsTail: undefined,
  };

  /**
   * Unlinks this effect from all its dependencies.
   * Called before re-running to clear old dependency tracking.
   */
  const cleanup = () => {
    let link = sub.deps;
    while (link !== undefined) {
      const nextLink = link.nextDep;
      const dep = link.dep;

      // Remove this subscriber from dependency's list
      if (link.prevSub !== undefined) {
        link.prevSub.nextSub = link.nextSub;
      } else {
        dep.subs = link.nextSub;
      }

      if (link.nextSub !== undefined) {
        link.nextSub.prevSub = link.prevSub;
      } else {
        dep.subsTail = link.prevSub;
      }

      link = nextLink;
    }

    sub.deps = undefined;
    sub.depsTail = undefined;
  };

  /**
   * Runs the effect function with dependency tracking.
   * Cleans up old dependencies first to support conditional tracking.
   */
  const run = () => {
    // Prevent re-entrant execution
    if (running) return;

    running = true;
    const prevSub = activeSub;
    activeSub = sub; // Start tracking dependencies

    cleanup(); // Clear old dependencies before re-tracking

    try {
      fn();
    } finally {
      activeSub = prevSub; // Restore previous tracking context
      running = false;
    }
  };

  // Point subscriber's fn to run so notify() calls it
  sub.fn = run;

  // Run effect immediately
  run();

  // Return cleanup function
  return cleanup;
}

// ============================================================================
// COMPONENT SYSTEM
// ============================================================================

/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * Always use this function when rendering user-provided content!
 *
 * Escapes: & < > " '
 *
 * @param str - String to escape
 * @returns HTML-safe string
 *
 * @example
 * const userInput = '<script>alert("xss")</script>';
 * template`<p>${text(userInput)}</p>`;
 * // Renders: <p>&lt;script&gt;alert("xss")&lt;/script&gt;</p>
 *
 * @example
 * const comment = signal('Hello & goodbye');
 * template`<div class="comment">${text(comment())}</div>`;
 * // Safe: renders "Hello &amp; goodbye"
 */
export function text(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Type guard to check if a value is a Component.
 * @internal
 */
function isComponent(value: unknown): value is Component {
  return (
    value != null &&
    typeof value === "object" &&
    "html" in value &&
    "mount" in value
  );
}

/**
 * Builds HTML string and extracts components from template literal parts.
 * @internal
 */
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

/**
 * Creates a component with mount/unmount logic and lifecycle hooks.
 * @internal
 */
function createComponent<T extends Element>(
  html: string,
  components: Component[],
  options?: TemplateOptions<T>,
): Component<T> {
  const component: Component<T> = {
    html,
    el: undefined,
    mount(parent: Element) {
      // Only set innerHTML if parent is empty (root mount scenario)
      // Child components expect HTML to already be set by parent
      if (!parent.innerHTML) {
        parent.innerHTML = html;
      }

      // Mount all child components
      for (const c of components) {
        c.mount(parent);
      }

      // Capture root element reference if selector provided
      if (options?.root) {
        component.el = parent.querySelector<T>(options.root) ?? undefined;
      }

      // Call lifecycle hook
      options?.onMount?.(component.el, parent);
    },
    unmount() {
      // Unmount all child components
      for (const c of components) {
        c.unmount?.();
      }

      // Call lifecycle hook
      options?.onUnmount?.();
    },
  };
  return component;
}

/**
 * Creates a reactive slot placeholder for dynamic content (used by when/each).
 * Returns a component with a placeholder span that can be updated reactively.
 * @internal
 */
function reactiveSlot(
  dataAttr: string,
  setupEffect: (placeholder: Element) => () => void,
): Component {
  const id = crypto.randomUUID();
  let stopEffect: (() => void) | undefined;
  const html = `<span data-${dataAttr}="${id}"></span>`;

  return {
    html,
    mount(parent: Element) {
      // Find the placeholder element (may already be inserted by parent's HTML)
      let placeholder = parent.querySelector(`[data-${dataAttr}="${id}"]`);

      // If placeholder doesn't exist, insert it (direct mount scenario)
      if (!placeholder) {
        parent.innerHTML = html;
        placeholder = parent.querySelector(`[data-${dataAttr}="${id}"]`);
        if (!placeholder) {
          throw new Error(
            `Could not find placeholder with data-${dataAttr}="${id}"`,
          );
        }
      }

      // Set up reactive effect
      stopEffect = setupEffect(placeholder);
    },
    unmount() {
      stopEffect?.();
    },
  };
}

/**
 * Tagged template literal for creating components with automatic child registration.
 *
 * The template function:
 * - Accepts template literals with embedded components/values
 * - Automatically registers child components for lifecycle management
 * - Supports optional root selector for capturing DOM reference
 * - Supports lifecycle hooks (onMount, onUnmount)
 *
 * Can be called two ways:
 * 1. As a tagged template: `template`<html>``
 * 2. With options first: `template({ root: '#id' })`<html>``
 *
 * @template T - Type of root element (when using root selector)
 *
 * @example
 * // Basic usage
 * function Header() {
 *   return template`
 *     <header>
 *       <h1>My App</h1>
 *     </header>
 *   `;
 * }
 *
 * @example
 * // With child components
 * function Page() {
 *   const header = Header();
 *   const content = Content();
 *   return template`
 *     <div>
 *       ${header}
 *       ${content}
 *     </div>
 *   `;
 * }
 *
 * @example
 * // With root selector to capture element
 * function Form() {
 *   return template({ root: '#my-form' })`
 *     <form id="my-form">
 *       <input type="text" />
 *     </form>
 *   `;
 * }
 * const form = Form();
 * form.mount(document.body);
 * form.el; // HTMLFormElement
 *
 * @example
 * // With lifecycle hooks
 * function Counter() {
 *   const count = signal(0);
 *   let cleanup: (() => void) | undefined;
 *
 *   return template({
 *     root: '#counter',
 *     onMount(el) {
 *       cleanup = effect(() => {
 *         if (el) el.textContent = `Count: ${count()}`;
 *       });
 *     },
 *     onUnmount() {
 *       cleanup?.();
 *     }
 *   })`
 *     <div id="counter"></div>
 *   `;
 * }
 *
 * @example
 * // Interpolating reactive values
 * const count = signal(5);
 * const doubled = computed(() => count() * 2);
 * template`
 *   <div>
 *     <p>Count: ${count()}</p>
 *     <p>Doubled: ${doubled()}</p>
 *   </div>
 * `;
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
  // Called with options: template({ root: '#id' })`...`
  if (
    !Array.isArray(optionsOrStrings) &&
    typeof optionsOrStrings === "object" &&
    !("raw" in optionsOrStrings)
  ) {
    const options = optionsOrStrings as TemplateOptions<T>;
    return (
      strings: TemplateStringsArray,
      ...values: TemplateValue[]
    ): Component<T> => {
      const { html, components } = buildTemplate(strings, values);
      return createComponent(html, components, options);
    };
  }

  // Called directly as tagged template: template`...`
  const strings = optionsOrStrings as TemplateStringsArray;
  const values = valuesOrNothing;
  const { html, components } = buildTemplate(strings, values);
  return createComponent(html, components);
}

/**
 * Conditional rendering based on a reactive condition.
 *
 * Efficiently renders different components based on a boolean signal/computed.
 * Automatically unmounts the previous component before mounting the new one.
 *
 * @param condition - Function returning boolean (typically a signal or computed)
 * @param then - Function returning component to render when true
 * @param otherwise - Optional function returning component to render when false
 * @returns Component that reactively switches between branches
 *
 * @example
 * // Basic conditional rendering
 * const isLoggedIn = signal(false);
 *
 * function App() {
 *   return template`
 *     <div>
 *       ${when(
 *         () => isLoggedIn(),
 *         () => template`<p>Welcome back!</p>`,
 *         () => template`<p>Please log in</p>`
 *       )}
 *       <button>Toggle</button>
 *     </div>
 *   `;
 * }
 *
 * @example
 * // Without else branch
 * const showDetails = signal(false);
 * template`
 *   <div>
 *     ${when(
 *       () => showDetails(),
 *       () => template`<div class="details">...</div>`
 *     )}
 *   </div>
 * `;
 *
 * @example
 * // With computed condition
 * const todos = signal([...]);
 * const hasTodos = computed(() => todos().length > 0);
 *
 * template`
 *   ${when(
 *     hasTodos,
 *     () => TodoList({ todos }),
 *     () => template`<p>No todos yet!</p>`
 *   )}
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
      // Unmount previous component
      currentComponent?.unmount?.();

      // Get new component based on condition
      currentComponent = condition() ? then() : otherwise?.();

      // Update placeholder with new content
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
 * Important notes:
 * - Re-renders ALL items when the array changes (no keying/diffing)
 * - Provides index as a getter function (not a value) to avoid closure issues
 * - Automatically unmounts old components before rendering new ones
 *
 * @template T - Type of items in the array
 * @param items - Function returning array (typically a signal)
 * @param render - Function that renders each item as a component
 * @returns Component that reactively updates when array changes
 *
 * @example
 * // Basic list rendering
 * const todos = signal([
 *   { id: 1, text: 'Learn NAF', done: false },
 *   { id: 2, text: 'Build app', done: false }
 * ]);
 *
 * template`
 *   <ul>
 *     ${each(
 *       () => todos(),
 *       (todo) => template`
 *         <li>${text(todo.text)}</li>
 *       `
 *     )}
 *   </ul>
 * `;
 *
 * @example
 * // With index
 * const items = signal(['a', 'b', 'c']);
 * each(
 *   () => items(),
 *   (item, index) => template`
 *     <div>${index()}: ${item}</div>
 *   `
 * )
 *
 * @example
 * // With component functions
 * const users = signal([...]);
 * each(
 *   () => users(),
 *   (user) => UserCard({ user })
 * )
 *
 * @example
 * // With filtering
 * const todos = signal([...]);
 * const filter = signal('all');
 * const filtered = computed(() => {
 *   const f = filter();
 *   return f === 'all'
 *     ? todos()
 *     : todos().filter(t => t.status === f);
 * });
 *
 * each(() => filtered(), (todo) => TodoItem({ todo }))
 */
export function each<T>(
  items: () => T[],
  render: (item: T, index: () => number) => Component,
): Component {
  let components: Component[] = [];

  return reactiveSlot("each", (placeholder) => {
    const stopEffect = effect(() => {
      // Unmount all previous components
      components.forEach((c) => c.unmount?.());
      components = [];

      // Render new components for current array
      const itemsArray = items();
      const html = itemsArray
        .map((item, i) => {
          // Capture index value in closure to avoid stale closures
          const index = i;
          const comp = render(item, () => index);
          components.push(comp);
          return comp.html;
        })
        .join("");

      // Update placeholder with all item HTML
      placeholder.innerHTML = html;

      // Mount all components
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
 * Creates an effect that updates the element property whenever
 * the reactive dependencies change. Returns a cleanup function.
 *
 * @template K - The property name (keyof HTMLElement)
 * @param el - The HTML element to bind to
 * @param prop - The property name to update
 * @param getter - Function that returns the property value
 * @returns Cleanup function to stop the binding
 *
 * @example
 * // Bind text content
 * const count = signal(0);
 * const display = document.querySelector('#display');
 * const cleanup = bind(display, 'textContent', () => `Count: ${count()}`);
 *
 * @example
 * // Bind class name
 * const isActive = signal(false);
 * const button = document.querySelector('button');
 * bind(button, 'className', () => isActive() ? 'active' : 'inactive');
 *
 * @example
 * // With cleanup
 * const cleanup = bind(element, 'textContent', () => signal());
 * // Later...
 * cleanup(); // Stop updating
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
 *
 * Creates an effect that updates the element attribute whenever
 * the reactive dependencies change. Setting value to null removes the attribute.
 * Returns a cleanup function.
 *
 * @param el - The element to bind to
 * @param attr - The attribute name
 * @param getter - Function that returns the attribute value (null to remove)
 * @returns Cleanup function to stop the binding
 *
 * @example
 * // Bind disabled state
 * const isDisabled = signal(false);
 * const button = document.querySelector('button');
 * bindAttr(button, 'disabled', () => isDisabled() ? 'disabled' : null);
 *
 * @example
 * // Bind data attribute
 * const userId = signal('123');
 * const element = document.querySelector('#user');
 * bindAttr(element, 'data-user-id', () => userId());
 *
 * @example
 * // Conditional attribute
 * const isRequired = signal(true);
 * const input = document.querySelector('input');
 * bindAttr(input, 'required', () => isRequired() ? '' : null);
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
// ROUTER
// ============================================================================

/**
 * Configuration options for the router.
 */
export interface RouterOptions {
  /** The root element to mount pages into */
  root: Element;
  /** Route definitions mapping hash paths to page factories */
  routes: Record<string, () => Component>;
  /** Optional component to show when no route matches */
  notFound?: () => Component;
}

/**
 * Router instance returned by createRouter.
 */
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
 * - Supports a custom 404 page
 *
 * @param options - Router configuration
 * @returns Router instance with navigation methods
 *
 * @example
 * // Basic router setup
 * const router = createRouter({
 *   root: document.querySelector('#app')!,
 *   routes: {
 *     '#/': HomePage,
 *     '#/about': AboutPage,
 *     '#/todos': TodoPage,
 *   },
 *   notFound: () => template`<h1>404 - Page Not Found</h1>`,
 * });
 *
 * @example
 * // Programmatic navigation
 * router.navigate('#/about');
 *
 * @example
 * // Navigation links in templates
 * template`
 *   <nav>
 *     <a href="#/">Home</a>
 *     <a href="#/about">About</a>
 *   </nav>
 * `;
 *
 * @example
 * // Cleanup when done
 * router.destroy();
 */
export function createRouter(options: RouterOptions): Router {
  const { root, routes, notFound } = options;
  let currentPage: Component | null = null;

  function handleRoute() {
    // Cleanup previous page
    currentPage?.unmount?.();

    const hash = window.location.hash || "#/";
    const pageFactory = routes[hash];

    if (pageFactory) {
      currentPage = pageFactory();
      root.innerHTML = currentPage.html;
      currentPage.mount(root);
    } else if (notFound) {
      currentPage = notFound();
      root.innerHTML = currentPage.html;
      currentPage.mount(root);
    } else {
      currentPage = null;
      root.innerHTML = `<h1>Page Not Found</h1>`;
    }
  }

  function navigate(path: string) {
    window.location.hash = path;
  }

  function current() {
    return window.location.hash || "#/";
  }

  // Set up event listeners
  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("load", handleRoute);

  // Handle initial route if already loaded
  if (document.readyState === "complete") {
    handleRoute();
  }

  function destroy() {
    window.removeEventListener("hashchange", handleRoute);
    window.removeEventListener("load", handleRoute);
    currentPage?.unmount?.();
    currentPage = null;
  }

  return { navigate, current, destroy };
}
