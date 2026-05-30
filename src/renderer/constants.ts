export const APP_VERSION = "0.2.1";

export const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdown", "mkd"] as const;

export const RECENT_FILES_KEY = "recentFiles";
export const SESSION_STORAGE_KEY = "tabSession";
export const AUTOSAVE_INTERVAL_MS = 30_000;
export const MAX_RECENT_FILES = 10;

export const DOCUMENT_TEMPLATES = {
  blank: {
    label: "Pusty dokument",
    content: ""
  },
  meeting: {
    label: "Notatka ze spotkania",
    content: `# Spotkanie

**Data:** 

## Uczestnicy

- 

## Ustalenia

- 

## Następne kroki

- 
`
  },
  article: {
    label: "Artykuł / wpis",
    content: `# Tytuł

## Wstęp



## Główna treść



## Podsumowanie


`
  },
  project: {
    label: "Dokumentacja projektu",
    content: `# Nazwa projektu

## Cel

## Architektura

## Instalacja

\`\`\`bash
# komendy
\`\`\`

## Użycie

## FAQ

`
  }
} as const;

export type DocumentTemplateId = keyof typeof DOCUMENT_TEMPLATES;
