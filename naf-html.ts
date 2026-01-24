// ============================================================================
// NAF-HTML - HTML-First Reactive Bindings
// ============================================================================
// A minimal reactive library for progressive enhancement.
// HTML renders first, JavaScript binds reactivity to existing elements.
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Signal type - a reactive getter/setter function.
 * @example
 * const count = signal(0);
 * count();    // read: 0
 * count(5);   // write: 5
 */
export type Signal<T> = { (): T; (value: T): T };

/**
 * Computed type - a reactive getter-only function.
 * @example
 * const doubled = computed(() => count() * 2);
 * doubled();  // read computed value
 */
export type Computed<T> = () => T;

/**
 * Binding interface for bind() function.
 */
export interface Binding {
  /** Called when binding is activated */
  mount: () => void;
  /** Called when binding is deactivated */
  unmount?: () => void;
}

// ============================================================================
// REACTIVITY SYSTEM
// ============================================================================

type Subs = Set<() => void>;

let activeSub: (() => void) | undefined;
let activeSets: Subs[] | undefined;

const track = (subs: Subs) => {
  if (activeSub) {
    subs.add(activeSub);
    activeSets?.push(subs);
  }
};

const notify = (subs: Subs) => [...subs].forEach((fn) => fn());

/**
 * Creates a reactive signal that holds a value.
 * Call with no arguments to read, with a value to write.
 * Only notifies subscribers if value changes.
 *
 * @example
 * const count = signal(0);
 * count();     // 0
 * count(5);    // sets to 5, notifies subscribers
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
  } as Signal<T>;
}

/**
 * Creates a computed value that automatically tracks dependencies.
 * Lazy evaluation - only recomputes when accessed after dependencies change.
 *
 * @example
 * const count = signal(5);
 * const doubled = computed(() => count() * 2);
 * doubled(); // 10
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
 * Runs immediately, then re-runs whenever accessed signals change.
 * Returns cleanup function to stop tracking.
 *
 * @example
 * const count = signal(0);
 * const stop = effect(() => console.log(count()));
 * count(5); // logs: 5
 * stop();   // stops tracking
 */
export function effect(fn: () => void): () => void {
  let running = false;
  const subscribedTo: Subs[] = [];

  const run = () => {
    if (running) return;
    running = true;

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
// DOM UTILITIES
// ============================================================================

/**
 * Escapes HTML to prevent XSS. Use for user-provided content.
 *
 * @example
 * const safe = text('<script>alert("xss")</script>');
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
 * Short alias for querySelector. Searches document by default.
 *
 * @example
 * const btn = $<HTMLButtonElement>('button');
 * const input = $<HTMLInputElement>('input[name="email"]', form);
 */
export function $<T extends Element = Element>(
  selector: string,
  root: Element | Document = document,
): T | null {
  return root.querySelector<T>(selector);
}

/**
 * Short alias for querySelectorAll, returns array. Searches document by default.
 *
 * @example
 * const items = $$<HTMLLIElement>('li', list);
 * const buttons = $$('button'); // searches document
 */
export function $$<T extends Element = Element>(
  selector: string,
  root: Element | Document = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/**
 * Attaches event listener. Can bind directly to element or find child first.
 *
 * @example
 * $on(myButton, 'click', handler);           // direct binding
 * $on(form, 'button', 'click', handler);     // finds child first
 */
export function $on<T extends Element = Element>(
  el: T,
  event: string,
  handler: (e: Event) => void,
): T;
export function $on<T extends Element = Element>(
  root: Element,
  selector: string,
  event: string,
  handler: (e: Event) => void,
): T | null;
export function $on<T extends Element = Element>(
  elOrRoot: Element,
  eventOrSelector: string,
  handlerOrEvent: string | ((e: Event) => void),
  maybeHandler?: (e: Event) => void,
): T | null {
  if (typeof handlerOrEvent === "function") {
    // Direct: $on(el, event, handler)
    elOrRoot.addEventListener(eventOrSelector, handlerOrEvent);
    return elOrRoot as T;
  }
  // Selector: $on(root, selector, event, handler)
  const el = elOrRoot.querySelector<T>(eventOrSelector);
  if (el) el.addEventListener(handlerOrEvent, maybeHandler!);
  return el;
}

// ============================================================================
// REACTIVE BINDINGS
// ============================================================================

/**
 * Reactively binds a value to an element's textContent.
 *
 * @example
 * const count = signal(0);
 * setText($('#counter'), () => count());
 */
export function setText(
  el: Element | null | undefined,
  getter: () => unknown,
): () => void {
  if (!el) return () => {};
  return effect(() => {
    el.textContent = String(getter());
  });
}

/**
 * Reactively toggles a CSS class based on condition.
 *
 * @example
 * const isActive = signal(false);
 * toggleClass(btn, 'active', () => isActive());
 */
export function toggleClass(
  el: Element | null | undefined,
  className: string,
  condition: () => boolean,
): () => void {
  if (!el) return () => {};
  return effect(() => {
    el.classList.toggle(className, condition());
  });
}

/**
 * Reactively binds a value to an element attribute.
 * - true: sets attribute with empty string (boolean attribute)
 * - false/null: removes attribute
 * - string: sets attribute value
 *
 * @example
 * attr(btn, 'disabled', () => !isValid());
 * attr(link, 'href', () => currentUrl());
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
      el.setAttribute(name, v);
    }
  });
}

/**
 * Two-way binding between input and signal.
 * Can bind directly to element or find child first.
 *
 * @example
 * model(myInput, nameSig);                        // direct binding
 * model(form, 'input[name="email"]', emailSig);   // finds child first
 */
export function model<
  T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
>(
  el: T,
  sig: Signal<unknown>,
  options?: { reactive?: boolean; type?: "text" | "checkbox" | "radio" },
): T;
export function model<
  T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
>(
  root: Element,
  selector: string,
  sig: Signal<unknown>,
  options?: { reactive?: boolean; type?: "text" | "checkbox" | "radio" },
): T | null;
export function model<
  T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
>(
  elOrRoot: Element,
  selectorOrSig: string | Signal<unknown>,
  sigOrOptions?:
    | Signal<unknown>
    | { reactive?: boolean; type?: "text" | "checkbox" | "radio" },
  maybeOptions?: { reactive?: boolean; type?: "text" | "checkbox" | "radio" },
): T | null {
  let el: T | null;
  let sig: Signal<unknown>;
  let options:
    | { reactive?: boolean; type?: "text" | "checkbox" | "radio" }
    | undefined;

  if (typeof selectorOrSig === "function") {
    // Direct: model(el, sig, options?)
    el = elOrRoot as T;
    sig = selectorOrSig;
    options = sigOrOptions as typeof options;
  } else {
    // Selector: model(root, selector, sig, options?)
    el = elOrRoot.querySelector<T>(selectorOrSig);
    sig = sigOrOptions as Signal<unknown>;
    options = maybeOptions;
  }

  if (!el) return null;

  const type = options?.type || "text";

  if (type === "checkbox" && el instanceof HTMLInputElement) {
    el.checked = sig() as boolean;
  } else if ("value" in el) {
    el.value = sig() as string;
  }

  const eventType = type === "checkbox" ? "change" : "input";
  el.addEventListener(eventType, () => {
    if (type === "checkbox" && el instanceof HTMLInputElement) {
      sig(el.checked);
    } else if ("value" in el) {
      sig(el.value);
    }
  });

  if (options?.reactive) {
    effect(() => {
      const value = sig();
      if (type === "checkbox" && el instanceof HTMLInputElement) {
        el.checked = value as boolean;
      } else if ("value" in el && el.value !== value) {
        el.value = value as string;
      }
    });
  }

  return el;
}

// ============================================================================
// HTML-FIRST BINDINGS
// ============================================================================

/**
 * Binds reactive behavior to an existing DOM element.
 * Returns cleanup function.
 *
 * @example
 * const cleanup = bind($('#counter')!, (el) => ({
 *   mount() {
 *     setText($('.count', el), () => count());
 *     $on(el, 'button', 'click', () => count(count() + 1));
 *   },
 *   unmount() {
 *     console.log('cleaned up');
 *   }
 * }));
 */
export function bind(
  el: Element | null,
  setup: (el: Element) => Binding | void,
): () => void {
  if (!el) return () => {};
  const binding = setup(el);
  binding?.mount();
  return () => binding?.unmount?.();
}

/**
 * Renders a keyed list from a template element.
 * Efficiently updates by key - only adds/removes/reorders changed items.
 * Setup function can return a cleanup function for custom cleanup.
 *
 * @param container - Element to render items into
 * @param templateEl - Template element to clone for each item
 * @param items - Function returning array of items
 * @param key - Function to get unique key from item
 * @param setup - Called for each item, can return cleanup function
 * @returns Cleanup function
 *
 * @example
 * list(
 *   $('#todo-list')!,
 *   $('#todo-tpl') as HTMLTemplateElement,
 *   () => todos(),
 *   (t) => t.id,
 *   (el, item) => {
 *     const c1 = setText($('.text', el), () => item().text);
 *     const c2 = toggleClass(el, 'done', () => item().done);
 *     return () => { c1(); c2(); }; // optional cleanup
 *   }
 * );
 */
export function list<T>(
  container: Element | null,
  templateEl: HTMLTemplateElement | null,
  items: () => T[],
  key: (item: T) => string | number,
  setup: (
    el: Element,
    item: () => T,
    index: () => number,
  ) => void | (() => void),
): () => void {
  if (!container || !templateEl) return () => {};

  const keyToEl = new Map<string | number, Element>();
  const keyToItem = new Map<string | number, Signal<T>>();
  const keyToIndex = new Map<string | number, Signal<number>>();
  const keyToCleanup = new Map<string | number, () => void>();

  const stopEffect = effect(() => {
    const arr = items();
    const newKeys = new Set(arr.map(key));

    // Remove elements for deleted keys
    for (const [k, el] of keyToEl) {
      if (!newKeys.has(k)) {
        keyToCleanup.get(k)?.();
        el.remove();
        keyToEl.delete(k);
        keyToItem.delete(k);
        keyToIndex.delete(k);
        keyToCleanup.delete(k);
      }
    }

    // Add/reorder/update elements
    let prevEl: Element | null = null;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const k = key(item);
      let el = keyToEl.get(k);

      if (!el) {
        // New item - clone and setup
        el = templateEl.content.firstElementChild!.cloneNode(true) as Element;
        const itemSig = signal(item);
        const indexSig = signal(i);
        keyToEl.set(k, el);
        keyToItem.set(k, itemSig);
        keyToIndex.set(k, indexSig);

        const cleanup = setup(
          el,
          () => itemSig(),
          () => indexSig(),
        );
        if (cleanup) keyToCleanup.set(k, cleanup);
      } else {
        // Existing item - update signals
        keyToItem.get(k)!(item);
        keyToIndex.get(k)!(i);
      }

      // Position correctly in DOM
      if (prevEl) {
        if (el.previousElementSibling !== prevEl) {
          prevEl.after(el);
        }
      } else {
        if (el !== container.firstElementChild) {
          container.prepend(el);
        }
      }
      prevEl = el;
    }
  });

  return () => {
    stopEffect();
    for (const cleanup of keyToCleanup.values()) cleanup();
    keyToEl.clear();
    keyToItem.clear();
    keyToIndex.clear();
    keyToCleanup.clear();
  };
}
