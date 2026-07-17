# GravityAR API Reference

GravityAR scripts are written in the [Gravity](https://marcobambini.github.io/gravity/) language. Four global modules are available: `Aria`, `GPS`, `Input`, and `Audio`. Scripts have a single entry point: `func main()`.

Every script must follow this pattern:

```
extern class Aria;
extern class GPS;
extern class Input;
extern class Audio;

func main() {
    // your code here
    return null;
}
```

The `extern class` declarations tell the Gravity compiler that these classes are provided by the runtime (THerD). They do not need to be imported or required — they are always available.

---

## Aria Module

The `Aria` module manages 3D objects in the AR scene.

### Aria.createObject(name, modelPath)

Creates a 3D object and places it in the scene.

**Parameters:**
- `name` (string) — Unique identifier for this object. Used to find and reference it later.
- `modelPath` (string) — Path to the GLTF/GLB model file, relative to the world package's `assets/` directory.

**Returns:** An object handle with position, rotation, scale, and anchor methods. Returns `null` if the platform context is unavailable or a scene node cannot be allocated.

**Example:**
```
var tree = Aria.createObject("oak_tree", "models/tree.glb");
if (tree != null) {
    tree.setPosition(0.0, 0.0, -5.0);
}
```

---

### object.setPosition(x, y, z)

Sets the object's position in 3D space. Coordinates are in meters; Y is up.

**Parameters:** `x`, `y`, `z` (float) — Position in meters relative to the world origin.

**Returns:** null

**Example:**
```
tree.setPosition(2.0, 0.0, -3.0);  // 2m right, ground level, 3m ahead
```

---

### object.setRotation(x, y, z, w)

Sets the object's rotation as a quaternion.

**Parameters:** `x`, `y`, `z`, `w` (float) — Quaternion components. For no rotation use `(0.0, 0.0, 0.0, 1.0)`. For 90 degrees around the Y axis use `(0.0, 0.707, 0.0, 0.707)`.

**Returns:** null

**Example:**
```
bench.setRotation(0.0, 0.707, 0.0, 0.707);  // Rotated 90 degrees around Y axis
```

---

### object.setScale(x, y, z)

Sets the object's scale on each axis. 1.0 is the original model size.

**Parameters:** `x`, `y`, `z` (float) — Scale factors. Use equal values for uniform scale.

**Returns:** null

**Example:**
```
tree.setScale(2.0, 2.0, 2.0);  // Double size in all directions
```

---

### object.getPosition()

Returns the object's current position.

**Returns:** A map with `x`, `y`, `z` float fields.

**Example:**
```
var pos = tree.getPosition();
System.print("Tree is at x=" + pos.x);
```

---

### object.getRotation()

Returns the object's current rotation as a quaternion.

**Returns:** A map with `x`, `y`, `z`, `w` float fields.

**Example:**
```
var rot = bench.getRotation();
System.print("W component: " + rot.w);
```

---

### object.getScale()

Returns the object's current scale.

**Returns:** A map with `x`, `y`, `z` float fields.

**Example:**
```
var s = tree.getScale();
System.print("Scale x=" + s.x);
```

---

### object.setAnchor(gpsAnchor)

Attaches this object to a GPS anchor. The object will appear at the real-world GPS location of the anchor.

**Parameters:** `gpsAnchor` — A GPS anchor object created with `GPS.createAnchor()`.

**Returns:** null

**Example:**
```
var anchor = GPS.createAnchor(37.7749, -122.4194, 0.0);
sign.setAnchor(anchor);
```

---

### object.getAnchorPosition()

Returns the world-space position calculated from the object's GPS anchor (if any). If no anchor is set, returns a map with all zeros.

**Returns:** A map with `x`, `y`, `z` float fields representing the local world position of the anchor.

**Example:**
```
var worldPos = sign.getAnchorPosition();
System.print("Anchor world pos x=" + worldPos.x);
```

---

### object.destroy()

Removes the object from the scene and frees its resources. After calling destroy, do not call any further methods on the object.

**Returns:** null

**Example:**
```
tree.destroy();
```

---

## GPS Module

The `GPS` module creates real-world location anchors and queries the player's GPS position.

In the desktop simulator, GPS position is configured via the `--gps-lat`, `--gps-lon`, and `--gps-alt` command-line flags.

### GPS.createAnchor(latitude, longitude, altitude)

Creates a GPS anchor at a real-world coordinate.

**Parameters:**
- `latitude` (float) — Decimal degrees, for example 37.7749 for San Francisco
- `longitude` (float) — Decimal degrees, for example -122.4194 for San Francisco
- `altitude` (float) — Altitude in meters above sea level

**Returns:** A GPS anchor object with `getId()` and `getPosition()` methods.

**Example:**
```
var entrance = GPS.createAnchor(37.7749, -122.4194, 0.0);
statue.setAnchor(entrance);
```

---

### GPS.getPlayerPosition()

Returns the current GPS position of the player (the AR glasses wearer).

**Returns:** A map with `lat`, `lon`, `alt` float fields. In the simulator, returns the position set via `--gps-lat`/`--gps-lon`/`--gps-alt` flags.

**Current status:** `GPS.getPlayerPosition()` requires a GPS tracker initialized in the platform context. If the GPS tracker is not yet wired into the platform, this function returns `null` and script execution continues (it does not halt or raise an error). Use `--gps-lat`/`--gps-lon`/`--gps-alt` flags to seed the simulated position for anchor calculations.

**Example (when GPS tracker is available):**
```
var pos = GPS.getPlayerPosition();
System.print("Player at lat=" + pos.lat + " lon=" + pos.lon);
```

---

### GPS.distance(anchor1, anchor2)

Calculates the distance in meters between two GPS anchors.

**Parameters:** `anchor1`, `anchor2` — GPS anchor objects from `GPS.createAnchor()`.

**Returns:** Distance in meters (float).

**Example:**
```
var a = GPS.createAnchor(37.7749, -122.4194, 0.0);
var b = GPS.createAnchor(37.7750, -122.4193, 0.0);
var dist = GPS.distance(a, b);
System.print("Distance: " + dist + " meters");
```

---

### GPS.bearing(anchor1, anchor2)

Calculates the compass bearing from anchor1 to anchor2.

**Parameters:** `anchor1`, `anchor2` — GPS anchor objects from `GPS.createAnchor()`.

**Returns:** Bearing in degrees (0 to 360, where 0 is north).

**Example:**
```
var start = GPS.createAnchor(37.7749, -122.4194, 0.0);
var end   = GPS.createAnchor(37.7755, -122.4190, 0.0);
var heading = GPS.bearing(start, end);
System.print("Heading: " + heading + " degrees");
```

---

### anchor.getId()

Returns the numeric identifier of the GPS anchor. Each anchor created in a script run gets a unique integer ID starting from 1.

**Returns:** Integer ID.

**Example:**
```
var a = GPS.createAnchor(37.7749, -122.4194, 0.0);
System.print("Anchor ID: " + a.getId());
```

---

### anchor.getPosition()

Returns the GPS coordinates of the anchor.

**Returns:** A map with `lat`, `lon`, `alt` float fields.

**Example:**
```
var a = GPS.createAnchor(37.7749, -122.4194, 0.0);
var pos = a.getPosition();
System.print("Anchor lat=" + pos.lat + " lon=" + pos.lon);
```

---

## Input Module

The `Input` module registers gesture and touch callbacks. Callbacks are functions that fire when the user performs a gesture.

Up to 16 callbacks can be registered per gesture type.

### Input.onTap(handler)

Registers a function to call when the user taps the screen. In the desktop simulator, pressing the Space or Enter key fires a tap event at the center of the screen.

**Parameters:** `handler` (function) — Called with an event object containing `x` and `y` (normalized 0.0–1.0 screen coordinates), plus `dx` and `dy` (always 0.0 for tap).

**Returns:** null

**Example (inline function):**
```
Input.onTap(func(event) {
    System.print("Tap at x=" + event.x + " y=" + event.y);
});
```

**Example (named function — more reliable in current VM):**
```
func handleTap(event) {
    System.print("Tap at x=" + event.x + " y=" + event.y);
}

func main() {
    Input.onTap(handleTap);
    return null;
}
```

---

### Input.onDoubleTap(handler)

Registers a callback for double-tap gestures.

**Parameters:** `handler` (function) — Called with an event object containing `x`, `y`, `dx`, `dy`.

**Returns:** null

**Example:**
```
Input.onDoubleTap(func(event) {
    System.print("Double tap at x=" + event.x);
});
```

---

### Input.onLongPress(handler)

Registers a callback for long press gestures.

**Parameters:** `handler` (function) — Called with an event object containing `x`, `y`, `dx`, `dy`.

**Returns:** null

**Example:**
```
Input.onLongPress(func(event) {
    System.print("Long press at x=" + event.x);
});
```

---

### Input.onSwipe(handler)

Registers a callback for swipe gestures.

**Parameters:** `handler` (function) — Called with an event object containing `x`, `y`, `dx`, `dy`, and `velocity` (float, pixels per second).

**Returns:** null

**Example:**
```
Input.onSwipe(func(event) {
    System.print("Swipe velocity: " + event.velocity);
});
```

---

### Input.onPan(handler)

Registers a callback for pan (drag) gestures.

**Parameters:** `handler` (function) — Called with an event object containing `x`, `y`, `dx`, and `dy` (delta movement in pixels since last event).

**Returns:** null

**Example:**
```
Input.onPan(func(event) {
    System.print("Pan delta dx=" + event.dx + " dy=" + event.dy);
});
```

---

### Input.onPinch(handler)

Registers a callback for pinch-to-zoom gestures.

**Parameters:** `handler` (function) — Called with an event object containing `x`, `y`, `dx`, `dy`, and `scale` (float: 1.0 = no change, greater than 1.0 = expanding, less than 1.0 = contracting).

**Returns:** null

**Example:**
```
Input.onPinch(func(event) {
    var s = object.getScale();
    var ns = s.x * event.scale;
    object.setScale(ns, ns, ns);
});
```

---

## Audio Module

The `Audio` module plays sound files. Supported formats: OGG Vorbis (.ogg) and WAV (.wav). File paths are relative to the world package's `assets/` directory.

> **Desktop simulator note:** Audio file decoding is not yet implemented. `Audio.play()` and `Audio.play3D()` return valid `AudioSource` objects and the state machine works (the source transitions to PLAYING), but no sound is emitted from the speakers. This will be addressed in a future phase.

### Audio.play(filePath)

Plays a non-spatial (stereo) audio file at the same volume everywhere in the scene.

**Parameters:** `filePath` (string) — Path to audio file relative to `assets/`.

**Returns:** An `AudioSource` object.

**Example:**
```
var music = Audio.play("sounds/ambient.ogg");
music.setLoop(true);
music.setVolume(0.5);
```

---

### Audio.play3D(filePath, x, y, z)

Plays a spatially positioned audio source. Volume decreases with distance from the player. Uses equal-power panning in the desktop simulator.

**Parameters:**
- `filePath` (string) — Path to audio file relative to `assets/`
- `x`, `y`, `z` (float) — Position in world space (same coordinate system as object positions)

**Returns:** An `AudioSource` object.

**Example:**
```
var birdSong = Audio.play3D("sounds/birds.ogg", 0.0, 2.0, -5.0);
birdSong.setLoop(true);
```

---

### Audio.setMasterVolume(volume)

Sets the master volume for all audio output.

**Parameters:** `volume` (float) — 0.0 (silent) to 1.0 (full volume).

**Returns:** null

**Example:**
```
Audio.setMasterVolume(0.7);
```

---

### Audio.getMasterVolume()

Returns the current master volume.

**Returns:** Float (0.0 to 1.0).

**Example:**
```
var vol = Audio.getMasterVolume();
System.print("Master volume: " + vol);
```

---

## AudioSource Methods

These methods are called on the object returned by `Audio.play()` or `Audio.play3D()`.

### source.pause()

Pauses playback. Call `resume()` to continue from the same position.

**Returns:** null

**Example:**
```
music.pause();
```

---

### source.stop()

Stops playback and resets to the beginning.

**Returns:** null

**Example:**
```
music.stop();
```

---

### source.resume()

Resumes a paused audio source from where it was paused.

**Returns:** null

**Example:**
```
music.resume();
```

---

### source.setVolume(volume)

Sets the volume of this specific source, independent of master volume.

**Parameters:** `volume` (float) — 0.0 to 1.0.

**Returns:** null

**Example:**
```
music.setVolume(0.3);
```

---

### source.setPosition(x, y, z)

Updates the 3D position of this audio source (for spatial audio created with `Audio.play3D()`).

**Parameters:** `x`, `y`, `z` (float) — New world position.

**Returns:** null

**Example:**
```
birdSong.setPosition(2.0, 1.5, -3.0);
```

---

### source.setLoop(loop)

Sets whether the audio loops when it reaches the end.

**Parameters:** `loop` (boolean) — `true` to loop, `false` to play once.

**Returns:** null

**Example:**
```
music.setLoop(true);
```

---

### source.isPlaying()

Returns whether the source is currently in the PLAYING state.

**Returns:** Boolean.

**Example:**
```
if (music.isPlaying()) {
    System.print("Music is playing");
}
```

---

## Aria Lifecycle Callbacks (Not Yet Implemented)

> **These callbacks are not yet implemented in the current VM.** They are documented here so artists know what is planned. Use `func main()` as the current world entry point.

### Aria.onLoad(handler)

**Status: NOT YET IMPLEMENTED**

Will register a function to call when the world finishes loading and is ready for display.

**Planned use:**
```
// Future — does not work yet
Aria.onLoad(func() {
    System.print("World ready");
});
```

**Current alternative:** Put initialization code at the end of `func main()`. Main runs synchronously after load.

---

### Aria.onUnload(handler)

**Status: NOT YET IMPLEMENTED**

Will register a function to call just before the world is unloaded (when the user navigates away). Intended for cleanup: stopping audio, saving state.

---

### Aria.onUpdate(handler)

**Status: NOT YET IMPLEMENTED**

Will register a function to call every frame, allowing per-frame animation and logic.

**Planned use:**
```
// Future — does not work yet
var angle = 0.0;
Aria.onUpdate(func(dt) {
    angle = angle + (45.0 * dt);
});
```

**Current alternative:** Static scene setup in `func main()`. Frame-by-frame animation is not currently supported.

---

## Known Limitations

- **Audio decoding not implemented.** `Audio.play()` and `Audio.play3D()` return valid source objects (state transitions work), but no sound is emitted from the speakers in the desktop simulator. Tracked for a future phase.
- **GPS.getPlayerPosition() requires GPS tracker.** Unless a GPS tracker is initialized in the platform context, this function returns `null` and script execution continues (it does not raise an error). Anchor placement via `GPS.createAnchor()` works correctly.
- **Lifecycle callbacks not yet implemented.** `Aria.onLoad()`, `Aria.onUnload()`, and `Aria.onUpdate()` are planned but not yet registered in the VM. Use `func main()` as the world entry point.
- **Maximum 16 callbacks per gesture type.** Registering more than 16 handlers for a single gesture type (e.g., 17 `Input.onTap()` calls) will log an error and the extra handlers will not fire.
