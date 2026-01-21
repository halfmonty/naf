import { template, effect, Component } from "../../../naf";
import { Card } from "./Card";

export function Stats(props: {
  activeCount: () => number;
  totalCount: () => number;
}): Component {
  return Card({
    className: "stats",
    children: template({
      root: ".stats-content",
      onMount(el) {
        if (!el) return;
        const activeEl = el.querySelector(
          ".stat:first-child strong",
        ) as HTMLElement;
        const activeLabel = el.querySelector(
          ".stat:first-child span",
        ) as HTMLElement;
        const totalEl = el.querySelector(
          ".stat:last-child strong",
        ) as HTMLElement;

        effect(() => {
          const active = props.activeCount();
          activeEl.textContent = String(active);
          activeLabel.textContent =
            active === 1 ? "task remaining" : "tasks remaining";
        });

        effect(() => {
          totalEl.textContent = String(props.totalCount());
        });
      },
    })`
      <div class="stats-content">
        <div class="stat">
          <strong>0</strong>
          <span>tasks remaining</span>
        </div>
        <div class="stat">
          <strong>0</strong>
          <span>total</span>
        </div>
      </div>
    `,
  });
}
