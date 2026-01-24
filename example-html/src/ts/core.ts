/**
 * Core shared logic for the NAF-HTML example app.
 * Re-exports naf-html utilities and defines shared types.
 */

// Re-export everything from naf-html for convenience
export {
  signal,
  computed,
  effect,
  $,
  $$,
  $on,
  text,
  setText,
  toggleClass,
  attr,
  model,
  bind,
  list,
} from "../../../naf-html";

export type { Signal, Computed, Binding } from "../../../naf-html";

// Shared types
export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export type Filter = "all" | "active" | "completed";
