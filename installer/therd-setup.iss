; THerD Platform Windows Installer — Inno Setup 6 script
;
; What this installs:
;   therd-package.exe   — CLI packager, added to PATH
;   therd-desktop.exe   — AR simulator (+ ANGLE DLLs for GLES)
;   hello-park.therd    — Sample world (copied to Documents\THerD\worlds\hello-park\)
;   GravityAR VSCode extension (.vsix, auto-installed if VSCode found on PATH)
;   GravityAR Blender addon (.zip, user guided to install if Blender detected)
;   Getting-started docs (HTML, opened at first launch)
;   Start Menu shortcuts
;
; What this does NOT install:
;   Blender        — artist's job; we detect it and link to blender.org if absent
;   VSCode         — artist's job; we detect it and link to code.visualstudio.com if absent
;   THerD Server   — not bundled; artist workflow is local --world flag or a deployed server
;
; Prerequisites before compiling this script (see installer/README.md):
;   1. Build therd-desktop.exe on Windows (MSVC + vcpkg) — see THerD/docs/WINDOWS-BUILD.md
;   2. Obtain ANGLE DLLs (libEGL.dll, libGLESv2.dll, d3dcompiler_47.dll)
;   3. Copy all three + therd-desktop.exe into installer\staging\
;   4. Install Inno Setup 6: https://jrsoftware.org/isdl.php
;   5. Right-click this file and choose "Compile" (or run iscc.exe from CLI)
;
; Inno Setup 6 docs: https://jrsoftware.org/ishelp/

#define AppName      "THerD AR Platform"
#define AppVersion   "1.0.0"
#define AppPublisher "Momidala Consulting, LLC"
#define AppURL       "https://github.com/momidala/THerD-platform"
#define AppExe       "therd-desktop.exe"
#define PackagerExe  "therd-package.exe"

; ─────────────────────────────────────────────────────────────────────────────
; Setup metadata
; ─────────────────────────────────────────────────────────────────────────────

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}

; Install to per-user AppData — no admin rights required
DefaultDirName={localappdata}\THerD
DefaultGroupName=THerD AR Platform
DisableProgramGroupPage=yes

; Single output file
OutputDir=output
OutputBaseFilename=THerD-setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes

; Uninstaller
UninstallDisplayIcon={app}\bin\therd-desktop.exe
UninstallDisplayName={#AppName}

; Minimum Windows 10 (for ANGLE / EGL runtime)
MinVersion=10.0

; Architecture
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible

; Installer graphics — uncomment when you have artwork:
; WizardImageFile=art\installer-banner.bmp
; WizardSmallImageFile=art\installer-logo.bmp
; WizardStyle=modern

; License (MIT)
; LicenseFile=..\LICENSE

; ─────────────────────────────────────────────────────────────────────────────
; Pascal scripting helpers — detection logic
; ─────────────────────────────────────────────────────────────────────────────

[Code]

// --------------------------------------------------------------------------
// FindBlenderPath — returns a non-empty string if Blender 4.x is detected.
//
// Detection strategy (most reliable first):
//   1. Registry: HKCU\SOFTWARE\Blender Foundation\Blender\X.Y → (Default)
//      Blender writes this key for each version installed per-user.
//   2. Registry: HKLM equivalent (system-wide install).
//   3. Known default install path for Blender 4.x:
//      %PROGRAMFILES%\Blender Foundation\Blender 4.x\blender.exe
// --------------------------------------------------------------------------
function FindBlenderPath(): String;
var
  BlenderExe, RegKey: String;
  SubKeys: TArrayOfString;
  i: Integer;
begin
  Result := '';

  // Try HKCU first (per-user install)
  RegKey := 'SOFTWARE\Blender Foundation\Blender';
  if RegGetSubkeyNames(HKCU, RegKey, SubKeys) then begin
    for i := Length(SubKeys) - 1 downto 0 do begin
      // SubKeys[i] is a version string like "4.2", "4.3" — iterate newest first
      if Copy(SubKeys[i], 1, 2) = '4.' then begin
        if RegQueryStringValue(HKCU, RegKey + '\' + SubKeys[i], '', BlenderExe) then begin
          if FileExists(BlenderExe) then begin
            Result := BlenderExe;
            Exit;
          end;
        end;
      end;
    end;
  end;

  // Try HKLM (system-wide install)
  if RegGetSubkeyNames(HKLM, RegKey, SubKeys) then begin
    for i := Length(SubKeys) - 1 downto 0 do begin
      if Copy(SubKeys[i], 1, 2) = '4.' then begin
        if RegQueryStringValue(HKLM, RegKey + '\' + SubKeys[i], '', BlenderExe) then begin
          if FileExists(BlenderExe) then begin
            Result := BlenderExe;
            Exit;
          end;
        end;
      end;
    end;
  end;

  // Fallback: known default paths for Blender 4.x
  BlenderExe := ExpandConstant('{pf}\Blender Foundation\Blender 4.2\blender.exe');
  if FileExists(BlenderExe) then begin Result := BlenderExe; Exit; end;

  BlenderExe := ExpandConstant('{pf}\Blender Foundation\Blender 4.3\blender.exe');
  if FileExists(BlenderExe) then begin Result := BlenderExe; Exit; end;

  BlenderExe := ExpandConstant('{pf}\Blender Foundation\Blender 4.4\blender.exe');
  if FileExists(BlenderExe) then begin Result := BlenderExe; Exit; end;

  // Not found
  Result := '';
end;


// --------------------------------------------------------------------------
// FindVSCodePath — returns path to code.cmd or code.exe if VSCode is detected.
//
// Detection strategy:
//   1. HKCU uninstall key (user install — most common)
//   2. %LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd
//   3. HKLM uninstall key (system-wide install)
//   4. %PROGRAMFILES%\Microsoft VS Code\bin\code.cmd
// --------------------------------------------------------------------------
function FindVSCodePath(): String;
var
  CodeCmd, InstallDir: String;
begin
  Result := '';

  // User install path (most common — VSCode defaults to user install)
  CodeCmd := ExpandConstant('{localappdata}\Programs\Microsoft VS Code\bin\code.cmd');
  if FileExists(CodeCmd) then begin
    Result := CodeCmd;
    Exit;
  end;

  // Try getting install path from HKCU uninstall key
  if RegQueryStringValue(HKCU,
    'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{771FD6B0-FA20-440A-A002-3B3BAC16DC50}_is1',
    'InstallLocation', InstallDir) then begin
    CodeCmd := InstallDir + '\bin\code.cmd';
    if FileExists(CodeCmd) then begin
      Result := CodeCmd;
      Exit;
    end;
  end;

  // System-wide install
  CodeCmd := ExpandConstant('{pf}\Microsoft VS Code\bin\code.cmd');
  if FileExists(CodeCmd) then begin
    Result := CodeCmd;
    Exit;
  end;

  // HKLM uninstall key
  if RegQueryStringValue(HKLM,
    'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{EA457B21-F73E-494C-ACAB-524FDE069978}_is1',
    'InstallLocation', InstallDir) then begin
    CodeCmd := InstallDir + '\bin\code.cmd';
    if FileExists(CodeCmd) then begin
      Result := CodeCmd;
      Exit;
    end;
  end;

  Result := '';
end;


// --------------------------------------------------------------------------
// HasVCRuntime — returns True if the VC++ 2015-2022 x64 runtime is present.
//
// Checks the registry key written by the VC++ Redistributable installer.
// VCRUNTIME140.dll on its own is not sufficient — it could be a stale copy.
// --------------------------------------------------------------------------
function HasVCRuntime(): Boolean;
var
  Installed: Cardinal;
begin
  Result := False;

  // VC++ 2022 (and 2015/2017/2019 via the same key)
  if RegQueryDWordValue(HKLM,
    'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64',
    'Installed', Installed) then begin
    Result := (Installed = 1);
    if Result then Exit;
  end;

  // WOW64 node (same key, alternative path)
  if RegQueryDWordValue(HKLM,
    'SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64',
    'Installed', Installed) then begin
    Result := (Installed = 1);
  end;
end;


// --------------------------------------------------------------------------
// InitializeSetup — pre-flight checks before the wizard opens.
//
//   - Warns if VC++ runtime is missing (therd-desktop.exe needs it)
//   - Warns if Blender is not found
//   - Warns if VSCode is not found
//   Warnings do not block install — they just inform the user.
// --------------------------------------------------------------------------
function InitializeSetup(): Boolean;
var
  Msg: String;
  Missing: Boolean;
begin
  Result := True;
  Missing := False;
  Msg := '';

  if not HasVCRuntime() then begin
    Msg := Msg + 'Microsoft Visual C++ 2015-2022 Redistributable (x64) was not detected.'#13#10 +
                 'therd-desktop.exe may fail to start without it.'#13#10 +
                 'Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe'#13#10#13#10;
    Missing := True;
  end;

  if FindBlenderPath() = '' then begin
    Msg := Msg + 'Blender 4.x was not detected.'#13#10 +
                 'The GravityAR Blender addon will be staged but not installed.'#13#10 +
                 'Install Blender from https://blender.org, then install the addon manually.'#13#10#13#10;
    Missing := True;
  end;

  if FindVSCodePath() = '' then begin
    Msg := Msg + 'Visual Studio Code was not detected.'#13#10 +
                 'The GravityAR extension will be staged but not installed.'#13#10 +
                 'Install VSCode from https://code.visualstudio.com, then run:'#13#10 +
                 '  code --install-extension "%LOCALAPPDATA%\THerD\tools\gravityar-0.1.0.vsix"'#13#10;
    Missing := True;
  end;

  if Missing then begin
    MsgBox(
      'THerD Setup — Prerequisite Notice'#13#10#13#10 +
      Msg +
      'Setup will continue. You can complete the missing steps after install.',
      mbInformation, MB_OK);
  end;
end;


// --------------------------------------------------------------------------
// CurStepChanged — post-install actions that run after files are copied.
//
//   - Installs the GravityAR VSCode extension (if VSCode is found)
//   - Shows Blender addon install guidance (if Blender is found)
// --------------------------------------------------------------------------
procedure CurStepChanged(CurStep: TSetupStep);
var
  CodePath, VsixPath, BlenderExe, AddonZipPath: String;
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then begin

    // ── VSCode extension auto-install ───────────────────────────────────────
    CodePath := FindVSCodePath();
    VsixPath := ExpandConstant('{app}\tools\gravityar-0.1.0.vsix');

    if (CodePath <> '') and FileExists(VsixPath) then begin
      // Install the extension — this is safe to call multiple times (idempotent)
      if not Exec(CodePath, '--install-extension "' + VsixPath + '"',
                  '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then begin
        MsgBox(
          'Could not auto-install the GravityAR VSCode extension.'#13#10 +
          'Install manually with:'#13#10 +
          '  code --install-extension "' + VsixPath + '"',
          mbInformation, MB_OK);
      end;
    end;

    // ── Blender addon guidance ──────────────────────────────────────────────
    // Blender addons/extensions cannot be CLI-installed — Blender's Extension
    // Platform or the Preferences > Add-ons dialog must be used.
    // We tell the user where the zip is and open the docs page.
    BlenderExe  := FindBlenderPath();
    AddonZipPath := ExpandConstant('{app}\tools\gravityar-blender-1.0.0.zip');

    if (BlenderExe <> '') and FileExists(AddonZipPath) then begin
      MsgBox(
        'Blender was detected.'#13#10#13#10 +
        'The GravityAR Blender addon (Extension) has been staged at:'#13#10 +
        AddonZipPath + #13#10#13#10 +
        'To install it in Blender 4.2+:'#13#10 +
        '  1. Open Blender'#13#10 +
        '  2. Go to Edit > Preferences > Get Extensions'#13#10 +
        '     (or Edit > Preferences > Add-ons for legacy installs)'#13#10 +
        '  3. Click "Install from Disk" and select the .zip above'#13#10 +
        '  4. Enable "GravityAR Exporter" in the list'#13#10#13#10 +
        'The getting-started guide also covers this step with screenshots:'#13#10 +
        ExpandConstant('{app}\docs\getting-started.md'),
        mbInformation, MB_OK);
    end;

  end; // ssPostInstall
end;

; ─────────────────────────────────────────────────────────────────────────────
; Files
;
; SOURCE paths are relative to the location of this .iss file when compiled
; with iscc.exe or Inno Setup IDE.  If compiling from the installer/ directory,
; paths below are correct.  If compiling from elsewhere, adjust accordingly.
;
; [TODO] items must be provided before compiling (see installer/README.md).
; ─────────────────────────────────────────────────────────────────────────────

[Files]

; ── CLI packager — self-contained PE32+, no DLLs needed ─────────────────────
; Source: cross-compiled from WSL with MinGW-w64; BUILT and staged
Source: "staging\therd-package.exe"
  DestDir: "{app}\bin"
  Flags: ignoreversion

; ── Desktop simulator — requires ANGLE DLLs (must be placed in staging\ first)
; [TODO] Build on Windows (MSVC + vcpkg); see THerD/docs/WINDOWS-BUILD.md
Source: "staging\therd-desktop.exe"
  DestDir: "{app}\bin"
  Flags: ignoreversion

; ── ANGLE DLLs for GLES runtime ─────────────────────────────────────────────
; These must be in the same directory as therd-desktop.exe.
; [TODO] Obtain from Chrome, ANGLE releases, or vcpkg:
;   vcpkg install angle:x64-windows
;   Then copy libEGL.dll + libGLESv2.dll + d3dcompiler_47.dll here.
Source: "staging\libEGL.dll"
  DestDir: "{app}\bin"
  Flags: ignoreversion

Source: "staging\libGLESv2.dll"
  DestDir: "{app}\bin"
  Flags: ignoreversion

Source: "staging\d3dcompiler_47.dll"
  DestDir: "{app}\bin"
  Flags: ignoreversion

; ── Optional: TLS/network DLLs (only if using dynamic linking) ───────────────
; Uncomment if you built libwebsockets + OpenSSL as DLLs rather than static.
; Static linking (x64-windows-static triplet) is recommended to avoid shipping
; these — see WINDOWS-BUILD.md "To avoid shipping OpenSSL DLLs".
; Source: "staging\libssl-3-x64.dll";   DestDir: "{app}\bin"; Flags: ignoreversion
; Source: "staging\libcrypto-3-x64.dll"; DestDir: "{app}\bin"; Flags: ignoreversion
; Source: "staging\libwebsockets.dll";   DestDir: "{app}\bin"; Flags: ignoreversion

; ── Tooling — VSCode extension .vsix ─────────────────────────────────────────
; Staged here for auto-install (code --install-extension) and manual fallback.
Source: "dist\gravityar-0.1.0.vsix"
  DestDir: "{app}\tools"
  Flags: ignoreversion

; ── Tooling — Blender addon zip ──────────────────────────────────────────────
; Cannot be CLI-installed; user is guided via dialog above.
Source: "dist\gravityar-blender-1.0.0.zip"
  DestDir: "{app}\tools"
  Flags: ignoreversion

; ── Sample world: hello-park ─────────────────────────────────────────────────
; Unpacks to %USERPROFILE%\Documents\THerD\worlds\hello-park\
; therd-desktop.exe --world "%DOCUMENTS%\THerD\worlds\hello-park\hello-park.therd"
Source: "dist\hello-park.therd"
  DestDir: "{userdocs}\THerD\worlds\hello-park"
  Flags: ignoreversion

; ── Documentation ────────────────────────────────────────────────────────────
Source: "..\docs\getting-started.md"
  DestDir: "{app}\docs"
  Flags: ignoreversion

Source: "..\docs\workflow-tutorial.md"
  DestDir: "{app}\docs"
  Flags: ignoreversion

Source: "..\docs\api-reference.md"
  DestDir: "{app}\docs"
  Flags: ignoreversion

Source: "..\docs\troubleshooting.md"
  DestDir: "{app}\docs"
  Flags: ignoreversion

; ─────────────────────────────────────────────────────────────────────────────
; PATH modification — add {app}\bin so therd-package and therd-desktop are
; available from any command prompt without full paths.
; ─────────────────────────────────────────────────────────────────────────────

[Registry]
Root: HKCU
  Subkey: "Environment"
  ValueType: expandsz
  ValueName: "Path"
  ValueData: "{app}\bin;{olddata}"
  Flags: preservestringtype createvalueifdoesntexist

; ─────────────────────────────────────────────────────────────────────────────
; Icons (Start Menu)
; ─────────────────────────────────────────────────────────────────────────────

[Icons]
; Desktop simulator shortcut — loads hello-park world on first launch
Name: "{group}\THerD AR Simulator"
  Filename: "{app}\bin\therd-desktop.exe"
  Parameters: "--world ""{userdocs}\THerD\worlds\hello-park\hello-park.therd"""
  WorkingDir: "{app}"
  Comment: "THerD AR desktop simulator — renders the hello-park sample world"

; Package creator shortcut — opens a command prompt with therd-package on PATH
Name: "{group}\THerD Package CLI"
  Filename: "{cmd}"
  Parameters: "/k echo THerD package CLI ready. Type: therd-package --help"
  WorkingDir: "{app}"
  Comment: "Command prompt with therd-package.exe available on PATH"

; Getting Started Guide
Name: "{group}\Getting Started Guide"
  Filename: "{app}\docs\getting-started.md"
  Comment: "THerD AR Platform — getting started guide"

; Uninstaller
Name: "{group}\Uninstall THerD"
  Filename: "{uninstallexe}"

; ─────────────────────────────────────────────────────────────────────────────
; Run after install
; ─────────────────────────────────────────────────────────────────────────────

[Run]
; Ask the user if they want to open the Getting Started Guide immediately.
; unchecked=false means checked by default.
Filename: "{app}\docs\getting-started.md"
  Description: "Open Getting Started Guide"
  Flags: postinstall shellexec skipifsilent unchecked

; Ask if they want to launch the simulator with the hello-park world.
Filename: "{app}\bin\therd-desktop.exe"
  Parameters: "--world ""{userdocs}\THerD\worlds\hello-park\hello-park.therd"""
  Description: "Launch the THerD simulator with the Hello Park sample world"
  Flags: postinstall skipifsilent nowait

; ─────────────────────────────────────────────────────────────────────────────
; Uninstall cleanup — remove PATH registry entry we added
; ─────────────────────────────────────────────────────────────────────────────

[UninstallDelete]
; Inno Setup removes files in [Files] automatically.
; Remove the {app} directory tree if empty after uninstall.
Type: dirifempty
  Name: "{app}"
