!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\MDWord.Markdown" "" "Markdown document"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MDWord.Markdown\DefaultIcon" "" "$INSTDIR\resources\file-icon.ico"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MDWord.Markdown\shell" "" "open"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MDWord.Markdown\shell\open" "" "Open with MDWord"
  WriteRegStr SHELL_CONTEXT "Software\Classes\MDWord.Markdown\shell\open\command" "" '"$appExe" "%1"'
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities" "ApplicationName" "MDWord"
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities" "ApplicationDescription" "Write like Word. Save as Markdown."
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities" "ApplicationIcon" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\RegisteredApplications" "MDWord" "Software\MDWord\Capabilities"
  WriteRegStr SHELL_CONTEXT "Software\Classes\.md" "" "MDWord.Markdown"
  WriteRegNone SHELL_CONTEXT "Software\Classes\.md\OpenWithProgids" "MDWord.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities\FileAssociations" ".md" "MDWord.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\Classes\.markdown" "" "MDWord.Markdown"
  WriteRegNone SHELL_CONTEXT "Software\Classes\.markdown\OpenWithProgids" "MDWord.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities\FileAssociations" ".markdown" "MDWord.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\Classes\.mdown" "" "MDWord.Markdown"
  WriteRegNone SHELL_CONTEXT "Software\Classes\.mdown\OpenWithProgids" "MDWord.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities\FileAssociations" ".mdown" "MDWord.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\Classes\.mkd" "" "MDWord.Markdown"
  WriteRegNone SHELL_CONTEXT "Software\Classes\.mkd\OpenWithProgids" "MDWord.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities\FileAssociations" ".mkd" "MDWord.Markdown"
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend

!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "Software\Classes\MDWord.Markdown"
  DeleteRegKey SHELL_CONTEXT "Software\MDWord\Capabilities"
  DeleteRegValue SHELL_CONTEXT "Software\RegisteredApplications" "MDWord"
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend
