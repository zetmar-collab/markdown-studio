# Studio Markdown

Desktopowy edytor i podgląd Markdown dla Windows.  
Zbudowany na Electron 42 + React 19 + CodeMirror 6.

[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-pobierz-0067b8?logo=microsoftstore&logoColor=white)](https://apps.microsoft.com/detail/9NTCFXN0QDC3) ![Platform](https://img.shields.io/badge/platform-Windows-lightgrey) ![License](https://img.shields.io/badge/license-MIT-green)

**Repozytorium:** [github.com/zetmar-collab/markdown-studio](https://github.com/zetmar-collab/markdown-studio)

---

## Pobieranie (Windows)

### Microsoft Store — zalecane

**[Zainstaluj Studio Markdown ze sklepu](https://apps.microsoft.com/detail/9NTCFXN0QDC3)**

Aktualizacje przychodzą automatycznie, skojarzenia plików `.md` rejestruje sam pakiet.

### Instalator i wersja przenośna

| Plik | Opis |
|------|------|
| `Studio-Markdown-*-Setup-x64.exe` | Instalator NSIS (wybór folderu, skróty, rejestracja `.md`) |
| `Studio-Markdown-*-Portable-x64.exe` | Wersja przenośna (bez instalacji) |

Pliki są w [Releases](https://github.com/zetmar-collab/markdown-studio/releases) po utworzeniu tagu.

Po instalacji: **Plik → Ustaw jako domyślny edytor .md…** — program zarejestruje obsługę plików i otworzy ustawienia Windows, żeby potwierdzić domyślną aplikację.

Wersja instalowana sprawdza aktualizacje przy starcie (można wyłączyć w Ustawieniach). Wersja portable nie aktualizuje się sama.

---

## Funkcje

### Edycja
- Edytor + podgląd na żywo (GFM, front matter, kotwice nagłówków)
- Automatyczna kontynuacja list, list zadań i cytatów przy Enter
- Wklejanie HTML jako Markdown (nagłówki, listy, tabele, linki)
- Wklejanie obrazu ze schowka — zapis do `assets/` obok dokumentu
- Znajdź/zamień z obsługą wyrażeń regularnych i wielkości liter
- Sprawdzanie pisowni z podpowiedziami w menu kontekstowym (domyślnie `pl-PL`)
- Zakładki, sesja po restarcie, autozapis (konfigurowalny)
- Lista 10 ostatnio otwartych plików w menu **Plik → Ostatnio otwarte**
  (przeżywa restart, martwe wpisy znikają same)

### Podgląd
- Diagramy **Mermaid**
- Wzory matematyczne **KaTeX** (wyjście MathML — działa też w eksporcie i DOCX)
- Przypisy, listy definicji, bloki `::: note | tip | warning | danger`
- Panel konspektu (spis nagłówków) i panel plików (drzewo folderu)
- Synchronizacja przewijania oparta na numerach linii źródła
- Kliknięcie w podglądzie przenosi kursor do odpowiedniej linii w edytorze
- Tryb skupienia (F11)

### Wyjście
- Eksport **PDF**, **HTML**, **DOCX** — z ustawieniami formatu strony, marginesów,
  orientacji, nagłówka, stopki i numeracji stron
- Podgląd wydruku w osobnym oknie
- Kopiowanie podglądu do schowka z formatowaniem
- Jeden motyw kolorów dla podglądu, schowka i eksportu (`src/shared/documentTheme.ts`)

### Interfejs
- Języki: **polski** i **angielski** (menu Język lub Ustawienia)
- Motyw jasny i ciemny
- Konfigurowalny rozmiar czcionki edytora i podglądu
- Szukaj w folderze (`Ctrl+Shift+F`), z regexem

Ustawienia zapisują się w `%APPDATA%/markdown-studio/settings.json`, sesja zakładek
w `session.json`, a lista ostatnich plików w `recent.json`.

> Nazwa katalogu danych (`markdown-studio`) i `build.appId` (`pl.marek.markdownstudio`)
> celowo zostały bez zmian mimo zmiany nazwy produktu: pierwsza decyduje o tym, gdzie
> leżą ustawienia istniejących instalacji, druga o ścieżce aktualizacji instalatora NSIS.
> Żadna z nich nie jest widoczna dla użytkownika ani istotna dla certyfikacji w sklepie.

## Skróty

| Skrót | Akcja |
|-------|--------|
| `Ctrl+N` / `Ctrl+T` | Nowy dokument |
| `Ctrl+O` | Otwórz |
| `Ctrl+S` / `Ctrl+Shift+S` | Zapisz / Zapisz jako |
| `Ctrl+W` | Zamknij kartę |
| `Ctrl+B` / `Ctrl+I` | Pogrubienie / kursywa |
| `Ctrl+Shift+F` | Szukaj w folderze |
| `Ctrl+P` / `Ctrl+E` | Eksport PDF / HTML |
| `Ctrl+Shift+E` | Eksport DOCX |
| `Ctrl+Shift+P` | Podgląd wydruku |
| `Ctrl+,` | Ustawienia |
| `F11` | Tryb skupienia (`Esc` wychodzi) |

## Dla deweloperów

```bash
npm install
npm run dev
```

DevTools (opcjonalnie):

```powershell
$env:ELECTRON_DEVTOOLS="1"; npm run dev
```

### Kontrola jakości

```bash
npm run typecheck    # tsc dla renderera i procesu głównego
npm run lint         # ESLint (z react-hooks)
npm run format       # Prettier
npm test             # Vitest
```

CI uruchamia wszystkie cztery plus pełny build.

### Architektura

| Katalog | Zawartość |
|---------|-----------|
| `src/main` | Proces główny: okna, IPC, eksport, wyszukiwanie, ustawienia, sesja, aktualizacje |
| `src/renderer` | Interfejs React: komponenty, hooki, narzędzia |
| `src/shared` | Kod wspólny dla obu procesów: motyw, i18n, ustawienia, slugi, schemat sesji |

Obrazy w podglądzie są serwowane przez własny protokół `md-asset://` (`src/shared/assetProtocol.ts`);
kodowanie base64 jest używane wyłącznie przy eksporcie, gdzie plik musi być samodzielny.

### Build lokalny

```bash
npm run dist          # to samo co dist:all (setup + portable)
npm run dist:all      # instalator + portable → out/pack/
npm run dist:setup    # tylko instalator NSIS
npm run dist:portable # tylko wersja portable
```

Przed buildem skrypt zamyka Studio Markdown i czyści `out/pack/win-unpacked`. Jeśli build padnie na `app.asar` — zamknij program i Eksplorator w `out/pack/`, potem powtórz komendę.

### Release na GitHub

```bash
git tag v0.3.1
git push origin v0.3.1
```

Workflow `.github/workflows/release.yml` zbuduje instalatory i dołączy je do GitHub Release.
Numer wersji pochodzi wyłącznie z `package.json` — interfejs czyta go przez `__APP_VERSION__`,
a proces główny przez `app.getVersion()`.

---

## Microsoft Store

Opublikowana: **[apps.microsoft.com/detail/9NTCFXN0QDC3](https://apps.microsoft.com/detail/9NTCFXN0QDC3)**

Store ID `9NTCFXN0QDC3`

| Wartość | |
|---|---|
| Package/Identity/Name | `MarekZettel-zetmar.StudioMarkdown` |
| Package/Identity/Publisher | `CN=15A53D32-C868-48EE-B700-5DBB5449CA1B` |
| PublisherDisplayName | `Marek Zettel - zetmar` |
| Package Family Name | `MarekZettel-zetmar.StudioMarkdown_411qrz2m02jw4` |

Konfiguracja pakietu jest w `package.json` → `build.appx`.

### Budowanie

```bash
npm run dist:store        # niepodpisany .appx do Partner Center
npm run dist:store-test   # .appx podpisany lokalnym certyfikatem (do testów)
npm run dist:store-all    # oba naraz
```

Pliki trafiają do `out/store/`. Pakiet AppX jest budowany **raz** i kopiowany, więc
wersja testowa różni się od wysyłanej wyłącznie podpisem.

- **Pakiet do sklepu jest celowo niepodpisany** — Partner Center podpisuje zgłoszenia
  certyfikatem wydawcy. Pakiet podpisany samodzielnie zostałby odrzucony.
- **Pakiet testowy** jest podpisywany `signtool.exe` z Windows SDK, algorytmem SHA-256
  (AppX przyjmuje dokładnie jeden podpis; `signtool` electron-buildera podpisuje
  podwójnie i kończy się błędem *„A required function is not present"*).
  Certyfikat jest wyszukiwany po `CN` w `Cert:\CurrentUser\My`; można go wskazać
  zmienną `MS_CERT_SHA1`.

### Instalacja pakietu testowego

```powershell
Add-AppxPackage -Path .\out\store\StudioMarkdown-0.3.0-test-signed.appx
```

Certyfikat musi być zaufany (`Cert:\LocalMachine\TrustedPeople`). Odinstalowanie:

```powershell
Get-AppxPackage -Name MarekZettel-zetmar.StudioMarkdown | Remove-AppxPackage
```

### Publikacja przez API

Zamiast klikać w Partner Center, całe zgłoszenie można wysłać jednym poleceniem:

```bash
npm run dist:store                  # zbuduj pakiet dla bieżącej wersji
npm run store:publish               # utwórz zgłoszenie i wgraj pakiet
npm run store:publish -- --submit   # to samo + wyślij do certyfikacji
```

Bez `--submit` skrypt zatrzymuje się po wgraniu pakietu i zapisaniu notatek —
zostawia wersję roboczą do przejrzenia. Wysłanie do certyfikacji jest publiczne
i praktycznie nieodwracalne, więc nigdy nie dzieje się przy okazji builda.

Notatki wydania (na język) są w [`store/release-notes.json`](store/release-notes.json).
Skrypt oczyszcza poprzednie pakiety zgłoszenia i wgrywa `.appx` dla wersji
z `package.json`.

**Konfiguracja (jednorazowa).** API wymaga aplikacji Azure AD powiązanej z kontem
w Partner Center:

1. Partner Center → **Account settings → User management → Azure AD applications**
   → dodaj aplikację i przypisz jej rolę **Manager**.
2. W aplikacji utwórz **klucz (client secret)** i zanotuj go od razu — później
   nie da się go odczytać.
3. Ustaw zmienne środowiskowe:

```powershell
$env:PARTNER_TENANT_ID     = "<Tenant ID>"
$env:PARTNER_CLIENT_ID     = "<Client ID>"
$env:PARTNER_CLIENT_SECRET = "<Client secret>"
```

Sekretów nie trzymaj w repozytorium. W GitHub Actions wstaw je jako repository
secrets i przekaż do kroku uruchamiającego `npm run store:publish`.

Pakiet jest pakowany do ZIP-a **bez kompresji** — `.appx` jest już skompresowany,
więc 190 MB pakuje się w ułamek sekundy zamiast kilku minut. Wysyłka do Azure
Blob idzie blokami po 8 MB, z postępem i możliwością ponowienia pojedynczego
bloku zamiast całego archiwum.

### Czym wersja ze sklepu różni się od instalatora

Microsoft nie dopuszcza instalowania czegokolwiek spoza pakietu, więc wszystko,
co wcześniej robił instalator NSIS, jest zadeklarowane w manifeście:

| Funkcja | NSIS / portable | Microsoft Store |
|---|---|---|
| Skojarzenia `.md`, `.markdown`, `.mdown`, `.mkd` | zapis do rejestru (`reg.exe`) | `windows.fileTypeAssociation` w manifeście |
| Aktualizacje | `electron-updater` z GitHub Releases | wyłączone — aktualizuje sklep |
| „Ustaw jako domyślny edytor .md" | rejestruje typy i otwiera ustawienia | tylko otwiera ustawienia Windows |
| Skróty, ikony, kafle | instalator NSIS | manifest + `build/appx/` |

Przełącznik jest runtime'owy: `process.windowsStore` (`src/main/runtimeTarget.ts`),
więc jedna baza kodu obsługuje oba warianty.

### Kafle i ikony

```bash
npm run icon
```

Generuje `build/icon.*`, `public/app-icon.png` oraz komplet 26 kafli w `build/appx/`
(StoreLogo, Square44/71/150/310, Wide310x150, SplashScreen, BadgeLogo + warianty
`scale-200` i `targetsize`). Bez tego electron-builder podstawiłby własne przykładowe
grafiki, co nie przeszłoby certyfikacji.


## Licencja

MIT © Marek Zettel
