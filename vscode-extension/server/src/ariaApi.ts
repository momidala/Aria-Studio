// ariaApi.ts — Shared GravityAR API definitions.
// Single source of truth consumed by completion.ts and hover.ts.
//
// Phase 27 expansion: covers every IMPLEMENTED module and instance-method set
// from SPEC-GRAVITYAR-API.md §9 (status tags refreshed 2026-07-02).
//
// SKIPPED — REQUIRED but NOT IMPLEMENTED (must NOT appear as completions):
//   object.addState(name, modelPath)
//   object.setState(name)
//   object.getState()
//   object.onStateChange(handler)
//
// To add new API methods: append entries to the appropriate constant.
// Both completion.ts and hover.ts update automatically — no other file changes needed.

import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    MarkupKind,
} from 'vscode-languageserver/node';

// ─────────────────────────────────────────────────────────────────────────────
// Shared type
// ─────────────────────────────────────────────────────────────────────────────

/** Definition of a single API method — drives both IntelliSense and hover docs. */
export interface AriaMethodDef {
    /** Method name, used as completion label and hover lookup key. */
    readonly label: string;
    /** Full signature shown in completion detail and hover heading. */
    readonly signature: string;
    /** Markdown body for completion documentation popup and hover content. */
    readonly description: string;
    /** VSCode snippet insertion text (may contain ${N:placeholder} tokens). */
    readonly insertText: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aria module — static methods  (SPEC §2)
// 7 methods: createObject, createText, createOccluder, raycast,
//            onLoad, onUnload, onUpdate
// ─────────────────────────────────────────────────────────────────────────────

export const ARIA_STATIC_METHODS: readonly AriaMethodDef[] = [
    {
        label: 'createObject',
        signature: 'Aria.createObject(name: string, modelPath: string) → object | null',
        description:
            'Create a 3D object from a GLB model and place it in the scene.\n\n' +
            '**Parameters:**\n' +
            '- `name` — unique identifier for this object within the world\n' +
            '- `modelPath` — path to GLB file relative to the package\'s `assets/` directory\n\n' +
            '**Returns:** Object handle with transform, anchor, state, and lifecycle methods.' +
            ' Returns `null` if platform context is unavailable or scene node allocation fails.\n\n' +
            '**Path resolution:** artist writes `"models/tree.glb"`, runtime loads' +
            ' `{world_root}/assets/models/tree.glb`.\n\n' +
            '**Example:**\n```gravity\n' +
            'var tree = Aria.createObject("oak_tree", "models/tree.glb");\n' +
            'if (tree != null) {\n' +
            '    tree.setPosition(0.0, 0.0, -5.0);\n' +
            '}\n```',
        insertText: 'createObject("${1:name}", "${2:models/model.glb}")',
    },
    {
        label: 'createText',
        signature: 'Aria.createText(name: string, text: string, fontPath: string) → object | null',
        description:
            'Create a billboard text node. The quad always faces the camera.\n\n' +
            '**Parameters:**\n' +
            '- `name` — unique identifier\n' +
            '- `text` — initial displayed string (max 256 chars)\n' +
            '- `fontPath` — path to .ttf font relative to `assets/`; pass `""` to use bundled FreeSans\n\n' +
            '**Returns:** Object handle — same transform methods as `createObject` plus' +
            ' `setText`, `getText`, `setFontSize`, `setTextColor`.' +
            ' Returns `null` on font load failure or scene allocation failure.\n\n' +
            '**Example:**\n```gravity\n' +
            'var label = Aria.createText("score", "Score: 0", "");\n' +
            'label.setPosition(0.0, 2.0, -3.0);\n```',
        insertText: 'createText("${1:name}", "${2:Hello}", "${3:}")',
    },
    {
        label: 'createOccluder',
        signature: 'Aria.createOccluder(name: string, modelPath: string) → object | null',
        description:
            'Create an occlusion geometry node. The mesh writes to the depth buffer only —' +
            ' invisible but blocks virtual objects rendered behind it.\n\n' +
            '**Parameters:**\n' +
            '- `name` — unique identifier\n' +
            '- `modelPath` — path to .glb model relative to `assets/`\n\n' +
            '**Returns:** Object handle with **transform, anchor, network-state, and destroy only**.' +
            ' Appearance, animation, and physics methods are NOT available on occluder handles' +
            ' — calling them raises a plain-language VM error.\n\n' +
            '**Render order:** Occlusion pre-pass runs before the main color pass.' +
            ' Depth buffer is populated before virtual objects render.\n\n' +
            '**Polygon limit:** Logs a warning at world load if mesh exceeds 100,000 polygons.\n\n' +
            '**Example:**\n```gravity\n' +
            'var wall = Aria.createOccluder("north_wall", "models/wall_occluder.glb");\n' +
            'var anchor = GPS.createAnchor(37.7749, -122.4194, 0.0);\n' +
            'wall.setAnchor(anchor);\n```',
        insertText: 'createOccluder("${1:name}", "${2:models/occluder.glb}")',
    },
    {
        label: 'raycast',
        signature:
            'Aria.raycast(ox: float, oy: float, oz: float, dx: float, dy: float, dz: float) → object | null',
        description:
            'Cast a ray into the scene and return the first hit object.\n\n' +
            '**Parameters:**\n' +
            '- `ox, oy, oz` — ray origin in world space\n' +
            '- `dx, dy, dz` — ray direction (normalized)\n\n' +
            '**Returns:** The first Aria object hit by the ray, or `null` if nothing hit.' +
            ' Tests ray against collision shapes of all objects with rigid bodies.\n\n' +
            '**Example:**\n```gravity\n' +
            'var hit = Aria.raycast(0.0, 1.5, 0.0, 0.0, 0.0, -1.0);\n' +
            'if (hit != null) { System.print("Hit an object!"); }\n```',
        insertText:
            'raycast(${1:0.0}, ${2:1.5}, ${3:0.0}, ${4:0.0}, ${5:0.0}, ${6:-1.0})',
    },
    {
        label: 'onLoad',
        signature: 'Aria.onLoad(handler: function) → null',
        description:
            'Register a callback invoked when world loading completes.\n\n' +
            '**Parameters:**\n' +
            '- `handler` — function with no parameters: `func() { ... }`\n\n' +
            '**When called:** Once, after all assets are loaded and the world is ready for display.' +
            ' Called after `main()` returns. Called exactly once per world load.\n\n' +
            '**Note:** Last registration wins — only one handler active at a time.\n\n' +
            '**Example:**\n```gravity\n' +
            'Aria.onLoad(func() {\n' +
            '    System.print("World ready!");\n' +
            '});\n```',
        insertText: 'onLoad(func() {\n\t${1:// World is ready}\n})',
    },
    {
        label: 'onUnload',
        signature: 'Aria.onUnload(handler: function) → null',
        description:
            'Register a callback invoked before the world is unloaded.\n\n' +
            '**Parameters:**\n' +
            '- `handler` — function with no parameters: `func() { ... }`\n\n' +
            '**When called:** Once, just before the world is unloaded (user quits,' +
            ' navigates away, or new world loads).\n\n' +
            '**Purpose:** Cleanup — stop audio, release resources, save state.\n\n' +
            '**Note:** Best-effort — if the process is killed, this may not fire.\n\n' +
            '**Example:**\n```gravity\n' +
            'Aria.onUnload(func() {\n' +
            '    bgMusic.stop();\n' +
            '});\n```',
        insertText: 'onUnload(func() {\n\t${1:// Cleanup before unload}\n})',
    },
    {
        label: 'onUpdate',
        signature: 'Aria.onUpdate(handler: function) → null',
        description:
            'Register a per-frame callback for animation and game logic.\n\n' +
            '**Parameters:**\n' +
            '- `handler` — function receiving delta time: `func(dt) { ... }` where' +
            ' `dt` is seconds since last frame (float, clamped to 0.1s max)\n\n' +
            '**When called:** Every frame, after input processing, before physics step and render.\n\n' +
            '**Note:** Last registration wins. If the handler throws, the error is logged' +
            ' and the callback is called again next frame.\n\n' +
            '**Example:**\n```gravity\n' +
            'var angle = 0.0;\n' +
            'Aria.onUpdate(func(dt) {\n' +
            '    angle = angle + (45.0 * dt);\n' +
            '    spinner.setRotation(0.0, angle * 0.01745, 0.0, 1.0);\n' +
            '});\n```',
        insertText: 'onUpdate(func(dt) {\n\t${1:// Per-frame logic — dt is seconds since last frame}\n})',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// GPS module — static methods  (SPEC §4)
// 6 methods: createAnchor, getPlayerPosition, distance, bearing,
//            getSolarPosition, calibrateGroundLevel
// ─────────────────────────────────────────────────────────────────────────────

export const GPS_STATIC_METHODS: readonly AriaMethodDef[] = [
    {
        label: 'createAnchor',
        signature: 'GPS.createAnchor(latitude: float, longitude: float, altitude: float) → GPSAnchor',
        description:
            'Create a GPS reference point for anchoring objects at real-world locations.\n\n' +
            '**Parameters:**\n' +
            '- `latitude` — decimal degrees (−90 to 90)\n' +
            '- `longitude` — decimal degrees (−180 to 180)\n' +
            '- `altitude` — meters above sea level\n\n' +
            '**Returns:** GPSAnchor with `getId()` and `getPosition()` methods.' +
            ' Use with `object.setAnchor()` to position objects at real-world coordinates.\n\n' +
            '**Example:**\n```gravity\n' +
            'var anchor = GPS.createAnchor(37.7749, -122.4194, 0.0);\n' +
            'tree.setAnchor(anchor);\n```',
        insertText: 'createAnchor(${1:latitude}, ${2:longitude}, ${3:0.0})',
    },
    {
        label: 'getPlayerPosition',
        signature: 'GPS.getPlayerPosition() → map {lat: float, lon: float, alt: float} | null',
        description:
            'Get the player\'s current GPS position.\n\n' +
            '**Returns:** Map with `lat`, `lon`, `alt` fields, or `null` if GPS is unavailable' +
            ' (no fix, no simulator flags). Does NOT halt script execution.\n\n' +
            '**With GPS hardware:** returns live receiver data.\n' +
            '**With simulator:** returns `--gps-lat`, `--gps-lon`, `--gps-alt` flag values.\n\n' +
            '**Example:**\n```gravity\n' +
            'var pos = GPS.getPlayerPosition();\n' +
            'if (pos != null) {\n' +
            '    System.print("Lat: " + pos.lat);\n' +
            '}\n```',
        insertText: 'getPlayerPosition()',
    },
    {
        label: 'distance',
        signature: 'GPS.distance(anchor1: GPSAnchor, anchor2: GPSAnchor) → float',
        description:
            'Great-circle distance in meters between two GPS anchors (Haversine formula).\n\n' +
            '**Parameters:**\n' +
            '- `anchor1` — first GPSAnchor (from `GPS.createAnchor()`)\n' +
            '- `anchor2` — second GPSAnchor\n\n' +
            '**Example:**\n```gravity\n' +
            'var a = GPS.createAnchor(37.7749, -122.4194, 0.0);\n' +
            'var b = GPS.createAnchor(37.7750, -122.4193, 0.0);\n' +
            'var dist = GPS.distance(a, b); // meters\n```',
        insertText: 'distance(${1:anchor1}, ${2:anchor2})',
    },
    {
        label: 'bearing',
        signature: 'GPS.bearing(anchor1: GPSAnchor, anchor2: GPSAnchor) → float',
        description:
            'Initial compass bearing in degrees (0–360, 0 = north) from anchor1 to anchor2.\n\n' +
            '**Parameters:**\n' +
            '- `anchor1` — origin GPSAnchor\n' +
            '- `anchor2` — destination GPSAnchor\n\n' +
            '**Example:**\n```gravity\n' +
            'var heading = GPS.bearing(playerAnchor, targetAnchor);\n' +
            'System.print("Heading: " + heading + "°");\n```',
        insertText: 'bearing(${1:anchor1}, ${2:anchor2})',
    },
    {
        label: 'getSolarPosition',
        signature:
            'GPS.getSolarPosition() → map {azimuth: float, elevation: float, dir_x: float, dir_y: float, dir_z: float} | null',
        description:
            'Compute the sun\'s current position from GPS latitude/longitude and system time.\n\n' +
            '**Returns:** Map with:\n' +
            '- `azimuth` — degrees 0–360, 0 = north\n' +
            '- `elevation` — degrees −90 to 90; negative = below horizon\n' +
            '- `dir_x/y/z` — normalized world-space direction *from* the sun' +
            ' (suitable for `light.setDirection()`)\n\n' +
            'Returns `null` when no GPS position is available.\n\n' +
            '**Note:** Pure query — always available regardless of whether automatic solar' +
            ' lighting is active. Creating a `Light.createDirectional()` suspends automatic' +
            ' solar updates; destroying it resumes them.\n\n' +
            '**Example:**\n```gravity\n' +
            'var sun = GPS.getSolarPosition();\n' +
            'if (sun != null) {\n' +
            '    myLight.setDirection(sun.dir_x, sun.dir_y, sun.dir_z);\n' +
            '}\n```',
        insertText: 'getSolarPosition()',
    },
    {
        label: 'calibrateGroundLevel',
        signature: 'GPS.calibrateGroundLevel() → bool',
        description:
            'Record the current GPS altitude as the world\'s ground reference level.\n\n' +
            '**Returns:** `true` on success, `false` when no GPS position is available.\n\n' +
            '**Behavior:** After calibration, objects positioned via `object.setAnchor()`' +
            ' clamp their Y coordinate relative to this reference instead of trusting' +
            ' raw (drift-prone) GPS altitude.\n\n' +
            '**Simulator:** `--ground-alt <meters>` sets the reference without hardware.\n\n' +
            '**Example:**\n```gravity\n' +
            '// Artist stands at ground level and calls:\n' +
            'GPS.calibrateGroundLevel();\n```',
        insertText: 'calibrateGroundLevel()',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Input module — static methods  (SPEC §5)
// 6 methods: onTap, onDoubleTap, onLongPress, onSwipe, onPan, onPinch
// ─────────────────────────────────────────────────────────────────────────────

export const INPUT_STATIC_METHODS: readonly AriaMethodDef[] = [
    {
        label: 'onTap',
        signature: 'Input.onTap(handler: function) → null',
        description:
            'Register a callback for single tap (touch down + up within 300ms).\n\n' +
            '**Event fields:** `x`, `y` — screen position normalized 0.0–1.0\n\n' +
            '**Desktop:** left-click or Space/Enter at screen center.\n\n' +
            '**Example:**\n```gravity\n' +
            'Input.onTap(func(event) {\n' +
            '    System.print("Tapped at: " + event.x + ", " + event.y);\n' +
            '});\n```',
        insertText: 'onTap(func(event) {\n\t${1:// event.x, event.y = screen position (0.0–1.0)}\n})',
    },
    {
        label: 'onDoubleTap',
        signature: 'Input.onDoubleTap(handler: function) → null',
        description:
            'Register a callback for double-tap (two taps within 400ms).\n\n' +
            '**Event fields:** `x`, `y` — screen position normalized 0.0–1.0\n\n' +
            '**Desktop:** double left-click.\n\n' +
            '**Example:**\n```gravity\n' +
            'Input.onDoubleTap(func(event) {\n' +
            '    System.print("Double tap!");\n' +
            '});\n```',
        insertText: 'onDoubleTap(func(event) {\n\t${1:// event.x, event.y = screen position (0.0–1.0)}\n})',
    },
    {
        label: 'onLongPress',
        signature: 'Input.onLongPress(handler: function) → null',
        description:
            'Register a callback for long press (touch held > 500ms without significant movement).\n\n' +
            '**Event fields:** `x`, `y` — screen position normalized 0.0–1.0\n\n' +
            '**Example:**\n```gravity\n' +
            'Input.onLongPress(func(event) {\n' +
            '    System.print("Long press at: " + event.x + ", " + event.y);\n' +
            '});\n```',
        insertText: 'onLongPress(func(event) {\n\t${1:// event.x, event.y = screen position (0.0–1.0)}\n})',
    },
    {
        label: 'onSwipe',
        signature: 'Input.onSwipe(handler: function) → null',
        description:
            'Register a callback for swipe gesture (moved > threshold distance with velocity > threshold).\n\n' +
            '**Event fields:** `x`, `y` — screen position; `dx`, `dy` — horizontal/vertical delta;' +
            ' `velocity` — swipe speed in pixels per second\n\n' +
            '**Example:**\n```gravity\n' +
            'Input.onSwipe(func(event) {\n' +
            '    System.print("Swipe velocity: " + event.velocity);\n' +
            '});\n```',
        insertText: 'onSwipe(func(event) {\n\t${1:// event.dx, event.dy, event.velocity}\n})',
    },
    {
        label: 'onPan',
        signature: 'Input.onPan(handler: function) → null',
        description:
            'Register a callback for continuous drag. Called repeatedly with delta movement.\n\n' +
            '**Event fields:** `x`, `y` — current position; `dx`, `dy` — per-event deltas in pixels\n\n' +
            '**Example:**\n```gravity\n' +
            'Input.onPan(func(event) {\n' +
            '    System.print("Dragged by: " + event.dx + ", " + event.dy);\n' +
            '});\n```',
        insertText: 'onPan(func(event) {\n\t${1:// event.dx, event.dy = movement since last event}\n})',
    },
    {
        label: 'onPinch',
        signature: 'Input.onPinch(handler: function) → null',
        description:
            'Register a callback for two-finger pinch/spread gesture.\n\n' +
            '**Event fields:** `x`, `y` — gesture center; `scale` — pinch scale factor' +
            ' (1.0 = no change, >1.0 = expanding, <1.0 = contracting)\n\n' +
            '**Desktop:** scroll wheel.\n\n' +
            '**Example:**\n```gravity\n' +
            'Input.onPinch(func(event) {\n' +
            '    obj.setScale(event.scale, event.scale, event.scale);\n' +
            '});\n```',
        insertText: 'onPinch(func(event) {\n\t${1:// event.scale > 1.0 = expanding, < 1.0 = contracting}\n})',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Audio module — static methods  (SPEC §6)
// 4 methods: play, play3D, setMasterVolume, getMasterVolume
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIO_STATIC_METHODS: readonly AriaMethodDef[] = [
    {
        label: 'play',
        signature: 'Audio.play(filePath: string) → AudioSource',
        description:
            'Play non-spatial (stereo) audio at equal volume regardless of listener position.\n\n' +
            '**Parameters:**\n' +
            '- `filePath` — path to audio file relative to `assets/`. Supported: OGG (.ogg), WAV (.wav)\n\n' +
            '**Returns:** AudioSource object with playback controls.\n\n' +
            '**Example:**\n```gravity\n' +
            'var music = Audio.play("audio/background.ogg");\n' +
            'music.setLoop(true);\n```',
        insertText: 'play("${1:audio/sound.ogg}")',
    },
    {
        label: 'play3D',
        signature: 'Audio.play3D(filePath: string, x: float, y: float, z: float) → AudioSource',
        description:
            'Play spatially positioned audio. Volume attenuates with distance from listener (inverse distance model).\n\n' +
            '**Parameters:**\n' +
            '- `filePath` — audio file path relative to `assets/`\n' +
            '- `x, y, z` — world-space position of the sound source\n\n' +
            '**Returns:** AudioSource object.\n\n' +
            '**Example:**\n```gravity\n' +
            'var waterfall = Audio.play3D("audio/waterfall.ogg", 10.0, 0.0, 5.0);\n```',
        insertText: 'play3D("${1:audio/sound.ogg}", ${2:0.0}, ${3:0.0}, ${4:0.0})',
    },
    {
        label: 'setMasterVolume',
        signature: 'Audio.setMasterVolume(volume: float) → null',
        description:
            'Set master volume applied as multiplier to all audio sources.\n\n' +
            '**Parameters:**\n' +
            '- `volume` — 0.0 (silent) to 1.0 (full)\n\n' +
            '**Example:**\n```gravity\n' +
            'Audio.setMasterVolume(0.7);\n```',
        insertText: 'setMasterVolume(${1:0.7})',
    },
    {
        label: 'getMasterVolume',
        signature: 'Audio.getMasterVolume() → float',
        description:
            'Get current master volume.\n\n' +
            '**Returns:** Current master volume (0.0–1.0).\n\n' +
            '**Example:**\n```gravity\n' +
            'var vol = Audio.getMasterVolume();\n```',
        insertText: 'getMasterVolume()',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Material module — static methods  (SPEC §7)
// 1 method: create
// ─────────────────────────────────────────────────────────────────────────────

export const MATERIAL_STATIC_METHODS: readonly AriaMethodDef[] = [
    {
        label: 'create',
        signature: 'Material.create(name: string) → Material',
        description:
            'Create a material instance for PBR shading.\n\n' +
            '**Parameters:**\n' +
            '- `name` — identifier for this material\n\n' +
            '**Returns:** Material with `setColor`, `setMetallic`, `setRoughness`, `setTexture` methods.' +
            ' Apply to an object with `object.setMaterial(material)`.\n\n' +
            '**Example:**\n```gravity\n' +
            'var mat = Material.create("shiny_metal");\n' +
            'mat.setColor(0.8, 0.8, 0.9);\n' +
            'mat.setMetallic(1.0);\n' +
            'mat.setRoughness(0.1);\n' +
            'cube.setMaterial(mat);\n```',
        insertText: 'create("${1:materialName}")',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Light module — static methods  (SPEC §8)
// 2 methods: createDirectional, createPoint
// Note: point-light rendering is DEFERRED (shader is directional-only in v1.0)
// ─────────────────────────────────────────────────────────────────────────────

export const LIGHT_STATIC_METHODS: readonly AriaMethodDef[] = [
    {
        label: 'createDirectional',
        signature: 'Light.createDirectional(name: string) → Light',
        description:
            'Create a directional light (like sunlight — parallel rays from a direction).\n\n' +
            '**Parameters:**\n' +
            '- `name` — identifier for this light\n\n' +
            '**Returns:** Light with `setColor`, `setIntensity`, `setDirection` methods.\n\n' +
            '**Note:** Creating a directional light **suspends automatic solar lighting**.' +
            ' The engine\'s built-in solar direction/color updates stop until this light is destroyed.\n\n' +
            '**Example:**\n```gravity\n' +
            'var sun = Light.createDirectional("sun");\n' +
            'sun.setColor(1.0, 0.95, 0.8);\n' +
            'sun.setIntensity(2.0);\n' +
            'sun.setDirection(0.3, -0.8, -0.5);\n```',
        insertText: 'createDirectional("${1:lightName}")',
    },
    {
        label: 'createPoint',
        signature: 'Light.createPoint(name: string) → Light',
        description:
            'Create a point light (radiates in all directions from a position).\n\n' +
            '**Parameters:**\n' +
            '- `name` — identifier for this light\n\n' +
            '**Returns:** Light with `setColor`, `setIntensity`, `setPosition` methods.\n\n' +
            '**⚠ v1.0 note:** The API is fully functional, but point-light **rendering is' +
            ' DEFERRED** — the shader is directional-only. Point lights have no visual effect' +
            ' in v1.0. Setters work and will take effect when rendering is implemented.\n\n' +
            '**Example:**\n```gravity\n' +
            'var lamp = Light.createPoint("lamp");\n' +
            'lamp.setColor(1.0, 0.9, 0.7);\n' +
            'lamp.setIntensity(1.5);\n' +
            'lamp.setPosition(2.0, 2.5, -1.0);\n```',
        insertText: 'createPoint("${1:lightName}")',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// AriaObject instance methods — full set
// Returned by Aria.createObject() and Aria.createText()
// 30 methods across transform, anchor, network-state, physics, animation,
//   text, material, and lifecycle
//
// NOT included (REQUIRED, not IMPLEMENTED):
//   addState, setState, getState, onStateChange
// ─────────────────────────────────────────────────────────────────────────────

export const ARIA_OBJECT_INSTANCE_METHODS: readonly AriaMethodDef[] = [
    // ── Transform ────────────────────────────────────────────────────────────
    {
        label: 'setPosition',
        signature: 'object.setPosition(x: float, y: float, z: float) → null',
        description:
            'Set local position in meters. Y is up.\n\n' +
            '**Coordinate system:** X=right, Y=up, Z=back.\n\n' +
            '**Example:**\n```gravity\n' +
            'obj.setPosition(5.0, 1.5, -3.0); // 5m right, 1.5m up, 3m forward\n```',
        insertText: 'setPosition(${1:0.0}, ${2:0.0}, ${3:0.0})',
    },
    {
        label: 'setRotation',
        signature: 'object.setRotation(x: float, y: float, z: float, w: float) → null',
        description:
            'Set local rotation as a unit quaternion.\n\n' +
            '**Identity (no rotation):** `(0.0, 0.0, 0.0, 1.0)`\n\n' +
            '**Example:**\n```gravity\n' +
            'obj.setRotation(0.0, 0.707, 0.0, 0.707); // 90° around Y axis\n```',
        insertText: 'setRotation(${1:0.0}, ${2:0.0}, ${3:0.0}, ${4:1.0})',
    },
    {
        label: 'setScale',
        signature: 'object.setScale(x: float, y: float, z: float) → null',
        description:
            'Set scale. `(1.0, 1.0, 1.0)` = original model size.\n\n' +
            '**Example:**\n```gravity\nobj.setScale(2.0, 2.0, 2.0); // twice as large\n```',
        insertText: 'setScale(${1:1.0}, ${2:1.0}, ${3:1.0})',
    },
    {
        label: 'getPosition',
        signature: 'object.getPosition() → map {x: float, y: float, z: float}',
        description:
            'Get current position.\n\n' +
            '**Returns:** Map with `x`, `y`, `z` fields.\n\n' +
            '**Example:**\n```gravity\n' +
            'var pos = obj.getPosition();\nSystem.print("X: " + pos.x);\n```',
        insertText: 'getPosition()',
    },
    {
        label: 'getRotation',
        signature: 'object.getRotation() → map {x: float, y: float, z: float, w: float}',
        description:
            'Get current rotation as quaternion.\n\n' +
            '**Returns:** Map with `x`, `y`, `z`, `w` fields.',
        insertText: 'getRotation()',
    },
    {
        label: 'getScale',
        signature: 'object.getScale() → map {x: float, y: float, z: float}',
        description:
            'Get current scale.\n\n' +
            '**Returns:** Map with `x`, `y`, `z` fields.',
        insertText: 'getScale()',
    },
    // ── Anchor ───────────────────────────────────────────────────────────────
    {
        label: 'setAnchor',
        signature: 'object.setAnchor(gpsAnchor: GPSAnchor) → null',
        description:
            'Attach the object to a GPS anchor. The object\'s position is overridden' +
            ' to the anchor\'s local-space position (computed from GPS coordinates' +
            ' relative to world origin).\n\n' +
            '**Example:**\n```gravity\n' +
            'var anchor = GPS.createAnchor(37.7749, -122.4194, 0.0);\n' +
            'tree.setAnchor(anchor);\n```',
        insertText: 'setAnchor(${1:anchor})',
    },
    {
        label: 'getAnchorPosition',
        signature: 'object.getAnchorPosition() → map {x: float, y: float, z: float}',
        description:
            'Get world-space position derived from GPS anchor.\n\n' +
            '**Returns:** Map with `x`, `y`, `z`. If no anchor is set, returns `{x:0, y:0, z:0}`.',
        insertText: 'getAnchorPosition()',
    },
    // ── Network State ─────────────────────────────────────────────────────────
    {
        label: 'setNetworkState',
        signature: 'object.setNetworkState(key: string, value: any) → null',
        description:
            'Set a local key-value state entry and broadcast it in multiuser worlds.\n\n' +
            '**Parameters:**\n' +
            '- `key` — state key name\n' +
            '- `value` — any Gravity-serializable value (string, number, boolean, null)\n\n' +
            '**Behavior:** In single-user or offline mode, updates local state only.' +
            ' In multiuser mode, sends an `ObjectStateChange` FlatBuffers message that' +
            ' the server broadcasts to all other clients.\n\n' +
            '**Note:** Distinct from `addState`/`setState` (mesh-swap state, REQUIRED but not yet' +
            ' implemented). This is network key-value state.\n\n' +
            '**Example:**\n```gravity\n' +
            'box.setNetworkState("grabbed", "player_1");\n```',
        insertText: 'setNetworkState("${1:key}", ${2:value})',
    },
    {
        label: 'getNetworkState',
        signature: 'object.getNetworkState(key: string) → any',
        description:
            'Get the current value for a network state key.\n\n' +
            '**Returns:** The last value set via `setNetworkState` or received via' +
            ' `ObjectStateBroadcast`, or `null` if key is not set.\n\n' +
            '**Example:**\n```gravity\n' +
            'var who = box.getNetworkState("grabbed");\n```',
        insertText: 'getNetworkState("${1:key}")',
    },
    // ── Physics ───────────────────────────────────────────────────────────────
    {
        label: 'addRigidBody',
        signature: 'object.addRigidBody(type: string) → null',
        description:
            'Attach a rigid body for physics simulation.\n\n' +
            '**Parameters:**\n' +
            '- `type` — `"static"` (immovable), `"dynamic"` (simulated), `"kinematic"` (script-controlled)\n\n' +
            '**Note:** Must be called before `addCollisionShape`. Position/rotation sync' +
            ' between scene node and physics body occurs each frame.\n\n' +
            '**Example:**\n```gravity\n' +
            'crate.addRigidBody("dynamic");\n' +
            'crate.addCollisionShape("box");\n' +
            'crate.setMass(10.0);\n```',
        insertText: 'addRigidBody("${1|static,dynamic,kinematic|}")',
    },
    {
        label: 'addCollisionShape',
        signature: 'object.addCollisionShape(shape: string) → null',
        description:
            'Add a collision shape. Dimensions derived from the GLB\'s bounding box or convex hull.\n\n' +
            '**Parameters:**\n' +
            '- `shape` — `"box"`, `"sphere"`, or `"convex"`. In v1.0 sphere/convex warn and fall back to box.\n\n' +
            '**Prerequisite:** `addRigidBody` must be called first.\n\n' +
            '**Example:**\n```gravity\nobj.addCollisionShape("box");\n```',
        insertText: 'addCollisionShape("${1|box,sphere,convex|}")',
    },
    {
        label: 'setMass',
        signature: 'object.setMass(mass: float) → null',
        description:
            'Set mass in kilograms.\n\n' +
            '**Parameters:**\n' +
            '- `mass` — kilograms. 0.0 = static (infinite mass).\n\n' +
            '**Example:**\n```gravity\nobj.setMass(5.0);\n```',
        insertText: 'setMass(${1:1.0})',
    },
    {
        label: 'applyForce',
        signature: 'object.applyForce(x: float, y: float, z: float) → null',
        description:
            'Apply a continuous force (Newtons) at the center of mass. Takes effect over the next physics step.\n\n' +
            '**Example:**\n```gravity\nobj.applyForce(0.0, 9.8, 0.0); // upward force\n```',
        insertText: 'applyForce(${1:0.0}, ${2:0.0}, ${3:0.0})',
    },
    {
        label: 'applyImpulse',
        signature: 'object.applyImpulse(x: float, y: float, z: float) → null',
        description:
            'Apply an instantaneous impulse (Newton-seconds). Changes velocity immediately.\n\n' +
            '**Example:**\n```gravity\nobj.applyImpulse(0.0, 5.0, 0.0); // toss upward\n```',
        insertText: 'applyImpulse(${1:0.0}, ${2:0.0}, ${3:0.0})',
    },
    {
        label: 'applyTorque',
        signature: 'object.applyTorque(x: float, y: float, z: float) → null',
        description:
            'Apply torque (rotational force) at the center of mass. Takes effect over the next physics step.\n\n' +
            '**Example:**\n```gravity\nobj.applyTorque(0.0, 1.0, 0.0); // spin around Y\n```',
        insertText: 'applyTorque(${1:0.0}, ${2:0.0}, ${3:0.0})',
    },
    {
        label: 'setVelocity',
        signature: 'object.setVelocity(x: float, y: float, z: float) → null',
        description:
            'Set linear velocity directly (m/s).\n\n' +
            '**Example:**\n```gravity\nobj.setVelocity(0.0, 0.0, -2.0); // moving forward at 2 m/s\n```',
        insertText: 'setVelocity(${1:0.0}, ${2:0.0}, ${3:0.0})',
    },
    {
        label: 'onCollision',
        signature: 'object.onCollision(handler: function) → null',
        description:
            'Register a callback invoked once per frame a collision begins.\n\n' +
            '**Handler receives:** `(other, contactPoint)` where `other` is the colliding' +
            ' Aria object and `contactPoint` is a map `{x, y, z}` in world space.\n\n' +
            '**When called:** After the physics step, before `onUpdate`. Implemented via' +
            ' deferred queue — the physics contact listener never calls into the Gravity VM directly.\n\n' +
            '**v1.0 scope:** Normal vector and impulse magnitude are not exposed.\n\n' +
            '**Example:**\n```gravity\n' +
            'obj.onCollision(func(other, pt) {\n' +
            '    System.print("Hit at " + pt.x + ", " + pt.y + ", " + pt.z);\n' +
            '});\n```',
        insertText: 'onCollision(func(other, contactPoint) {\n\t${1:// other = colliding object, contactPoint.x/y/z = world-space contact}\n})',
    },
    // ── Animation ─────────────────────────────────────────────────────────────
    {
        label: 'playAnimation',
        signature: 'object.playAnimation(name: string) → null',
        description:
            'Start playing a named animation from the beginning. Replaces any currently playing animation.\n\n' +
            '**Parameters:**\n' +
            '- `name` — animation name from the GLB file. Pass `null` or `""` to play the first animation.\n\n' +
            '**Example:**\n```gravity\n' +
            'character.playAnimation("walk");\n```',
        insertText: 'playAnimation("${1:animationName}")',
    },
    {
        label: 'pauseAnimation',
        signature: 'object.pauseAnimation() → null',
        description:
            'Pause at the current animation frame.\n\n' +
            '**Example:**\n```gravity\nobj.pauseAnimation();\n```',
        insertText: 'pauseAnimation()',
    },
    {
        label: 'stopAnimation',
        signature: 'object.stopAnimation() → null',
        description:
            'Stop animation and reset to the first frame.\n\n' +
            '**Example:**\n```gravity\nobj.stopAnimation();\n```',
        insertText: 'stopAnimation()',
    },
    {
        label: 'setAnimationLoop',
        signature: 'object.setAnimationLoop(loop: bool) → null',
        description:
            'Set whether the current animation loops.\n\n' +
            '**Parameters:**\n' +
            '- `loop` — `true` to repeat, `false` to play once (default)\n\n' +
            '**Example:**\n```gravity\nobj.setAnimationLoop(true);\n```',
        insertText: 'setAnimationLoop(${1:true})',
    },
    {
        label: 'getAnimationNames',
        signature: 'object.getAnimationNames() → list',
        description:
            'Get a list of animation name strings embedded in the GLB file.\n\n' +
            '**Returns:** List of strings. Unnamed animations fall back to `animation_N`.' +
            ' Empty list if no animations.\n\n' +
            '**Example:**\n```gravity\n' +
            'var names = obj.getAnimationNames();\n' +
            'System.print("Animations: " + names);\n```',
        insertText: 'getAnimationNames()',
    },
    {
        label: 'isAnimating',
        signature: 'object.isAnimating() → bool',
        description:
            'Check if an animation is currently playing (not paused, not stopped).\n\n' +
            '**Returns:** `true` if playing.\n\n' +
            '**Example:**\n```gravity\n' +
            'if (!obj.isAnimating()) { obj.playAnimation("idle"); }\n```',
        insertText: 'isAnimating()',
    },
    // ── Text ─────────────────────────────────────────────────────────────────
    {
        label: 'setText',
        signature: 'object.setText(text: string) → null',
        description:
            'Update the displayed text string on a text node (created with `Aria.createText`).\n\n' +
            '**Parameters:**\n' +
            '- `text` — new text (max 256 chars; truncated with a warning if exceeded)\n\n' +
            '**Example:**\n```gravity\nlabel.setText("Score: " + score);\n```',
        insertText: 'setText("${1:text}")',
    },
    {
        label: 'getText',
        signature: 'object.getText() → string',
        description:
            'Get the current displayed text string (post-truncation if applicable).\n\n' +
            '**Example:**\n```gravity\nvar t = label.getText();\n```',
        insertText: 'getText()',
    },
    {
        label: 'setFontSize',
        signature: 'object.setFontSize(size: float) → null',
        description:
            'Set font size in points. Affects billboard size in world space.\n\n' +
            '**Example:**\n```gravity\nlabel.setFontSize(24.0);\n```',
        insertText: 'setFontSize(${1:24.0})',
    },
    {
        label: 'setTextColor',
        signature: 'object.setTextColor(r: float, g: float, b: float, a: float) → null',
        description:
            'Set text color. Each channel 0.0–1.0.\n\n' +
            '**Example:**\n```gravity\nlabel.setTextColor(1.0, 1.0, 0.0, 1.0); // yellow\n```',
        insertText: 'setTextColor(${1:1.0}, ${2:1.0}, ${3:1.0}, ${4:1.0})',
    },
    // ── Material ──────────────────────────────────────────────────────────────
    {
        label: 'setMaterial',
        signature: 'object.setMaterial(material: Material) → null',
        description:
            'Apply a Material instance to this object, overriding the GLB\'s built-in material.\n\n' +
            '**Example:**\n```gravity\n' +
            'var mat = Material.create("glow");\n' +
            'mat.setColor(0.0, 1.0, 0.0);\n' +
            'obj.setMaterial(mat);\n```',
        insertText: 'setMaterial(${1:material})',
    },
    // ── Lifecycle ─────────────────────────────────────────────────────────────
    {
        label: 'destroy',
        signature: 'object.destroy() → null',
        description:
            'Remove the object from the scene graph, free GPU resources (mesh, textures),' +
            ' and free any physics body. After calling `destroy`, do not call any further' +
            ' methods on this object.\n\n' +
            '**Example:**\n```gravity\nobj.destroy();\n```',
        insertText: 'destroy()',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Occluder instance methods — restricted subset
// Returned by Aria.createOccluder()
// 11 methods: transform + anchor + network-state + destroy ONLY
//
// Blocked on occluder handles (raise VM error if called):
//   appearance methods, animation, physics, text methods, setMaterial
// ─────────────────────────────────────────────────────────────────────────────

export const OCCLUDER_INSTANCE_METHODS: readonly AriaMethodDef[] = [
    // ── Transform ────────────────────────────────────────────────────────────
    {
        label: 'setPosition',
        signature: 'occluder.setPosition(x: float, y: float, z: float) → null',
        description: 'Set occluder position in world space (meters). Y is up.',
        insertText: 'setPosition(${1:0.0}, ${2:0.0}, ${3:0.0})',
    },
    {
        label: 'setRotation',
        signature: 'occluder.setRotation(x: float, y: float, z: float, w: float) → null',
        description: 'Set occluder rotation as quaternion. Identity: `(0, 0, 0, 1)`.',
        insertText: 'setRotation(${1:0.0}, ${2:0.0}, ${3:0.0}, ${4:1.0})',
    },
    {
        label: 'setScale',
        signature: 'occluder.setScale(x: float, y: float, z: float) → null',
        description: 'Set occluder scale. `(1, 1, 1)` = original model size.',
        insertText: 'setScale(${1:1.0}, ${2:1.0}, ${3:1.0})',
    },
    {
        label: 'getPosition',
        signature: 'occluder.getPosition() → map {x: float, y: float, z: float}',
        description: 'Get current occluder position.',
        insertText: 'getPosition()',
    },
    {
        label: 'getRotation',
        signature: 'occluder.getRotation() → map {x: float, y: float, z: float, w: float}',
        description: 'Get current occluder rotation as quaternion.',
        insertText: 'getRotation()',
    },
    {
        label: 'getScale',
        signature: 'occluder.getScale() → map {x: float, y: float, z: float}',
        description: 'Get current occluder scale.',
        insertText: 'getScale()',
    },
    // ── Anchor ───────────────────────────────────────────────────────────────
    {
        label: 'setAnchor',
        signature: 'occluder.setAnchor(gpsAnchor: GPSAnchor) → null',
        description: 'Attach the occluder mesh to a GPS anchor for real-world positioning.',
        insertText: 'setAnchor(${1:anchor})',
    },
    {
        label: 'getAnchorPosition',
        signature: 'occluder.getAnchorPosition() → map {x: float, y: float, z: float}',
        description: 'Get world-space position derived from GPS anchor.',
        insertText: 'getAnchorPosition()',
    },
    // ── Network State ─────────────────────────────────────────────────────────
    {
        label: 'setNetworkState',
        signature: 'occluder.setNetworkState(key: string, value: any) → null',
        description: 'Set a network state key-value pair (synchronized in multiuser worlds).',
        insertText: 'setNetworkState("${1:key}", ${2:value})',
    },
    {
        label: 'getNetworkState',
        signature: 'occluder.getNetworkState(key: string) → any',
        description: 'Get the current value for a network state key.',
        insertText: 'getNetworkState("${1:key}")',
    },
    // ── Lifecycle ─────────────────────────────────────────────────────────────
    {
        label: 'destroy',
        signature: 'occluder.destroy() → null',
        description:
            'Remove the occluder from the scene graph and free GPU resources.' +
            ' Do not call further methods after destroy.',
        insertText: 'destroy()',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// AudioSource instance methods  (SPEC §6.5)
// 7 methods: pause, stop, resume, setVolume, setPosition, setLoop, isPlaying
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIO_SOURCE_INSTANCE_METHODS: readonly AriaMethodDef[] = [
    {
        label: 'pause',
        signature: 'source.pause() → null',
        description:
            'Pause playback at current position.\n\n' +
            '**Example:**\n```gravity\nbgMusic.pause();\n```',
        insertText: 'pause()',
    },
    {
        label: 'stop',
        signature: 'source.stop() → null',
        description:
            'Stop playback and reset to the beginning.\n\n' +
            '**Example:**\n```gravity\nbgMusic.stop();\n```',
        insertText: 'stop()',
    },
    {
        label: 'resume',
        signature: 'source.resume() → null',
        description:
            'Resume from paused position.\n\n' +
            '**Example:**\n```gravity\nbgMusic.resume();\n```',
        insertText: 'resume()',
    },
    {
        label: 'setVolume',
        signature: 'source.setVolume(volume: float) → null',
        description:
            'Set per-source volume (0.0–1.0), independent of master volume.\n\n' +
            '**Example:**\n```gravity\nbgMusic.setVolume(0.5);\n```',
        insertText: 'setVolume(${1:0.7})',
    },
    {
        label: 'setPosition',
        signature: 'source.setPosition(x: float, y: float, z: float) → null',
        description:
            'Update the 3D world-space position of this audio source (for `Audio.play3D` sources).\n\n' +
            '**Example:**\n```gravity\n' +
            'sound.setPosition(obj.getPosition().x, obj.getPosition().y, obj.getPosition().z);\n```',
        insertText: 'setPosition(${1:0.0}, ${2:0.0}, ${3:0.0})',
    },
    {
        label: 'setLoop',
        signature: 'source.setLoop(loop: bool) → null',
        description:
            'Enable or disable looping.\n\n' +
            '**Parameters:**\n' +
            '- `loop` — `true` = repeat forever, `false` = play once\n\n' +
            '**Example:**\n```gravity\nbgMusic.setLoop(true);\n```',
        insertText: 'setLoop(${1:true})',
    },
    {
        label: 'isPlaying',
        signature: 'source.isPlaying() → bool',
        description:
            'Check if this source is currently playing (not paused, not stopped).\n\n' +
            '**Returns:** `true` if state is PLAYING.\n\n' +
            '**Example:**\n```gravity\n' +
            'if (!bgMusic.isPlaying()) { bgMusic.resume(); }\n```',
        insertText: 'isPlaying()',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Material instance methods  (SPEC §7)
// 4 methods: setColor, setMetallic, setRoughness, setTexture
// ─────────────────────────────────────────────────────────────────────────────

export const MATERIAL_INSTANCE_METHODS: readonly AriaMethodDef[] = [
    {
        label: 'setColor',
        signature: 'material.setColor(r: float, g: float, b: float) → null',
        description:
            'Set base color. Each channel 0.0–1.0.\n\n' +
            '**Example:**\n```gravity\nmat.setColor(0.8, 0.2, 0.1); // reddish\n```',
        insertText: 'setColor(${1:1.0}, ${2:1.0}, ${3:1.0})',
    },
    {
        label: 'setMetallic',
        signature: 'material.setMetallic(value: float) → null',
        description:
            'Set metallic factor (0.0 = dielectric, 1.0 = fully metallic).\n\n' +
            '**Example:**\n```gravity\nmat.setMetallic(1.0);\n```',
        insertText: 'setMetallic(${1:0.0})',
    },
    {
        label: 'setRoughness',
        signature: 'material.setRoughness(value: float) → null',
        description:
            'Set roughness factor (0.0 = mirror, 1.0 = fully diffuse).\n\n' +
            '**Example:**\n```gravity\nmat.setRoughness(0.3);\n```',
        insertText: 'setRoughness(${1:0.5})',
    },
    {
        label: 'setTexture',
        signature: 'material.setTexture(path: string) → null',
        description:
            'Set base color texture. Path is relative to `assets/`.\n\n' +
            '**Example:**\n```gravity\nmat.setTexture("textures/wood.png");\n```',
        insertText: 'setTexture("${1:textures/texture.png}")',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Light instance methods  (SPEC §8)
// 4 methods: setColor, setIntensity, setDirection, setPosition
// ─────────────────────────────────────────────────────────────────────────────

export const LIGHT_INSTANCE_METHODS: readonly AriaMethodDef[] = [
    {
        label: 'setColor',
        signature: 'light.setColor(r: float, g: float, b: float) → null',
        description:
            'Set light color. Each channel 0.0–1.0.\n\n' +
            '**Example:**\n```gravity\nlight.setColor(1.0, 0.95, 0.8); // warm sunlight\n```',
        insertText: 'setColor(${1:1.0}, ${2:1.0}, ${3:1.0})',
    },
    {
        label: 'setIntensity',
        signature: 'light.setIntensity(value: float) → null',
        description:
            'Set light brightness.\n\n' +
            '**Example:**\n```gravity\nlight.setIntensity(2.0);\n```',
        insertText: 'setIntensity(${1:1.0})',
    },
    {
        label: 'setDirection',
        signature: 'light.setDirection(x: float, y: float, z: float) → null',
        description:
            'Set direction for directional lights. Vector points *from* light *toward* scene.\n\n' +
            '**Tip:** Use `GPS.getSolarPosition().dir_x/y/z` for accurate sun direction.\n\n' +
            '**Example:**\n```gravity\nlight.setDirection(0.3, -0.8, -0.5);\n```',
        insertText: 'setDirection(${1:0.3}, ${2:-0.8}, ${3:-0.5})',
    },
    {
        label: 'setPosition',
        signature: 'light.setPosition(x: float, y: float, z: float) → null',
        description:
            'Set position for point lights.\n\n' +
            '**⚠ v1.0 note:** Point-light rendering is DEFERRED — no visual effect in v1.0.\n\n' +
            '**Example:**\n```gravity\nlight.setPosition(2.0, 2.5, -1.0);\n```',
        insertText: 'setPosition(${1:0.0}, ${2:2.0}, ${3:0.0})',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// GPSAnchor instance methods  (SPEC §4.7)
// 2 methods: getId, getPosition
// ─────────────────────────────────────────────────────────────────────────────

export const GPS_ANCHOR_INSTANCE_METHODS: readonly AriaMethodDef[] = [
    {
        label: 'getId',
        signature: 'anchor.getId() → int',
        description:
            'Get the unique integer ID for this anchor (1, 2, 3, ... in creation order).\n\n' +
            '**Example:**\n```gravity\nSystem.print("Anchor ID: " + anchor.getId());\n```',
        insertText: 'getId()',
    },
    {
        label: 'getPosition',
        signature: 'anchor.getPosition() → map {lat: float, lon: float, alt: float}',
        description:
            'Get the GPS coordinates of this anchor.\n\n' +
            '**Returns:** Map with `lat`, `lon`, `alt` fields.\n\n' +
            '**Example:**\n```gravity\n' +
            'var pos = anchor.getPosition();\n' +
            'System.print("Lat: " + pos.lat);\n```',
        insertText: 'getPosition()',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Flat union — all methods across all tables (first match wins in hover lookup)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flat array of all IMPLEMENTED API methods — used by hover.ts for word lookup.
 * Ordering: static methods first (authoritative docs), then instance methods.
 * When the same label appears in multiple tables, the first definition wins.
 */
export const ALL_API_METHODS: readonly AriaMethodDef[] = [
    ...ARIA_STATIC_METHODS,
    ...GPS_STATIC_METHODS,
    ...INPUT_STATIC_METHODS,
    ...AUDIO_STATIC_METHODS,
    ...MATERIAL_STATIC_METHODS,
    ...LIGHT_STATIC_METHODS,
    // Instance methods after static so that, e.g., GPS.createAnchor wins over anchor.getPosition
    // for the 'createAnchor' label, and static 'setColor' labels don't shadow module docs.
    ...ARIA_OBJECT_INSTANCE_METHODS,
    ...AUDIO_SOURCE_INSTANCE_METHODS,
    ...MATERIAL_INSTANCE_METHODS,
    ...LIGHT_INSTANCE_METHODS,
    ...GPS_ANCHOR_INSTANCE_METHODS,
    // OCCLUDER_INSTANCE_METHODS not included here to avoid duplicate label conflicts;
    // occluder methods are a strict subset of ARIA_OBJECT_INSTANCE_METHODS labels.
];

// ─────────────────────────────────────────────────────────────────────────────
// Generic builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a CompletionItem array from any method table.
 * Consumed by completion.ts — do not call directly from hover.ts.
 */
export function buildCompletions(methods: readonly AriaMethodDef[]): CompletionItem[] {
    return methods.map((m): CompletionItem => ({
        label: m.label,
        kind: CompletionItemKind.Method,
        detail: m.signature,
        documentation: {
            kind: MarkupKind.Markdown,
            value: m.description,
        },
        insertText: m.insertText,
        insertTextFormat: InsertTextFormat.Snippet,
    }));
}

/**
 * Look up hover documentation for a method by name, searching a given table.
 * Returns null if the method is not in the table.
 */
export function lookupHoverDoc(
    methods: readonly AriaMethodDef[],
    methodName: string,
): string | null {
    const method = methods.find(m => m.label === methodName);
    if (!method) return null;
    return `**${method.signature}**\n\n${method.description}`;
}
