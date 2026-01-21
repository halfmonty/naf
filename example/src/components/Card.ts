import { template, Component } from "../../../naf";

export function Card(props: {
  children: Component;
  className?: string;
}): Component {
  return template`
    <div class="card ${props.className || ""}">${props.children}</div>
  `;
}
