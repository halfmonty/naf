import { signal, template, effect, Component } from "../../../naf";
import { Filter } from "./types";
import { Card } from "./Card";

export function FilterButtons(props: {
  currentFilter: ReturnType<typeof signal<Filter>>;
}): Component {
  return Card({
    children: template({
      root: ".filters",
      onMount(el) {
        if (!el) return;
        const buttons = el.querySelectorAll("button");

        buttons.forEach((btn) => {
          btn.addEventListener("click", () => {
            const filterValue = btn.getAttribute("data-filter") as Filter;
            props.currentFilter(filterValue);
          });
        });

        effect(() => {
          const current = props.currentFilter();
          buttons.forEach((btn) => {
            const filterValue = btn.getAttribute("data-filter");
            if (filterValue === current) {
              btn.classList.add("active");
            } else {
              btn.classList.remove("active");
            }
          });
        });
      },
    }) /*html*/ `
      <div class="filters">
        <button class="secondary" data-filter="all">All</button>
        <button class="secondary" data-filter="active">Active</button>
        <button class="secondary" data-filter="completed">Completed</button>
      </div>
    `,
  });
}
