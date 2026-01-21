import { template, Component } from "../../../naf";
import { Card } from "./Card";

export function Stats(props: {
  activeCount: number;
  totalCount: number;
}): Component {
  return Card({
    className: "stats",
    children: template`
      <div class="stats-content">
        <div class="stat">
          <strong>${props.activeCount}</strong>
          <span>${props.activeCount === 1 ? "task" : "tasks"} remaining</span>
        </div>
        <div class="stat">
          <strong>${props.totalCount}</strong>
          <span>total</span>
        </div>
      </div>
    `,
  });
}
