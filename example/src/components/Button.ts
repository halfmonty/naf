import { template, effect, Component } from "../../../naf";

export function Button(props: {
  text: string;
  onClick: () => void;
  className?: string;
  disabled?: () => boolean;
}): Component {
  return template({
    root: "button",
    onMount(el) {
      if (!el) return;
      el.addEventListener("click", props.onClick);

      if (props.disabled) {
        effect(() => {
          if (props.disabled!()) {
            el.setAttribute("disabled", "disabled");
          } else {
            el.removeAttribute("disabled");
          }
        });
      }
    },
  }) /*html*/ `
    <button class="${props.className || ""}">${props.text}</button>
  `;
}
