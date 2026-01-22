import { signal, template, effect, $, $on, Component } from "../../../naf";
import { Card } from "./Card";

export function AddTodoForm(props: {
  newTodoText: ReturnType<typeof signal<string>>;
  onAdd: () => void;
}): Component {
  return Card({
    children: template({
      root: ".add-todo-form",
      onMount(el) {
        if (!el) return;
        const input = $<HTMLInputElement>(el, "input");
        const button = $<HTMLButtonElement>(el, "button");

        if (input) input.value = props.newTodoText();

        $on(el, "input", "input", (e) => {
          props.newTodoText((e.target as HTMLInputElement).value);
        });

        $on(el, "input", "keydown", (e) => {
          if (
            (e as KeyboardEvent).key === "Enter" &&
            props.newTodoText().trim()
          ) {
            props.onAdd();
          }
        });

        $on(el, "button", "click", () => {
          if (props.newTodoText().trim()) {
            props.onAdd();
          }
        });

        effect(() => {
          if (!button) return;
          const isEmpty = !props.newTodoText().trim();
          if (isEmpty) {
            button.setAttribute("disabled", "disabled");
          } else {
            button.removeAttribute("disabled");
          }
        });
      },
    }) /*html*/ `
      <div class="add-todo-form">
        <input
          type="text"
          placeholder="What needs to be done?"
          autofocus
        />
        <button>Add</button>
      </div>
    `,
  });
}
