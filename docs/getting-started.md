# Getting Started Guide

Install the THerD platform tools and launch the desktop simulator for the first time.
By the end of this guide you will have:

- The GravityAR Blender addon installed and enabled
- The GravityAR VSCode extension installed with syntax highlighting working
- The THerD desktop simulator built and running the built-in test scene

Estimated time: 30–45 minutes (most of this is build time).

---

## Prerequisites

**Supported operating systems**

- Linux: Ubuntu 22.04 or later (recommended)
- macOS: 13 (Ventura) or later
- Windows 11: Use WSL2 for the simulator build — all commands below run inside WSL2

**Required software — install before continuing**

| Tool | Version | Where to get it |
|------|---------|-----------------|
| Blender | 3.0 or later | https://www.blender.org/download |
| Visual Studio Code | Any recent | https://code.visualstudio.com |
| Git | Any | Your package manager or https://git-scm.com |
| CMake | 3.10 or later | Your package manager |
| C compiler | gcc or clang | Your package manager |
| GLFW3 dev libraries | Any | Your package manager |

**Install system dependencies**

On Ubuntu/Debian Linux:

```bash
sudo apt update
sudo apt install cmake gcc libglfw3-dev libgl1-mesa-dev
```

On macOS with Homebrew:

```bash
brew install cmake glfw
```

On Windows (WSL2): Open your WSL2 terminal and run the Ubuntu/Debian commands above.

---

## Step 1: Install the Blender Addon

**1a. Clone the Aria-Studio repository**

```bash
git clone https://github.com/momidala/Aria-Studio
```

**1b. Open Blender and install the addon**

1. Launch Blender.
2. Go to **Edit > Preferences > Add-ons**.
3. Click the **Install** button (top right of the Add-ons panel).
4. In the file browser that opens, navigate to the `Aria-Studio/blender-addon/` directory.
5. Select `__init__.py` and click **Install Add-on**.
6. Find "GravityAR Exporter" in the addon list and enable its checkbox.

**1c. Verify the addon is working**

Press **N** in the 3D Viewport to open the sidebar. You should see a **GravityAR** tab.

If the tab does not appear: make sure the addon is enabled (the checkbox is checked in Preferences > Add-ons). If you see an error in the Blender system console, confirm you selected `__init__.py` from the `blender-addon/` directory — not a parent folder.

---

## Step 2: Install the VSCode Extension

**2a. Open a terminal in the extension directory**

```bash
cd Aria-Studio/vscode-extension
```

**2b. Build and package the extension**

```bash
npm install && npm run compile && npm run package
```

Expected output ends with a line like:

```
Packaged: gravityar-0.1.0.vsix (or similar version)
```

**2c. Install the extension into VSCode**

```bash
code --install-extension gravityar-*.vsix
```

Expected output:

```
Extension 'gravityar-*.vsix' was successfully installed.
```

**2d. Verify syntax highlighting**

1. Create a new file called `hello.grav` anywhere on disk.
2. Open it in VSCode.
3. Look at the bottom-right of the VSCode window — the language indicator should read **GravityAR**.

If it shows "Plain Text": click the language indicator, type "GravityAR", and select it from the list. On the second file open it will auto-detect.

---

## Step 3: Build the Desktop Simulator

**3a. Clone the THerD client repository**

```bash
git clone https://github.com/momidala/THerD
cd THerD
```

**3b. Configure and build**

```bash
cmake -B build_desktop -DTHERD_PLATFORM_DESKTOP=ON -DCMAKE_BUILD_TYPE=Debug
cmake --build build_desktop
```

The first build downloads FlatBuffers and libwebsockets via CMake FetchContent. This may take 5–15 minutes depending on network speed. Subsequent builds are much faster.

**3c. Verify the build succeeded**

```bash
ls build_desktop/therd-desktop
```

Expected output: the path `build_desktop/therd-desktop` (the file exists — no "No such file" error).

If the build failed:
- "CMake Error: could not find GLFW" — run `sudo apt install libglfw3-dev` (Linux) or `brew install glfw` (macOS) and re-run cmake.
- Compiler errors in third-party code — make sure you are using gcc or clang, not an older compiler. Check `cmake --version` is 3.10 or later.

---

## Step 4: First Launch

**4a. Run the simulator with the built-in test scene**

From inside the `THerD` directory:

```bash
./build_desktop/therd-desktop --world data/worlds/test_scene
```

**4b. What you should see**

A window opens titled **THerD Desktop Simulator**. The scene shows three cubes on a floor plane. The terminal prints:

```
THerD Desktop Simulator
===============================
Controls: WASD to move, right-click to orbit, scroll to zoom, middle-click to pan, ESC to quit
===============================
```

**4c. Camera controls**

| Key or gesture | Action |
|----------------|--------|
| W / S | Move camera target forward / backward |
| A / D | Move camera target left / right |
| Q / E | Move camera target down / up |
| Shift + WASD / QE | Same movement at 5x speed |
| Right-click drag | Orbit the camera around the target |
| Middle-click drag | Pan the camera target |
| Scroll wheel | Zoom in / out |
| ESC or close window | Quit |

---

## Troubleshooting First Launch

**"therd-desktop: command not found"**

Use the path relative to the THerD directory: `./build_desktop/therd-desktop`. The executable is not on your system PATH.

**"GLFW error: no displays found" or blank screen on headless Linux**

You need a running display session. If you are in a desktop environment, set:

```bash
export DISPLAY=:0
```

Then re-run the simulator. The desktop simulator requires an OpenGL-capable display — it cannot run headless.

**"Cannot open world directory" or "Failed to load world"**

Make sure you are running from inside the `THerD` directory (not from `build_desktop`). The path `data/worlds/test_scene` is relative to the THerD repo root. Verify the directory exists:

```bash
ls data/worlds/test_scene/manifest.json
```

If the file is missing, your clone may be incomplete. Try `git status` and `git submodule update --init --recursive` if applicable.

**Build succeeds but simulator immediately exits**

Run with `--help` to confirm the binary works:

```bash
./build_desktop/therd-desktop --help
```

If this prints usage, the binary is fine — double-check your `--world` path.

---

You now have all three tools installed and the simulator running. Continue to the
[Workflow Tutorial](workflow-tutorial.md) to create your first AR world.
