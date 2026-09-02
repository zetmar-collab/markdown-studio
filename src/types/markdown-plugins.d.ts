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

declare module "markdown-it-footnote" {
  import type MarkdownIt from "markdown-it";
  function plugin(md: MarkdownIt): void;
  export default plugin;
}

declare module "markdown-it-deflist" {
  import type MarkdownIt from "markdown-it";
  function plugin(md: MarkdownIt): void;
  export default plugin;
}

declare module "markdown-it-container" {
  import type MarkdownIt from "markdown-it";
  import type Token from "markdown-it/lib/token.mjs";
  interface ContainerOptions {
    validate?: (params: string) => boolean;
    render?: (tokens: Token[], index: number) => string;
    marker?: string;
  }
  function plugin(md: MarkdownIt, name: string, options?: ContainerOptions): void;
  export default plugin;
}

declare module "@vscode/markdown-it-katex" {
  import type MarkdownIt from "markdown-it";
  interface KatexOptions {
    output?: "html" | "mathml" | "htmlAndMathml";
    throwOnError?: boolean;
    errorColor?: string;
    enableFencedBlocks?: boolean;
  }
  function plugin(md: MarkdownIt, options?: KatexOptions): void;
  export default plugin;
}
