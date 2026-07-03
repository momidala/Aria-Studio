# THerD Windows Installer — Operator Runbook

**Audience:** whoever produces `THerD-setup-1.0.0.exe` (today: Larry, on the Windows
side of this machine).
**Companion docs:** `README.md` (quick 5-step guide + layout), `../../THerD/docs/WINDOWS-BUILD.md`
(build details), `.planning/ROADMAP.md` Phase 27.7 (scope decisions).
**Scope decisions (2026-07-02):** Blender + VSCode are detected prerequisites, never
bundled. No server component. `hello-park` sample world is bundled.

---

## 0. Prerequisites (one-time machine setup)

On the **Windows** side (not WSL):

| Tool | Why | Get it |
|---|---|---|
| Visual Studio 2022 Build Tools (C++ workload) | builds `therd-desktop.exe` | https://visualstudio.microsoft.com/downloads/ → "Build Tools for Visual Studio 2022" → check *Desktop development with C++* |
| vcpkg | dependency manager (GLFW, OpenSSL, pthreads) | step 0.1 below |
| Inno Setup 6 (6.2+) | compiles the installer | https://jrsoftware.org/isdl.php |
| Git for Windows | if building from a Windows-side clone | https://git-scm.com |
| Chrome (optional) | easiest ANGLE DLL source | already installed on most machines |

### 0.1 vcpkg bootstrap

```bat
git clone https://github.com/microsoft/vcpkg C:\vcpkg
C:\vcpkg\bootstrap-vcpkg.bat
```

### 0.2 Dependencies — pick ONE linking mode

**Static (RECOMMENDED — fewer DLLs to ship):**
```bat
C:\vcpkg\vcpkg install glfw3:x64-windows-static openssl:x64-windows-static pthreads:x64-windows-static
```

**Dynamic (simpler build, three more DLLs in the installer):**
```bat
C:\vcpkg\vcpkg install glfw3:x64-windows openssl:x64-windows pthreads:x64-windows
```

> Note: the repos live in WSL at `\\wsl$\...\THerD-platform\`. Building against the
> WSL filesystem from MSVC works but is slow; if the build misbehaves, clone THerD
> to a native path (e.g. `C:\src\THerD`) at the same commit and build there.

---

## 1. Build `therd-desktop.exe`

Open **x64 Native Tools Command Prompt for VS 2022**.

**Static mode (recommended):**
```bat
cd <THerD repo>
cmake -B build_win ^
  -DTHERD_PLATFORM_DESKTOP=ON ^
  -DCMAKE_TOOLCHAIN_FILE=C:\vcpkg\scripts\buildsystems\vcpkg.cmake ^
  -DVCPKG_TARGET_TRIPLET=x64-windows-static ^
  -DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded
cmake --build build_win --config Release
```

**Dynamic mode:** same, but `-DVCPKG_TARGET_TRIPLET=x64-windows` and no
`CMAKE_MSVC_RUNTIME_LIBRARY` line.

**Result:** `build_win\Release\therd-desktop.exe`

**Smoke test immediately** (before staging):
```bat
build_win\Release\therd-desktop.exe --help
```
Rendering isn't testable yet (no ANGLE DLLs beside the exe) — `--help` proves it links.

---

## 2. Obtain ANGLE DLLs (OpenGL ES on Windows)

`therd-desktop.exe` renders GLES3; on Windows that means ANGLE. Three sources, pick one:

**A. Copy from Chrome (fastest):**
```bat
cd <Aria-Studio repo>\installer
copy "C:\Program Files\Google\Chrome\Application\<version>\libEGL.dll" staging\
copy "C:\Program Files\Google\Chrome\Application\<version>\libGLESv2.dll" staging\
```
(`<version>` = the numeric folder, e.g. `126.0.6478.127`.)

**B. vcpkg (builds from source, ~30 min):**
```bat
C:\vcpkg\vcpkg install angle:x64-windows
copy C:\vcpkg\installed\x64-windows\bin\libEGL.dll staging\
copy C:\vcpkg\installed\x64-windows\bin\libGLESv2.dll staging\
```

**C. Pre-built releases:** https://github.com/google/angle/releases

**Always also needed** — the D3D shader compiler:
```bat
copy "C:\Program Files (x86)\Windows Kits\10\bin\10.0.<sdkver>.0\x64\d3dcompiler_47.dll" staging\
```

---

## 3. Stage

Required contents of `Aria-Studio\installer\staging\`:

```
therd-package.exe     ← already staged (MinGW cross-build from WSL)
therd-desktop.exe     ← from step 1
libEGL.dll            ← from step 2
libGLESv2.dll         ← from step 2
d3dcompiler_47.dll    ← from step 2
```

**Dynamic mode only** — also stage and UNCOMMENT their lines in `therd-setup.iss`:
```
libssl-3-x64.dll
libcrypto-3-x64.dll
libwebsockets.dll
```

**Second smoke test** — now rendering is possible:
```bat
cd staging
therd-desktop.exe --world ..\worlds\hello-park
```
Expect a transparent window with the hello-park text labels and
`Hello Park loaded!` on the console. If the window fails to open, see Troubleshooting.

---

## 4. Compile the installer

```bat
cd <Aria-Studio repo>\installer
"C:\Program Files (x86)\Inno Setup 6\iscc.exe" therd-setup.iss
```
Or open `therd-setup.iss` in the Inno Setup IDE and press F9.

**Output:** `installer\output\THerD-setup-1.0.0.exe`

---

## 5. Validate (fresh-machine checklist)

Run the full 19-item checklist in `README.md` § "Validation checklist" on a machine
(or Windows Sandbox / clean VM) that has never had THerD installed. Summary of the
groups: installer behavior + prerequisite detection, `therd-package` on PATH,
simulator renders hello-park with transparency, VSCode IntelliSense live in a `.grav`
file, Blender addon installs from the bundled zip, uninstaller removes program files
but preserves `%USERPROFILE%\Documents\THerD\`.

This checklist is the DOCS-01 criterion Phase 28 re-tests with a real artist — a pass
here is the rehearsal.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `glfwCreateWindow` returns NULL / no window | ANGLE DLLs missing beside the exe, or built without the `_WIN32` EGL hint | confirm `libEGL.dll`+`libGLESv2.dll`+`d3dcompiler_47.dll` sit next to `therd-desktop.exe`; confirm THerD ≥ commit `ddae490` (adds `GLFW_EGL_CONTEXT_API` hint) |
| Window opens but black, no transparency | transparency needs compositor support | expected on some remote-desktop sessions; test locally |
| `libssl-3-x64.dll not found` at launch | dynamic OpenSSL build without staging the DLLs | use static triplet (step 0.2) or stage + uncomment DLL lines |
| CMake can't find GLFW/OpenSSL | wrong triplet vs installed packages | triplet in the cmake command must match the vcpkg install triplet exactly |
| `flatcc` build errors under MSVC | flatcc is FetchContent-built and MSVC-buildable, but if it fails: | check `build_win` logs; worst case generate headers in WSL (`protocol_gen` target) and re-run |
| Inno: "file not found: staging\therd-desktop.exe" | staging incomplete | step 3 list is mandatory; the .iss intentionally hard-fails on missing artifacts |
| `therd-package` not on PATH after install | PATH is per-user (HKCU) and needs a NEW terminal | open a fresh Command Prompt |
| Installer flags missing VC++ runtime on a machine that has VS | detection checks the redist registry key, not VS | install the redist: https://aka.ms/vs/17/release/vc_redist.x64.exe |

---

## Regenerating staged artifacts (future releases — run in WSL)

All commands from the repo roots in WSL. Rebuild whichever artifact changed, bump
versions in `therd-setup.iss` (`MyAppVersion`) and filenames, re-run steps 4–5.

**`therd-package.exe`** (after packager/Gravity changes):
```bash
cd Aria-Studio/packaging
cmake -B build_win -DCMAKE_TOOLCHAIN_FILE=$(pwd)/../../THerD/cmake/mingw-w64-x86_64.cmake
cmake --build build_win
cp build_win/therd-package.exe ../installer/staging/
```

**VSCode extension `.vsix`** (after any extension change):
```bash
cd Aria-Studio/vscode-extension
npm test                       # gates: compiles shared+client+server, runs suite
npx @vscode/vsce package --out ../installer/dist/
```
Verify the new `.vsix` contains `extension/shared/out/` (unzip -l) — the LSP server
needs it at runtime.

**Blender addon zip** (after addon changes): rebuild with `blender_manifest.toml`
at the zip root, addon files beneath it, excluding `tests/`, `__pycache__/`:
```bash
cd Aria-Studio && rm -f installer/dist/gravityar-blender-*.zip
# reproduce the layout used by 06096a8 (see git show 06096a8 --stat for the file list)
```

**`hello-park.therd`** (after world/API changes):
```bash
cd Aria-Studio/packaging && cmake -B build && cmake --build build   # Linux packager
./build/therd-package create --dir ../installer/worlds/hello-park --output ../installer/dist/hello-park.therd
./build/therd-package validate ../installer/dist/hello-park.therd
```

**Staleness warning (learned 2026-07-02):** the Feb-2026 `.vsix` and addon zip had
gone four months stale and were silently missing Phases 26.8–27.5. Before ANY
installer release, regenerate all four dist artifacts from current source — never
reuse ones found lying around.
