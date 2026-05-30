declare module "markdown-it-task-lists" {
  import type MarkdownIt from "markdown-it";
  interface Options {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }
  function plugin(md: MarkdownIt, options?: Options): void;
  export default plugin;
}

declare module "markdown-it-anchor" {
  import type MarkdownIt from "markdown-it";
  interface Options {
    permalink?: boolean;
    tabIndex?: boolean;
  }
  function plugin(md: MarkdownIt, options?: Options): void;
  export default plugin;
}
