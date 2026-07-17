# Troubleshooting Guide

This guide covers the most common problems you will encounter. Each entry explains what went wrong in plain language and gives exact steps to fix it. Error messages shown in quotes match the actual text produced by the tools.

---

## Blender Addon Problems

### "No mesh objects in scene — export will create empty world"

**What happened:** Your scene has no 3D mesh objects. Blender's default cube was deleted and nothing was added, or you started from a blank scene. The exporter found zero objects of type MESH.

**Fix:** Add mesh objects: Add > Mesh > Cube (or Sphere, Cylinder, Plane). Click "Export GravityAR" again. You need at least one mesh object for the world to contain anything.

---

### "'ObjectName' has unapplied transforms — may look different in AR"

**What happened:** You scaled or rotated an object using the transform handles (G, R, S) but did not apply the transforms. Blender stores these as "pending" transforms separate from the mesh data. The GLB exporter includes them, but some AR renderers may handle them differently than Blender shows.

**Fix:** Select the affected object. Press Ctrl+A and choose "All Transforms". Repeat for each object showing this warning. Then export again.

**Note:** This is a WARNING, not an ERROR. You can still export — the object will usually look correct. Apply transforms to be certain.

---

### "'ObjectName' has negative scale — will appear inside-out in AR" (ERROR)

**What happened:** The object was mirrored using negative scale (for example, by pressing S, X, -1 to flip on the X axis). Negative scale makes the mesh normals point inward, so the surface will appear invisible or inside-out in AR. This is an ERROR that blocks export.

**Fix:**
1. Select the object
2. Press Ctrl+A and choose "Scale" to apply the scale
3. Enter Edit Mode (Tab)
4. Select all faces (A)
5. Go to Mesh > Normals > Recalculate Outside (or press Shift+N)
6. Exit Edit Mode (Tab)
7. Export again

---

### "'ObjectName' has zero scale on X axis — invisible in AR" (ERROR)

**What happened:** The object has been scaled to zero on one or more axes (X, Y, or Z), making it completely flat and invisible. This is an ERROR that blocks export.

**Fix:** Select the object. In Properties (right panel) > Object Properties > Transform, look at the Scale row. Set any zero values back to a non-zero number such as 1.0. Then export.

---

### "'ObjectName' has N N-gons (5+ sided faces) — may render differently in AR"

**What happened:** The mesh has polygons with 5 or more sides (n-gons). The AR renderer on Raspberry Pi 5 hardware works best with triangles or quads (4-sided faces). N-gons can cause shading artifacts or unexpected triangulation.

**Fix:** Select the object. Enter Edit Mode (Tab). Select all faces (A). Go to Face menu > Triangulate Faces, or press Ctrl+T. Exit Edit Mode. Export.

---

### "Scene units set to 'None' — world scale may be incorrect"

**What happened:** Your Blender scene has units set to None. Without a unit system, the exporter cannot guarantee that 1 Blender unit equals 1 meter in AR. Objects may appear much too large or too small.

**Fix:** Go to Properties > Scene Properties > Units. Set Unit System to "Metric". The exporter works in meters, so Metric with Unit Scale 1.000 is the correct setting.

---

### Export button is greyed out or missing from the GravityAR panel

**What happened:** The addon is not enabled or failed to load during startup.

**Fix:**
1. Edit > Preferences > Add-ons
2. Search for "GravityAR"
3. If it appears but is unchecked, enable it
4. If it does not appear, click "Install" and navigate to `Aria-Studio/blender-addon/__init__.py`
5. If enabling fails, check the system console for Python errors: on Windows go to Window > Toggle System Console; on macOS/Linux launch Blender from a terminal and look for tracebacks

---

## Packaging Problems

These errors come from the `therd-package` command-line tool.

### "manifest.json not found"

**What happened:** The world directory you passed to `therd-package --dir` does not contain a `manifest.json` file at its root.

**Fix:** Create `manifest.json` in the root of your world directory. Minimum required content:

```json
{
  "name": "my-world",
  "version": "1.0.0",
  "entry_script": "scripts/main.grav"
}
```

Make sure the file is named exactly `manifest.json` (lowercase, no spaces).

---

### "manifest.json: missing or empty 'name' field"

**What happened:** The `manifest.json` exists but either has no `name` field, or the name is an empty string (`"name": ""`).

**Fix:** Open `manifest.json` and add or fill in the `name` field with a non-empty string. The name is used as the package filename when no `--output` is specified.

---

### "manifest.json: missing 'version' field"

**What happened:** The `version` field is absent from `manifest.json`.

**Fix:** Add `"version": "1.0.0"` (or any version string) to your `manifest.json`. The version field is required even if you are not distributing multiple versions.

---

### "manifest.json: missing 'entry_script' field"

**What happened:** `manifest.json` does not specify which script to run when the world loads.

**Fix:** Add `"entry_script": "scripts/main.grav"` (adjust the path to match where your script file is). The path is relative to the world directory root.

---

### "entry_script 'scripts/main.grav' does not exist"

**What happened:** The `entry_script` path in `manifest.json` points to a file that does not exist in the world directory.

**Fix:** Check the file path carefully — it must be relative to the world directory root and case-sensitive on Linux. If your script is at `my-world/scripts/hello.grav`, set `"entry_script": "scripts/hello.grav"`. Verify the file exists:

```bash
ls my-world/scripts/
```

---

### "manifest.json is invalid JSON"

**What happened:** The JSON syntax in `manifest.json` is incorrect. Common causes: a missing comma between fields, a trailing comma after the last field, unclosed braces, or single quotes instead of double quotes.

**Fix:** Open `manifest.json` in VSCode — it highlights JSON syntax errors with red underlines. Common mistakes to look for:

- Missing comma: `"name": "x"  "version": "1.0"` needs a comma after `"x"`
- Trailing comma: `"version": "1.0",` with nothing after it
- Single quotes: JSON requires double quotes for all strings and field names

---

### "asset 'assets/models/tree.glb' does not exist"

**What happened:** The `manifest.json` lists an asset in the `assets` section that does not exist at that path in the world directory.

**Fix:** Either add the missing file at the expected path, or remove/correct the entry in the `assets` section of `manifest.json`. Run `therd-package validate --dir my-world/` to check all asset references before packaging.

---

## Upload Problems

### curl: (7) Failed to connect to localhost port 3000: Connection refused

**What happened:** The THerD Server is not running on port 3000.

**Fix:**
1. Open a separate terminal
2. Go to the `THerD-Server/` directory: `cd THerD-Server`
3. Start the server: `cargo run`
4. Wait for the line: `THerD Server v... listening on 0.0.0.0:3000`
5. Return to the first terminal and retry your curl command

---

### Server returns HTTP 413 (Payload Too Large)

**What happened:** Your world package (`.therd` file) exceeds the server's upload size limit. The default is configured in `THerD-Server/config/default.toml` as `max_upload_size_mb`.

**Fix (reduce package size):**
- In Blender, add a Decimate modifier to large meshes to reduce polygon count
- Use GLB format (binary) for models rather than GLTF+JSON+bin
- Check audio files — uncompressed WAV files are much larger than OGG; re-encode with a tool like Audacity or ffmpeg: `ffmpeg -i input.wav -c:a libvorbis -q:a 4 output.ogg`

**Fix (increase limit for development):**
- Open `THerD-Server/config/default.toml`
- Increase `max_upload_size_mb` to a larger value
- Restart the server

---

### Server returns HTTP 400 with validation error

**What happened:** The server's own manifest validation found a problem in the uploaded package. This can happen if the package was created manually or with an older tool version.

**Fix:** The response body contains a JSON object with an `"errors"` array. Read the error messages — they match the manifest errors in the Packaging Problems section above. Fix `manifest.json`, repackage with `therd-package create --dir my-world/`, and re-upload.

---

## GPS and Anchor Problems

### Objects don't appear at the expected real-world location in the simulator

**What happened:** The GPS anchor coordinates in the script and the simulated GPS position in the simulator are far apart. If the player is at (37.7749, -122.4194) and an anchor is placed at (37.8000, -122.5000), the object is over a kilometer away — outside the visible area.

**Fix:** When running the simulator, use `--gps-lat` and `--gps-lon` values that are close to (within a few hundred meters of) the anchor coordinates in your script.

**Example:** If your script has:
```
GPS.createAnchor(37.7749, -122.4194, 0.0)
```

Launch the simulator with:
```bash
./build_desktop/therd-desktop --world world.therd --gps-lat 37.7749 --gps-lon -122.4194
```

---

### GPS.getPlayerPosition() returns null

**What happened:** `GPS.getPlayerPosition()` requires a GPS tracker initialized in the platform context. If the GPS tracker is not initialized, this function returns `null` and script execution continues (it does not raise an error or halt the VM).

**Fix:** Check the return value before use (`var pos = GPS.getPlayerPosition(); if (pos) { ... }`), or seed a simulated position with `--gps-lat`/`--gps-lon`/`--gps-alt` when launching the desktop simulator. Use GPS anchors (`GPS.createAnchor()`) for placing objects at real-world coordinates — anchor placement works correctly regardless of player-position tracking.

---

## Simulator Problems

### "therd-desktop: command not found"

**What happened:** The simulator binary is not in your PATH, or the build failed.

**Fix:**
1. Check that the build output exists: `ls THerD/build_desktop/therd-desktop`
2. If it does not exist, the build failed — check the cmake/make output for errors
3. Run directly with a path: `./build_desktop/therd-desktop` from inside the `THerD/` directory
4. If the build failed, check that build prerequisites are installed (see the Getting Started guide)

---

### Simulator opens but shows a black screen (no objects visible)

**What happened:** The world loaded but either the camera is pointing away from all objects, or the script did not create any objects.

**Fix:**
- Press W to move the camera forward and S to move back — objects may be behind the default camera position
- Try moving around with W/A/S/D keys to find objects
- Check the terminal output for script errors: look for lines starting with `[Script]` or `[Error]`
- Open your `.grav` script and confirm `func main()` calls `Aria.createObject()` and that the model paths exist inside the world package

---

### Simulator crashes immediately on launch

**What happened:** OpenGL/GLFW initialization failed. Common causes: no display session is active, or OpenGL ES support is missing from the driver.

**Fix:**
- On Linux without a display session (SSH without X forwarding): the simulator requires a graphical session. Set `DISPLAY=:0` if you have a running X session, or connect to the machine with X forwarding: `ssh -X user@host`
- Check the terminal for GLFW error messages printed before the crash
- Make sure required libraries are installed: `sudo apt install libglfw3-dev libgl1-mesa-dev libgles2-mesa-dev`

---

### Script errors appear in terminal but the world window opens

**What happened:** The GravityAR script has a runtime error. THerD logs the error and continues running — the window stays open but the script may not have placed any objects.

**Fix:** Read the error message in the terminal. Common causes:

- **Calling a method on null:** `Aria.createObject()` returns null if the scene node cannot be created. Always check: `if (obj != null) { obj.setPosition(...); }`
- **Wrong number of arguments:** Check the API Reference for the exact parameter count. For example, `setPosition` requires 3 arguments (x, y, z).
- **Syntax error:** Open the script in VSCode — the GravityAR extension highlights syntax errors inline. Look for red underlines before running.
- **Compilation failed in therd-package:** The script may have compiled to invalid bytecode. Run `therd-package validate --dir my-world/` and check the Gravity compiler error output.

---

## Still stuck?

Note the exact error text and the step where it occurred. The platform is under active development and error messages improve with each phase. Specific feedback (exact error + what you were doing) directly improves this guide and the tools.
