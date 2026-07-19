# Getting Started Guide

Install the THerD platform tools and launch the desktop simulator for the first time.
By the end of this guide you will have:

- The GravityAR Blender addon installed and enabled
- The GravityAR VSCode extension installed with syntax highlighting working
- The THerD desktop simulator running the built-in test scene

Estimated time: 15–20 minutes.

---

## Prerequisites

**Required software — install before continuing**

| Tool | Version | Where to get it |
|------|---------|-----------------|
| Blender | 4.2 or later | https://www.blender.org/download |
| Visual Studio Code | Any recent | https://code.visualstudio.com |

**Extract the test kit**

Unzip `therd-platform-test-kit.zip` to a folder of your choice, for example your home directory:

```bash
unzip therd-platform-test-kit.zip -d ~/therd-kit
cd ~/therd-kit
```

All commands in this guide run from inside the `therd-kit` folder.

---

## Step 1: Install the Blender Addon

**1a. Open Blender and install the addon**

1. Launch Blender.
2. Go to **Edit > Preferences > Add-ons**.
3. Click the small dropdown arrow at the top right of the Add-ons panel and choose **Install from Disk...**.
4. In the file browser that opens, navigate to the `tools/` folder inside your `therd-kit` directory and select `blender-addon.zip`.
5. Click **Install from Disk**.
6. Find "GravityAR Exporter" in the addon list and enable its checkbox (it may already be enabled after install).

**1b. Verify the addon is working**

Press **N** in the 3D Viewport to open the sidebar. You should see a **GravityAR** tab.

If the tab does not appear: make sure the addon is enabled (the checkbox is checked in Preferences > Add-ons). If you see an error in the Blender system console, confirm you selected `blender-addon.zip` and not the unpacked directory.

---

## Step 2: Install the VSCode Extension

**2a. Install the extension**

Open a terminal, navigate to your `therd-kit` folder, and run:

```bash
code --install-extension tools/gravityar-0.1.0.vsix
```

Expected output:

```
Extension 'gravityar-0.1.0.vsix' was successfully installed.
```

**2b. Verify syntax highlighting**

1. Create a new file called `hello.grav` anywhere on disk.
2. Open it in VSCode.
3. Look at the bottom-right of the VSCode window — the language indicator should read **GravityAR**.

If it shows "Plain Text": click the language indicator, type "GravityAR", and select it from the list. On the second file open it will auto-detect.

---

## Step 3: Run the Desktop Simulator

**3a. Launch the simulator with the built-in test scene**

From inside the `therd-kit` folder:

```bash
./bin/therd-desktop --world data/worlds/test_scene
```

**3b. What you should see**

A window opens titled **THerD Desktop Simulator**. The scene shows three cubes on a floor plane. The terminal prints:

```
=== THerD Desktop Simulator ===
World loaded from: data/worlds/test_scene
Controls: WASD to move, right-click to orbit, scroll to zoom, middle-click to pan, ESC to quit
===============================
```

**3c. Camera controls**

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

**"Permission denied" when running therd-desktop**

Make the binary executable:

```bash
chmod +x bin/therd-desktop
```

Then try again.

**"GLFW error: no displays found" or blank screen on headless Linux**

You need a running display session. If you are in a desktop environment, set:

```bash
export DISPLAY=:0
```

Then re-run the simulator. The desktop simulator requires an OpenGL-capable display — it cannot run headless.

**"Cannot open world directory" or "Failed to load world"**

Make sure you are running from inside the `therd-kit` folder. The path `data/worlds/test_scene` is relative to where you run the command. Verify the directory exists:

```bash
ls data/worlds/test_scene/manifest.json
```

**Build succeeds but simulator immediately exits**

Run with `--help` to confirm the binary works:

```bash
./bin/therd-desktop --help
```

If this prints usage, the binary is fine — double-check your `--world` path.

---

You now have all three tools installed and the simulator running. Continue to the
[Workflow Tutorial](workflow-tutorial.md) to create your first AR world.
