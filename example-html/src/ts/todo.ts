/**
 * Todo page - reactive todo list with filtering.
 */

import {
  signal,
  computed,
  $,
  $$,
  $on,
  setText,
  toggleClass,
  attr,
  list,
  type Todo,
  type Filter,
} from "./core";

// State
const todos = signal<Todo[]>([
  { id: 1, text: "Learn NAF-HTML", done: false },
  { id: 2, text: "Read the docs", done: true },
]);
const filter = signal<Filter>("all");
const newText = signal("");

// Computed values
const filteredTodos = computed(() => {
  const all = todos();
  const f = filter();
  if (f === "active") return all.filter((t) => !t.done);
  if (f === "completed") return all.filter((t) => t.done);
  return all;
});

const activeCount = computed(() => todos().filter((t) => !t.done).length);

// Clear server-rendered placeholder items (they were for no-JS fallback)
$$(".todo-item").forEach((el) => el.remove());

// Bind stats
setText($(".active-count"), activeCount);
setText($(".active-label"), () =>
  activeCount() === 1 ? "item remaining" : "items remaining"
);

// Bind form
const form = $<HTMLFormElement>(".add-todo-form")!;
const input = $<HTMLInputElement>('input[name="text"]', form)!;
const submitBtn = $<HTMLButtonElement>("button", form)!;

input.addEventListener("input", () => newText(input.value));
attr(submitBtn, "disabled", () => !newText().trim());

$on(form, "submit", (e) => {
  e.preventDefault();
  const text = newText().trim();
  if (text) {
    todos([...todos(), { id: Date.now(), text, done: false }]);
    newText("");
    input.value = "";
    input.focus();
  }
});

// Bind filter buttons
$$<HTMLButtonElement>(".filters button").forEach((btn) => {
  const filterValue = btn.dataset.filter as Filter;

  $on(btn, "click", () => filter(filterValue));
  toggleClass(btn, "active", () => filter() === filterValue);
});

// Bind todo list
list(
  $(".todo-list"),
  $<HTMLTemplateElement>("#todo-tpl"),
  filteredTodos,
  (t) => t.id,
  (el, item) => {
    const c1 = setText($(".todo-text", el), () => item().text);
    const c2 = toggleClass(el, "done", () => item().done);

    const checkbox = $<HTMLInputElement>('input[type="checkbox"]', el)!;
    checkbox.checked = item().done;
    checkbox.addEventListener("change", () => {
      todos(
        todos().map((t) =>
          t.id === item().id ? { ...t, done: checkbox.checked } : t
        )
      );
    });

    $on($(".danger", el)!, "click", () => {
      todos(todos().filter((t) => t.id !== item().id));
    });

    return () => {
      c1();
      c2();
    };
  }
);

console.log("NAF-HTML todo page loaded");
