import { Hover, HoverParams, MarkupKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { lookupAriaMethodHoverDoc } from './ariaApi';

export function getHoverInfo(params: HoverParams, document: TextDocument): Hover | null {
    const position = params.position;
    const text = document.getText();
    const offset = document.offsetAt(position);

    // Get word at position
    const word = getWordAtPosition(text, offset);
    if (!word) {
        return null;
    }

    // Look up documentation
    const doc = getDocumentation(word);
    if (!doc) {
        return null;
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: doc,
        },
    };
}

function getWordAtPosition(text: string, offset: number): string | null {
    // Find word boundaries
    let start = offset;
    let end = offset;

    // Scan backwards
    while (start > 0 && /\w/.test(text[start - 1])) {
        start--;
    }

    // Scan forwards
    while (end < text.length && /\w/.test(text[end])) {
        end++;
    }

    if (start === end) {
        return null;
    }

    return text.substring(start, end);
}

function getDocumentation(word: string): string | null {
    // Aria static methods — sourced from the shared API table (ariaApi.ts).
    // Phase 27 adds entries there; hover is updated automatically.
    const ariaDoc = lookupAriaMethodHoverDoc(word);
    if (ariaDoc !== null) return ariaDoc;

    // All other documented symbols
    const docs: { [key: string]: string } = {
        // Classes
        'Aria': '**Aria** - AR Object Creation Module\n\nCreate and manipulate 3D objects in the AR world.\n\n**Methods:**\n- `createObject(name, modelPath)` - Create new 3D object',
        'GPS': '**GPS** - Positioning and Anchoring Module\n\nGPS-based positioning for outdoor AR worlds.\n\n**Methods:**\n- `createAnchor(lat, lon, alt)` - Create GPS anchor\n- `distance(lat1, lon1, lat2, lon2)` - Calculate distance\n- `bearing(lat1, lon1, lat2, lon2)` - Calculate bearing\n- `getPlayerPosition()` - Get user GPS location',
        'Input': '**Input** - Touch and Gesture Module\n\nRespond to user touch gestures.\n\n**Methods:**\n- `onTap(callback)` - Register tap handler\n- `onDoubleTap(callback)` - Register double-tap handler\n- `onSwipe(callback)` - Register swipe handler\n- `onPinch(callback)` - Register pinch handler\n- `onPan(callback)` - Register pan/drag handler',
        'Audio': '**Audio** - Spatial and Stereo Audio Module\n\nPlay 3D spatial audio and stereo sounds.\n\n**Methods:**\n- `play3D(file, x, y, z)` - Play spatial audio at position\n- `play(file)` - Play stereo audio\n- `setMasterVolume(volume)` - Set master volume\n- `getMasterVolume()` - Get master volume',
        'System': '**System** - System Utilities Module\n\nSystem-level functions.\n\n**Methods:**\n- `print(message)` - Print to console',
        'Math': '**Math** - Mathematical Functions Module\n\nStandard math functions.\n\n**Methods:**\n- `sqrt(x)` - Square root\n- `sin(x)` - Sine (radians)\n- `cos(x)` - Cosine (radians)',

        // AriaObject instance methods
        'setPosition': '**setPosition**(x: Float, y: Float, z: Float)\n\nSet object position in meters.\n\n**Y-up coordinate system:** X=right, Y=up, Z=back\n\n**Example:**\n```gravity\nobj.setPosition(5.0, 1.5, -3.0); // 5m right, 1.5m up, 3m forward\n```',
        'setRotation': '**setRotation**(x: Float, y: Float, z: Float, w: Float)\n\nSet object rotation as quaternion.\n\n**Quaternion format:** x, y, z, w components\n**Identity (no rotation):** 0, 0, 0, 1\n\n**Example:**\n```gravity\nobj.setRotation(0.0, 0.707, 0.0, 0.707); // 90 degrees around Y\n```',
        'setScale': '**setScale**(x: Float, y: Float, z: Float)\n\nSet object scale.\n\n**1.0 = original size**\n\n**Example:**\n```gravity\nobj.setScale(2.0, 2.0, 2.0); // Twice as large\n```',
        'getPosition': '**getPosition**() -> Map{x, y, z}\n\nGet current position.\n\n**Returns:** Map with x, y, z fields\n\n**Example:**\n```gravity\nvar pos = obj.getPosition();\nSystem.print("X: " + pos.x);\n```',
        'getRotation': '**getRotation**() -> Map{x, y, z, w}\n\nGet current rotation as quaternion.\n\n**Returns:** Map with x, y, z, w fields',
        'getScale': '**getScale**() -> Map{x, y, z}\n\nGet current scale.\n\n**Returns:** Map with x, y, z fields',
        'setAnchor': '**setAnchor**(anchor: GPSAnchor)\n\nAttach object to GPS anchor for real-world positioning.\n\n**Example:**\n```gravity\nvar anchor = GPS.createAnchor(37.7749, -122.4194, 0.0);\nobj.setAnchor(anchor);\n```',
        'destroy': '**destroy**()\n\nRemove object from world.',

        // GPS methods
        'createAnchor': '**GPS.createAnchor**(lat: Float, lon: Float, alt: Float) -> GPSAnchor\n\nCreate GPS anchor at real-world location.\n\n**Altitude defaults to terrain height**\n\n**Example:**\n```gravity\nvar anchor = GPS.createAnchor(37.7749, -122.4194, 0.0);\n```',
        'distance': '**GPS.distance**(lat1: Float, lon1: Float, lat2: Float, lon2: Float) -> Float\n\nDistance in meters between two GPS points.',
        'bearing': '**GPS.bearing**(lat1: Float, lon1: Float, lat2: Float, lon2: Float) -> Float\n\nCompass bearing in degrees from point 1 to point 2.\n\n**Returns:** 0-360 degrees (0=North, 90=East)',
        'getPlayerPosition': '**GPS.getPlayerPosition**() -> Map{lat, lon, alt}\n\nGet user\'s current GPS position.\n\n**Returns:** Map with lat, lon, alt fields',

        // Input methods
        'onTap': '**Input.onTap**(callback: Closure)\n\nCalled when user taps.\n\n**Event fields:** x, y\n\n**Example:**\n```gravity\nInput.onTap(func(event) {\n    System.print("Tapped at: " + event.x + ", " + event.y);\n});\n```',
        'onDoubleTap': '**Input.onDoubleTap**(callback: Closure)\n\nCalled on double-tap.\n\n**Event fields:** x, y',
        'onSwipe': '**Input.onSwipe**(callback: Closure)\n\nCalled on swipe.\n\n**Event fields:** x, y, dx, dy, velocity',
        'onPinch': '**Input.onPinch**(callback: Closure)\n\nCalled on pinch.\n\n**Event fields:** x, y, scale (scale > 1.0 = zoom in)',
        'onPan': '**Input.onPan**(callback: Closure)\n\nCalled on drag.\n\n**Event fields:** x, y, dx, dy',

        // Audio methods
        'play3D': '**Audio.play3D**(file: String, x: Float, y: Float, z: Float) -> AudioSource\n\nPlay 3D spatial audio at position.\n\n**Sound gets louder as you approach**\n\n**Example:**\n```gravity\nvar sound = Audio.play3D("sounds/waterfall.mp3", 10.0, 0.0, 5.0);\n```',
        'play': '**Audio.play**(file: String) -> AudioSource\n\nPlay non-spatial (stereo) audio.\n\n**Same volume everywhere**',
        'setMasterVolume': '**Audio.setMasterVolume**(volume: Float)\n\nSet master volume.\n\n**Range:** 0.0 to 1.0',
        'getMasterVolume': '**Audio.getMasterVolume**() -> Float\n\nGet current master volume.',

        // AudioSource methods
        'pause': '**pause**()\n\nPause audio playback.',
        'stop': '**stop**()\n\nStop audio playback.',
        'resume': '**resume**()\n\nResume audio playback.',
        'setVolume': '**setVolume**(gain: Float)\n\nSet source volume (0.0 to 1.0).',
        'setLoop': '**setLoop**(loop: Bool)\n\nEnable or disable looping.',
        'isPlaying': '**isPlaying**() -> Bool\n\nCheck if audio is currently playing.',

        // System methods
        'print': '**System.print**(message: String)\n\nPrint message to console.\n\n**Example:**\n```gravity\nSystem.print("World loaded");\n```',

        // Keywords
        'func': '**func** - Function Definition\n\nDefine a function.\n\n**Syntax:**\n```gravity\nfunc functionName(param1, param2) {\n    return value;\n}\n```',
        'var': '**var** - Variable Declaration\n\nDeclare a variable.\n\n**Syntax:**\n```gravity\nvar name = value;\n```',
        'class': '**class** - Class Definition\n\nDefine a class.\n\n**Syntax:**\n```gravity\nclass ClassName {\n    // class body\n}\n```',
        'if': '**if** - Conditional Statement\n\n**Syntax:**\n```gravity\nif (condition) {\n    // code\n}\n```',
        'else': '**else** - Else Clause\n\n**Syntax:**\n```gravity\nif (condition) {\n    // code\n} else {\n    // alternative\n}\n```',
        'while': '**while** - While Loop\n\n**Syntax:**\n```gravity\nwhile (condition) {\n    // code\n}\n```',
        'for': '**for** - For Loop\n\n**Syntax:**\n```gravity\nfor (var i = 0; i < 10; i = i + 1) {\n    // code\n}\n```',
        'return': '**return** - Return Statement\n\nReturn a value from a function.\n\n**Syntax:**\n```gravity\nreturn value;\n```',
    };

    return docs[word] ?? null;
}
