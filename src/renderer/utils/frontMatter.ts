const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Removes YAML front matter block for preview/export. Editor keeps full source. */
export function stripFrontMatter(content: string): string {
  return content.replace(FRONT_MATTER_RE, "");
}

export function hasFrontMatter(content: string): boolean {
  return FRONT_MATTER_RE.test(content);
}
