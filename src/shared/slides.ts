/**
 * Splitting a document into slides.
 *
 * A horizontal rule on its own line is the convention every Markdown
 * presentation tool uses, so that is the separator here too. Two things must
 * not be mistaken for one: a rule inside a fenced code block, and the `---`
 * that closes YAML front matter at the very top of the file.
 */

export interface SlideSplit {
  slides: string[];
  /** Front matter, if the document opened with it; never shown as a slide. */
  frontMatter: string | null;
}

const RULE = /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

export function splitSlides(markdown: string): SlideSplit {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let start = 0;
  let frontMatter: string | null = null;

  // Front matter: "---" on the first line, closed by the next "---".
  if (lines[0] !== undefined && /^-{3,}\s*$/.test(lines[0])) {
    const close = lines.findIndex((line, index) => index > 0 && /^-{3,}\s*$/.test(line));
    if (close > 0) {
      frontMatter = lines.slice(1, close).join("\n");
      start = close + 1;
    }
  }

  const slides: string[] = [];
  let current: string[] = [];
  let fence: string | null = null;

  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceMatch = FENCE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      current.push(line);
      continue;
    }

    if (fence === null && RULE.test(line)) {
      slides.push(current.join("\n").trim());
      current = [];
      continue;
    }
    current.push(line);
  }
  slides.push(current.join("\n").trim());

  const kept = slides.filter((slide) => slide.length > 0);
  return { slides: kept.length > 0 ? kept : [""], frontMatter };
}

/** How many slides a document would produce. */
export function countSlides(markdown: string): number {
  return splitSlides(markdown).slides.length;
}
