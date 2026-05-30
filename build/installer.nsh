; Dodatkowe kroki instalatora NSIS (electron-builder)
!macro customInstall
  ; Rejestracja obsługi .md po instalacji (HKCU)
  WriteRegStr HKCU "Software\Classes\MarkdownStudio.md" "" "Markdown Studio"
  WriteRegStr HKCU "Software\Classes\MarkdownStudio.md\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\MarkdownStudio.md\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr HKCU "Software\Classes\.md" "" "MarkdownStudio.md"
  WriteRegStr HKCU "Software\Classes\.markdown" "" "MarkdownStudio.md"
  WriteRegStr HKCU "Software\Classes\.mdown" "" "MarkdownStudio.md"
  WriteRegStr HKCU "Software\Classes\.mkd" "" "MarkdownStudio.md"
!macroend
