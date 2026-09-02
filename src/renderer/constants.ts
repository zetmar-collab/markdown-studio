import type { Language, TranslationKey } from "../shared/i18n";

/** Injected by Vite from package.json (see vite.config.ts). */
export const APP_VERSION: string = __APP_VERSION__;

export const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdown", "mkd"] as const;

export const MAX_RECENT_FILES = 10;

/** Words per minute used for the reading-time estimate. */
export const READING_WORDS_PER_MINUTE = 200;

/** How long to wait after the last keystroke before re-rendering the preview. */
export const PREVIEW_DEBOUNCE_MS = 150;

interface DocumentTemplate {
  labelKey: TranslationKey;
  content: Record<Language, string>;
}

export const DOCUMENT_TEMPLATES = {
  blank: {
    labelKey: "template.blank",
    content: { pl: "", en: "" }
  },
  meeting: {
    labelKey: "template.meeting",
    content: {
      pl: `# Spotkanie

**Data:**

## Uczestnicy

-

## Ustalenia

-

## Następne kroki

-
`,
      en: `# Meeting

**Date:**

## Attendees

-

## Decisions

-

## Next steps

-
`
    }
  },
  article: {
    labelKey: "template.article",
    content: {
      pl: `# Tytuł

## Wstęp



## Główna treść



## Podsumowanie


`,
      en: `# Title

## Introduction



## Body



## Summary


`
    }
  },
  project: {
    labelKey: "template.project",
    content: {
      pl: `# Nazwa projektu

## Cel

## Architektura

## Instalacja

\`\`\`bash
# komendy
\`\`\`

## Użycie

## FAQ

`,
      en: `# Project name

## Goal

## Architecture

## Installation

\`\`\`bash
# commands
\`\`\`

## Usage

## FAQ

`
    }
  }
} as const satisfies Record<string, DocumentTemplate>;

export type DocumentTemplateId = keyof typeof DOCUMENT_TEMPLATES;

export function templateContent(id: DocumentTemplateId, language: Language): string {
  return DOCUMENT_TEMPLATES[id].content[language] ?? DOCUMENT_TEMPLATES[id].content.pl;
}
