import { template, effect, $, Component } from "../../../naf";
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
        const activeEl = $<HTMLElement>(el, ".stat:first-child strong");
        const activeLabel = $<HTMLElement>(el, ".stat:first-child span");
        const totalEl = $<HTMLElement>(el, ".stat:last-child strong");

        effect(() => {
          if (!activeEl || !activeLabel) return;
          const active = props.activeCount();
          activeEl.textContent = String(active);
          activeLabel.textContent =
            active === 1 ? "task remaining" : "tasks remaining";
        });

        effect(() => {
          if (!totalEl) return;
          totalEl.textContent = String(props.totalCount());
        });
      },
    }) /*html*/ `
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
