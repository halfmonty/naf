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
export function text(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
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
 * Attaches event listener to an element.
 *
 * @example
 * $on(btn, 'click', handler);
 * $on($('button', form), 'click', handler);
 */
export function $on<T extends Element, K extends keyof HTMLElementEventMap>(
  el: T | null,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
): T | null;
export function $on<T extends Element>(
  el: T | null,
  event: string,
  handler: (e: Event) => void,
): T | null;
export function $on<T extends Element>(
  el: T | null,
  event: string,
  handler: (e: Event) => void,
): T | null {
  el?.addEventListener(event, handler);
  return el;
}

// ============================================================================
// REACTIVE BINDINGS
// ============================================================================

/**
 * Binds a reactive effect to an element. Runs immediately and re-runs
 * whenever any accessed signals change. Use native DOM APIs inside.
 *
 * @example
 * fx($('#count'), el => el.textContent = String(count()));
 * fx(btn, el => el.classList.toggle('active', isActive()));
 * fx(btn, el => el.toggleAttribute('disabled', !isValid()));
 * fx(link, el => el.setAttribute('href', currentUrl()));
 */
export function fx<T extends Element>(
  el: T | null | undefined,
  fn: (el: T) => void,
): () => void {
  if (!el) return () => {};
  return effect(() => fn(el));
}

/**
 * Two-way binding between input and signal.
 * Auto-detects checkbox type from element.
 *
 * @example
 * model(input, nameSig);
 * model(checkbox, checkedSig);
 * model(input, valueSig, { reactive: true }); // sync signal changes back to input
 */
export function model<
  T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  V,
>(el: T | null, sig: Signal<V>, options?: { reactive?: boolean }): T | null {
  if (!el) return null;

  const isCheckbox = el instanceof HTMLInputElement && el.type === "checkbox";

  if (isCheckbox) el.checked = sig() as boolean;
  else if ("value" in el) el.value = sig() as string;

  el.addEventListener(isCheckbox ? "change" : "input", () => {
    if (isCheckbox) sig(el.checked as V);
    else if ("value" in el) sig(el.value as V);
  });

  if (options?.reactive) {
    effect(() => {
      const value = sig();
      if (isCheckbox) el.checked = value as boolean;
      else if ("value" in el && el.value !== value) el.value = value as string;
    });
  }

  return el;
}

// ============================================================================
// LIST RENDERING
// ============================================================================

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
 *     const c1 = fx($('.text', el), e => e.textContent = item().text);
 *     const c2 = fx(el, e => e.classList.toggle('done', item().done));
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

  const entries = new Map<
    string | number,
    {
      el: Element;
      item: Signal<T>;
      index: Signal<number>;
      cleanup?: () => void;
    }
  >();

  const stopEffect = effect(() => {
    const arr = items();
    const newKeys = new Set(arr.map(key));

    // Remove elements for deleted keys
    for (const [k, entry] of entries) {
      if (!newKeys.has(k)) {
        entry.cleanup?.();
        entry.el.remove();
        entries.delete(k);
      }
    }

    // Add/reorder/update elements
    let prevEl: Element | null = null;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const k = key(item);
      let entry = entries.get(k);

      if (!entry) {
        // New item - clone and setup
        const el = templateEl.content.firstElementChild!.cloneNode(
          true,
        ) as Element;
        const itemSig = signal(item);
        const indexSig = signal(i);
        entry = { el, item: itemSig, index: indexSig };
        entries.set(k, entry);

        const cleanup = setup(
          el,
          () => itemSig(),
          () => indexSig(),
        );
        if (cleanup) entry.cleanup = cleanup;
      } else {
        // Existing item - update signals
        entry.item(item);
        entry.index(i);
      }

      // Position correctly in DOM
      if (prevEl) {
        if (entry.el.previousElementSibling !== prevEl) {
          prevEl.after(entry.el);
        }
      } else {
        if (entry.el !== container.firstElementChild) {
          container.prepend(entry.el);
        }
      }
      prevEl = entry.el;
    }
  });

  return () => {
    stopEffect();
    for (const entry of entries.values()) entry.cleanup?.();
    entries.clear();
  };
}
