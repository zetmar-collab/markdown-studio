# Markdown Studio

Desktopowy edytor i podgląd Markdown dla Windows.  
Zbudowany na Electron 42 + React 19 + CodeMirror 6.

![Markdown Studio](https://img.shields.io/badge/version-0.2.1-blue) ![Platform](https://img.shields.io/badge/platform-Windows-lightgrey) ![License](https://img.shields.io/badge/license-MIT-green)

**Repozytorium:** [github.com/zetmar-collab/markdown-studio](https://github.com/zetmar-collab/markdown-studio)

---

## Pobieranie (Windows)

| Plik | Opis |
|------|------|
| `Markdown-Studio-*-Setup-x64.exe` | Instalator NSIS (wybór folderu, skróty, rejestracja `.md`) |
| `Markdown-Studio-*-Portable-x64.exe` | Wersja przenośna (bez instalacji) |

Pliki są w [Releases](https://github.com/zetmar-collab/markdown-studio/releases) po utworzeniu tagu `v0.2.0` (lub nowszego).

Po instalacji: **Plik → Ustaw jako domyślny edytor .md…** — program zarejestruje obsługę plików i otworzy ustawienia Windows, żeby potwierdzić domyślną aplikację.

---

## Funkcje (0.2.0)

- Edytor + podgląd na żywo (GFM, front matter, kotwice nagłówków)
- Zakładki, sesja po restarcie, autosave
- Eksport **PDF**, **HTML**, **DOCX**
- Podgląd wydruku w osobnym oknie
- Szukaj w folderze (`Ctrl+Shift+F`)
- Szablony dokumentów
- Własna ikona aplikacji
- Jeden motyw kolorów: podgląd, schowek, eksport (`src/shared/documentTheme.ts`)

## Ikona

```bash
npm run icon
```

Generuje `build/icon.png`, `build/icon.ico` i `public/app-icon.png`.

## Skróty

| Skrót | Akcja |
|-------|--------|
| `Ctrl+Shift+F` | Szukaj w folderze |
| `Ctrl+Shift+E` | Eksport DOCX |
| `Ctrl+Shift+P` | Podgląd wydruku |
| `Ctrl+P` / `Ctrl+E` | PDF / HTML |

## Dla deweloperów

```bash
npm install
npm run dev
```

DevTools (opcjonalnie):

```powershell
$env:ELECTRON_DEVTOOLS="1"; npm run dev
```

### Build lokalny

```bash
npm run dist          # to samo co dist:all (setup + portable)
npm run dist:all      # instalator + portable → out/pack/
npm run dist:setup    # tylko instalator NSIS
npm run dist:portable # tylko wersja portable
```

Przed buildem skrypt zamyka Markdown Studio i czyści `out/pack/win-unpacked`. Jeśli build padnie na `app.asar` — zamknij program i Eksplorator w `out/pack/`, potem powtórz komendę.

### Release na GitHub

```bash
git tag v0.2.1
git push origin v0.2.1
```

Workflow `.github/workflows/release.yml` zbuduje instalatory i dołączy je do GitHub Release.

## Licencja

MIT © Marek Zettel
