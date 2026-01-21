import { template, Component } from "../../../naf";
import { Nav } from "./Nav";

export function Layout(props: { children: Component }): Component {
  return template`
    <div class="layout">
      ${Nav()}
      <main>
        ${props.children}
      </main>
    </div>
  `;
}
