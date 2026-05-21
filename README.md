# Markdown Studio

Desktopowy edytor i podgląd Markdown dla Windows.  
Zbudowany na Electron 42 + React 19 + CodeMirror 6.

![Markdown Studio](https://img.shields.io/badge/version-0.1.0-blue) ![Platform](https://img.shields.io/badge/platform-Windows-lightgrey) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Funkcje

- **Edytor** — CodeMirror 6 z podświetlaniem składni Markdown
- **Podgląd na żywo** — renderowanie HTML obok edytora (MarkdownIt + highlight.js)
- **Zakładki** — otwórz wiele plików jednocześnie (Ctrl+T / Ctrl+W)
- **Eksport PDF** — z osadzonymi lokalnymi obrazkami
- **Eksport HTML** — samodzielny plik z wbudowanymi obrazkami jako base64
- **Autosave** — automatyczny zapis co 30 sekund dla otwartych plików
- **Historia plików** — szybki dostęp do ostatnio otwartych dokumentów
- **Przeciągnij i upuść** — otwieranie plików przez drag & drop
- **Ciemny / jasny motyw** — przełącznik w pasku narzędzi

## Pobieranie

Najnowsza wersja: **[Releases](https://github.com/zetmar-collab/markdown-studio/releases)**

| Plik | Opis |
|------|------|
| `Markdown-Studio-Setup-0.1.0.exe` | Instalator NSIS — wybór katalogu, skrót na pulpicie |
| `Markdown-Studio-Portable-0.1.0.exe` | Wersja przenośna — nie wymaga instalacji |

## Skróty klawiszowe

| Skrót | Akcja |
|-------|-------|
| `Ctrl+N` | Nowy dokument (nowa zakładka) |
| `Ctrl+O` | Otwórz plik |
| `Ctrl+S` | Zapisz |
| `Ctrl+Shift+S` | Zapisz jako |
| `Ctrl+T` | Nowa zakładka |
| `Ctrl+W` | Zamknij zakładkę |
| `Ctrl+P` | Eksportuj do PDF |
| `Ctrl+E` | Eksportuj do HTML |

## Uruchomienie z kodu źródłowego

**Wymagania:** Node.js 20+, npm 10+

```bash
git clone https://github.com/zetmar-collab/markdown-studio.git
cd markdown-studio
npm install
npm run dev
```

### Budowanie instalatora

```bash
# Generuj ikonę (tylko raz)
node scripts/make-icon.mjs

# Build + installer Windows
npm run dist
# → release/Markdown Studio Setup 0.1.0.exe
# → release/Markdown Studio 0.1.0.exe  (portable)
```

## Stos technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Shell | Electron 42 |
| UI | React 19 + TypeScript |
| Edytor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Markdown | MarkdownIt 14 + highlight.js 11 |
| Ikony UI | lucide-react |
| Bundler | Vite 7 |
| Installer | electron-builder 26 (NSIS) |

## Struktura projektu

```
src/
  main/
    main.ts          # Główny proces Electron (IPC, eksport, okno)
    preload.ts       # Bridge renderer ↔ main (contextBridge)
  renderer/
    App.tsx          # Główny komponent
    renderer-types.ts
    components/      # Toolbar, TabBar, FormatBar, StatusBar, ...
    hooks/
      useTabManager.ts   # Stan zakładek + autosave + dirty guard
      useFileManager.ts  # Stałe i helpers (SAMPLE_DOCUMENT)
  types/
    electron-api.d.ts    # Typy window.markdownStudio API
build/
  icon.png           # Ikona aplikacji (256×256)
scripts/
  make-icon.mjs      # Generator ikony (czysty Node.js, bez deps)
```

## Licencja

MIT © Marek Zettel
