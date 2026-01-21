import { signal, template, effect, Component } from "../../../naf";
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
        const input = el.querySelector("input") as HTMLInputElement;
        const button = el.querySelector("button") as HTMLButtonElement;

        input.value = props.newTodoText();
        input.addEventListener("input", (e) => {
          props.newTodoText((e.target as HTMLInputElement).value);
        });

        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && props.newTodoText().trim()) {
            props.onAdd();
          }
        });

        button.addEventListener("click", () => {
          if (props.newTodoText().trim()) {
            props.onAdd();
          }
        });

        effect(() => {
          const isEmpty = !props.newTodoText().trim();
          if (isEmpty) {
            button.setAttribute("disabled", "disabled");
          } else {
            button.removeAttribute("disabled");
          }
        });
      },
    })`
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
