# THerD Windows Installer — Staging Kit

**Phase 27.7-02 staging kit** — assembled in WSL2, ready for Windows-side completion.

This directory has everything the installer needs EXCEPT the Windows-only artifacts
that cannot be built from WSL. Your remaining steps are enumerated in order below.

---

## What is already staged (WSL-built)

| File | Status | Notes |
|---|---|---|
| `staging/therd-package.exe` | **BUILT** | PE32+, MinGW cross-compile; no extra DLLs |
| `dist/gravityar-0.1.0.vsix` | **BUILT** | Phase 27 + 27.5 APIs; shared/ included; 604 KB |
| `dist/gravityar-blender-1.0.0.zip` | **BUILT** | Blender 4.2+ Extension format; all Phase 26.8 occlusion changes |
| `dist/hello-park.therd` | **BUILT** | Packaged by Linux therd-package; script compiled to bytecode; 1219 bytes |
| `worlds/hello-park/` | **SOURCE** | World source (manifest + .grav) for reference / re-packaging |
| `therd-setup.iss` | **WRITTEN** | Inno Setup 6 script; ready to compile after step 4 below |

---

## Your remaining Windows-side steps

### Step 1 — Build `therd-desktop.exe`

Open an **x64 Native Tools Command Prompt for VS 2022** (Start → Visual Studio 2022 → "x64 Native Tools Command Prompt").

```bat
:: Prereqs (one-time setup if not done):
git clone https://github.com/microsoft/vcpkg C:\vcpkg
C:\vcpkg\bootstrap-vcpkg.bat
C:\vcpkg\vcpkg install glfw3:x64-windows openssl:x64-windows pthreads:x64-windows

:: Build
cd C:\path\to\THerD-platform\THerD
cmake -B build_win ^
  -DTHERD_PLATFORM_DESKTOP=ON ^
  -DCMAKE_TOOLCHAIN_FILE=C:\vcpkg\scripts\buildsystems\vcpkg.cmake ^
  -DVCPKG_TARGET_TRIPLET=x64-windows
cmake --build build_win --config Release

:: Result:
build_win\Release\therd-desktop.exe
```

Full instructions: `THerD/docs/WINDOWS-BUILD.md` — "Windows-Native Build Instructions" section.

**Recommended: static linking to avoid shipping OpenSSL DLLs:**
```bat
C:\vcpkg\vcpkg install glfw3:x64-windows-static openssl:x64-windows-static pthreads:x64-windows-static
cmake -B build_win ^
  -DTHERD_PLATFORM_DESKTOP=ON ^
  -DCMAKE_TOOLCHAIN_FILE=C:\vcpkg\scripts\buildsystems\vcpkg.cmake ^
  -DVCPKG_TARGET_TRIPLET=x64-windows-static ^
  -DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded
```
With static linking the OpenSSL DLL lines in `therd-setup.iss` can remain commented out.

### Step 2 — Obtain ANGLE DLLs

ANGLE provides OpenGL ES on Windows (required by therd-desktop.exe for rendering).

**Easiest option (copy from Chrome):**
```bat
:: Chrome must be installed. Adjust path for your Chrome version number.
copy "C:\Program Files\Google\Chrome\Application\<version>\libEGL.dll" staging\
copy "C:\Program Files\Google\Chrome\Application\<version>\libGLESv2.dll" staging\
```

Then also copy `d3dcompiler_47.dll` from the Windows SDK or Visual Studio Redist:
```bat
:: Typically found at:
copy "C:\Program Files (x86)\Windows Kits\10\bin\10.0.xxxxx.0\x64\d3dcompiler_47.dll" staging\
:: Or from VS 2022 redistribution directory:
copy "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Redist\MSVC\14.xx.xxxxx\x64\Microsoft.VC143.CRT\*" staging\
```

**Alternative (vcpkg — builds ANGLE from source, ~30 min):**
```bat
C:\vcpkg\vcpkg install angle:x64-windows
copy C:\vcpkg\installed\x64-windows\bin\libEGL.dll staging\
copy C:\vcpkg\installed\x64-windows\bin\libGLESv2.dll staging\
```

**ANGLE releases (pre-built):**
https://github.com/google/angle/releases

### Step 3 — Drop artifacts into `staging\`

After steps 1 and 2, these files must exist:

```
installer\
└── staging\
    ├── therd-package.exe    ← already here (MinGW build)
    ├── therd-desktop.exe    ← you built in Step 1
    ├── libEGL.dll           ← from Step 2
    ├── libGLESv2.dll        ← from Step 2
    └── d3dcompiler_47.dll   ← from Step 2
```

If you used static libwebsockets + static OpenSSL (recommended), no additional DLLs
are needed. If you built with dynamic linking, also copy:
- `libssl-3-x64.dll`
- `libcrypto-3-x64.dll`
- `libwebsockets.dll`

...and uncomment their entries in `therd-setup.iss`.

### Step 4 — Install Inno Setup 6

Download and install Inno Setup 6 from:
https://jrsoftware.org/isdl.php

Inno Setup 6.x is required (6.2+ recommended). The free version compiles without a license.

### Step 5 — Compile the installer

**Using the Inno Setup IDE:**
Right-click `therd-setup.iss` → "Compile" (or open it in the IDE and press F9).

**Using the command line:**
```bat
cd C:\path\to\THerD-platform\Aria-Studio\installer
"C:\Program Files (x86)\Inno Setup 6\iscc.exe" therd-setup.iss
```

Output: `installer\output\THerD-setup-1.0.0.exe`

---

## Validation checklist (fresh Windows machine)

This corresponds to the Phase 27.7-02 DOCS-01 success criteria — run after installing
on a machine that has never had THerD installed.

### Installer
- [ ] `THerD-setup-1.0.0.exe` runs without UAC elevation (user-mode install)
- [ ] Progress bar shows and install completes without errors
- [ ] If Blender is absent: installer shows "Install Blender from https://blender.org" notice
- [ ] If VSCode is absent: installer shows "Install VSCode from https://code.visualstudio.com" notice
- [ ] If VC++ runtime is absent: installer shows download link (https://aka.ms/vs/17/release/vc_redist.x64.exe)

### CLI packager (new Command Prompt after install)
- [ ] `therd-package` is on PATH — `therd-package --help` works
- [ ] `therd-package --version` prints the version without error
- [ ] `therd-package validate "%USERPROFILE%\Documents\THerD\worlds\hello-park\hello-park.therd"` reports valid

### Simulator
- [ ] `libEGL.dll` and `libGLESv2.dll` are in `%LOCALAPPDATA%\THerD\bin\`
- [ ] Start Menu → "THerD AR Simulator" opens a window
- [ ] The simulator window background is transparent (see-through, not black)
- [ ] The hello-park world loads and "Hello Park loaded!" appears in the console
- [ ] WASD and right-drag camera controls respond
- [ ] Window closes cleanly (no crash)

### VSCode extension
- [ ] Open a `.grav` file in VSCode — syntax highlighting is active
- [ ] Typing `Aria.` shows IntelliSense completions (createObject, createText, etc.)
- [ ] Hover over a method shows documentation
- [ ] Snippets: Ctrl+Shift+P → "GravityAR: ..." commands are present

### Blender addon
- [ ] Install from `%LOCALAPPDATA%\THerD\tools\gravityar-blender-1.0.0.zip` via
  Edit > Preferences > Get Extensions > Install from Disk
- [ ] "GravityAR Exporter" appears in the addon list and can be enabled
- [ ] 3D Viewport sidebar shows a "GravityAR" tab after enabling

### Uninstaller
- [ ] Control Panel → Apps → "THerD AR Platform" → Uninstall removes all installed files
- [ ] `%LOCALAPPDATA%\THerD\` is cleaned up
- [ ] `therd-package` is no longer on PATH (open new terminal to verify)
- [ ] `%USERPROFILE%\Documents\THerD\` is NOT removed (user data preserved)

---

## Directory layout (what is where)

```
Aria-Studio/installer/
├── README.md                     ← this file
├── therd-setup.iss               ← Inno Setup script (compile to produce .exe)
├── staging/
│   ├── therd-package.exe         ← MinGW cross-build (READY)
│   ├── therd-desktop.exe         ← [TODO: build on Windows, Step 1]
│   ├── libEGL.dll                ← [TODO: ANGLE, Step 2]
│   ├── libGLESv2.dll             ← [TODO: ANGLE, Step 2]
│   └── d3dcompiler_47.dll        ← [TODO: Windows SDK / VS Redist, Step 2]
├── dist/
│   ├── gravityar-0.1.0.vsix      ← VSCode extension (READY, Phase 27+27.5)
│   ├── gravityar-blender-1.0.0.zip ← Blender 4.2+ Extension (READY)
│   └── hello-park.therd          ← Sample world, script compiled (READY, 1219 bytes)
├── worlds/
│   └── hello-park/               ← World source
│       ├── manifest.json
│       └── scripts/
│           └── hello-park.grav
└── output/                       ← Created by iscc.exe; .gitignored
    └── THerD-setup-1.0.0.exe     ← [Created in Step 5]
```

---

## Notes

**wine not available in WSL:** `therd-package.exe` was not smoke-tested under wine
(not installed). The binary is a valid PE32+ x86-64 (confirmed by `file`). Validate
on Windows with `therd-package.exe --version` (see checklist above).

**hello-park provenance:** Built from scratch (no Blender source files exist for it).
The world is GLB-free — uses `Aria.createText()` billboard labels + `GPS.createAnchor()`
to anchor them to Dolores Park, San Francisco (37.7596, -122.4269, 17.0 m). Script was
compiled to bytecode by the Linux `therd-package` CLI during staging.

**vsix contents:** Rebuilt 2026-07-02 from current source. Includes `shared/` directory
(Phase 27 ariaApi.ts, 26 static + 58 instance methods), latest snippets (aria-update,
aria-state, aria-animate, aria-physics, aria-text, aria-occluder), and 383 node_modules
entries. Size: 604 KB.

**Blender addon version:** `gravityar-blender-1.0.0.zip` is built from current
`blender-addon/` source as of 2026-07-02 — includes Phase 26.8 occlusion geometry
property (`therd_occlusion`) and GPS origin panel (Phase spec 2026-07-02). Blender
4.2+ Extension format with `blender_manifest.toml` at zip root.
