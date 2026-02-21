# Workflow Tutorial: Hello Park

This tutorial walks through the complete THerD creative workflow: from a blank Blender scene to an AR world running in the desktop simulator.

**What you will build:** A "Hello Park" AR world — a tree and a bench placed in a park, viewable in the simulator with a confirmation message printed to the terminal.

**Tools used:** Blender (scene creation), VSCode (script editing), the CLI packager (bundling), THerD-Server (hosting), and the desktop simulator (viewing).

**Prerequisites:** Complete the [Getting Started Guide](getting-started.md) first. All three tools must be installed and the simulator must launch successfully before starting this tutorial.

**Estimated time:** ~45 minutes.

All commands run from inside your `therd-kit` folder.

---

## Part 1: Create the Blender Scene

**1.1 Set up units**

Open Blender. Before creating any objects, set the scene to metric units:

1. In the **Properties** panel (right side), click the **Scene** tab (camera icon).
2. Under **Units**, set **Unit System** to **Metric** and **Unit Scale** to `1.000`.

This ensures 1 Blender unit = 1 meter, which matches the THerD coordinate system.

**1.2 Delete the default cube**

Click the default cube to select it, then press **X** and confirm **Delete**.

**1.3 Add the ground plane**

Press **Shift+A > Mesh > Plane** to add a plane. With the plane still selected, press **S**, type `5`, then **Enter**. This scales the plane to 5 meters square.

In the **Outliner** (top right), double-click "Plane" and rename it to `ground`.

**1.4 Add the tree trunk**

Press **Shift+A > Mesh > Cylinder** to add a cylinder. Name it `tree` in the Outliner.

Move it up so it sits on the ground: press **G**, then **Z**, type `1`, then **Enter**. The tree trunk is now 1 meter above the ground plane.

**1.5 Add the tree canopy**

Press **Shift+A > Mesh > UV Sphere**. Name it `canopy`.

Move it to sit on top of the trunk: press **G**, **Z**, `2.5`, **Enter**.
Scale it to be a little wider: press **S**, `1.5`, **Enter**.

**1.6 Add the bench**

Press **Shift+A > Mesh > Cube**. Name it `bench`.

Position it to the side of the tree: press **G**, **X**, `3`, **Enter**.
Lift it slightly off the ground: press **G**, **Z**, `0.5`, **Enter**.
Flatten it into a seat shape: press **S**, **Z**, `0.2`, **Enter**.

**1.7 Validate the scene**

Press **N** to open the sidebar in the 3D Viewport, then click the **GravityAR** tab.

The GravityAR panel shows any validation issues. Fix any **ERROR** level issues before proceeding — errors will prevent export. **WARNING** level issues are informational and will not block export.

Common errors and fixes:
- "Object has no UV map" — select the object, go to the UV Editing workspace, and add a UV map.
- "Object name contains spaces" — rename in the Outliner to use only letters, numbers, and underscores.

**1.8 Export the scene**

In the GravityAR sidebar, click **Export GravityAR**.

Save the file as `hello-park.grav` inside a new folder:

```
~/ar-worlds/hello-park/scripts/hello-park.grav
```

Create the folders first if they do not exist:

```bash
mkdir -p ~/ar-worlds/hello-park/scripts
```

After export, open `hello-park.grav` in a text editor to see what was generated — the addon writes a GravityAR script that creates each object from your scene using `Aria.createObject()` calls.

---

## Part 2: Create the World Manifest

Create a file at `~/ar-worlds/hello-park/manifest.json` with exactly this content:

```json
{
  "name": "hello-park",
  "version": "1.0.0",
  "entry_script": "scripts/hello-park.grav",
  "author": "your-name",
  "description": "A simple park AR world"
}
```

Replace `your-name` with your name or handle.

The required fields are `name`, `version`, and `entry_script`. The `entry_script` path is relative to the world directory (`~/ar-worlds/hello-park/`). The remaining fields are optional metadata.

---

## Part 3: Customize the Script in VSCode

**3.1 Open the world folder in VSCode**

```bash
code ~/ar-worlds/hello-park/
```

**3.2 Open the script**

In the VSCode Explorer panel, open `scripts/hello-park.grav`.

The file should show GravityAR syntax highlighting. The language indicator in the bottom-right of the window reads **GravityAR**.

**3.3 Add a confirmation print**

Find the `func main()` function (it is at the top level of the file). Inside `main()`, before the final `return null;` line, add:

```
System.print("Hello Park loaded!");
```

This message will appear in the simulator terminal output when the script runs, confirming that script execution reached this point.

**3.4 Optional: add a GPS anchor**

If you want to place the world at a real-world location, add these lines after the existing object creation code and before `return null;`:

```
var parkAnchor = GPS.createAnchor(37.7749, -122.4194, 0.0);
ground.setAnchor(parkAnchor);
```

This anchors the world to San Francisco's Union Square (latitude 37.7749, longitude -122.4194, altitude 0.0 meters). Replace with your own coordinates if you prefer a different location. The simulator accepts GPS coordinates via command-line flags, which you will use in Part 7.

**3.5 Compile-check the script**

In VSCode, open the Command Palette with **Ctrl+Shift+P** (or **Cmd+Shift+P** on macOS) and run:

```
GravityAR: Compile Current File
```

If there are syntax errors they will appear in the **Problems** panel (View > Problems). Fix any errors before continuing.

---

## Part 4: Package the World

The CLI packager bundles your manifest, script, and any exported models into a single `.therd` file.

**4.1 Create the package**

From inside your `therd-kit` folder:

```bash
./bin/therd-package ~/ar-worlds/hello-park/ hello-park.therd
```

Expected output:

```
Package created: hello-park.therd
```

The file `hello-park.therd` is a ZIP archive. You can inspect its contents with:

```bash
unzip -l hello-park.therd
```

You should see `manifest.json` and `scripts/hello-park.grav` listed.

---

## Part 5: Start the Server

**5.1 Start THerD-Server**

Open a new terminal, navigate to your `therd-kit` folder, and run:

```bash
./bin/therd-server
```

**5.2 Confirm the server is ready**

Wait for this line in the terminal output:

```
THerD Server v... listening on 0.0.0.0:3000
```

Leave this terminal running. Open a new terminal for the next steps.

---

## Part 6: Upload the World to the Server

In a new terminal, run:

```bash
curl -X POST http://localhost:3000/world \
  --data-binary @hello-park.therd \
  -H "Content-Type: application/octet-stream"
```

Expected response — a JSON object confirming the upload:

```json
{"status":"ok","name":"hello-park"}
```

If curl reports "Connection refused": make sure the server from Part 5 is still running and listening on port 3000.

---

## Part 7: View the World in the Simulator

Open a third terminal, navigate to your `therd-kit` folder, and run:

```bash
./bin/therd-desktop \
  --server-url http://localhost:3000 \
  --gps-lat 37.7749 \
  --gps-lon -122.4194
```

The simulator connects to the server, downloads the `hello-park` world, and loads it. The GPS coordinates must match the anchor you set in the script (Part 3.4) for anchored objects to appear in the correct position.

**What you should see in the simulator window:** The park scene — ground plane, tree trunk, canopy, and bench arranged as you placed them in Blender.

**What you should see in the terminal:**

```
Hello Park loaded!
```

This confirms the GravityAR script ran to completion. If this line is missing, check that you saved the script after adding the `System.print` call in Part 3.3 and that the package was rebuilt after the edit (repeat Parts 4.2 and 6 if needed).

**Camera controls:** Use the same controls as the Getting Started Guide — W/A/S/D to move, right-click drag to orbit, scroll to zoom, middle-click drag to pan.

---

## Next Steps

You have created a complete AR world from scratch. Here are directions to take it further:

**More objects**

```
var marker = Aria.createObject("models/marker.glb");
```

Use `Aria.createObject()` for any glTF model exported from Blender or created separately.

**Interactive tap handlers**

```
func onUserTap() {
    System.print("Bench tapped!");
}
Input.onTap(onUserTap);
```

**Spatial audio**

```
var chime = Audio.play3D("sounds/chime.ogg", 37.7749, -122.4194, 0.0);
```

**Full API reference**

See the [GravityAR API Reference](api-reference.md) for complete documentation of the `Aria`, `GPS`, `Input`, and `Audio` modules, including all parameters and return values.
