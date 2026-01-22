import { template, text, $on, Component } from "../../../naf";
import { Todo } from "./types";

export function TodoItem(props: {
  todo: Todo;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}): Component {
  return template({
    root: `[data-id="${props.todo.id}"]`,
    onMount(el) {
      if (!el) return;

      $on(el, 'input[type="checkbox"]', "change", () =>
        props.onToggle(props.todo.id),
      );
      $on(el, ".delete-btn", "click", () => props.onDelete(props.todo.id));
    },
  }) /*html*/ `
    <div class="todo-item ${props.todo.done ? "done" : ""}" data-id="${props.todo.id}">
      <input type="checkbox" ${props.todo.done ? "checked" : ""} />
      <span class="todo-text">${text(props.todo.text)}</span>
      <button class="danger delete-btn">Delete</button>
    </div>
  `;
}
