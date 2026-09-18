!include "LogicLib.nsh"

Var AssociateMdCheckbox
Var AssociateMd

!macro customInit
  StrCpy $AssociateMd 1
!macroend

!ifndef BUILD_UNINSTALLER
!include "nsDialogs.nsh"

Function mdwordAssocPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 36u "Register MDWord as a Markdown editor so Explorer can open .md, .markdown, .mdown, and .mkd files with this app."
  Pop $0
  ${NSD_CreateCheckbox} 0 48u 100% 12u "Use MDWord as the default app for .md files"
  Pop $AssociateMdCheckbox
  ${NSD_SetState} $AssociateMdCheckbox $AssociateMd
  nsDialogs::Show
FunctionEnd

Function mdwordAssocPageLeave
  ${NSD_GetState} $AssociateMdCheckbox $AssociateMd
FunctionEnd
!endif

!macro customPageAfterChangeDir
  Page custom mdwordAssocPage mdwordAssocPageLeave
!macroend

!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities" "ApplicationName" "MDWord"
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities" "ApplicationDescription" "Write like Word. Save as Markdown."
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities" "ApplicationIcon" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities\FileAssociations" ".md" "MDWord.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities\FileAssociations" ".markdown" "MDWord.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities\FileAssociations" ".mdown" "MDWord.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\MDWord\Capabilities\FileAssociations" ".mkd" "MDWord.Markdown"
  WriteRegStr SHELL_CONTEXT "Software\RegisteredApplications" "MDWord" "Software\MDWord\Capabilities"
  ${If} $AssociateMd == 1
    WriteRegStr SHELL_CONTEXT "Software\Classes\.md" "" "MDWord.Markdown"
    WriteRegStr SHELL_CONTEXT "Software\Classes\.markdown" "" "MDWord.Markdown"
    WriteRegStr SHELL_CONTEXT "Software\Classes\.mdown" "" "MDWord.Markdown"
    WriteRegStr SHELL_CONTEXT "Software\Classes\.mkd" "" "MDWord.Markdown"
  ${Else}
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.md" ""
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.markdown" ""
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.mdown" ""
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.mkd" ""
  ${EndIf}
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend

!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "Software\MDWord\Capabilities"
  DeleteRegValue SHELL_CONTEXT "Software\RegisteredApplications" "MDWord"
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend
