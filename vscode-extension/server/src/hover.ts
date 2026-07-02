import { Hover, HoverParams, MarkupKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { lookupHoverDoc, ALL_API_METHODS } from './ariaApi';

export function getHoverInfo(params: HoverParams, document: TextDocument): Hover | null {
    const position = params.position;
    const text = document.getText();
    const offset = document.offsetAt(position);

    // Get word at cursor position
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
    // All API methods — sourced from the shared table (ariaApi.ts).
    // First match wins; ordering in ALL_API_METHODS puts static methods first.
    const apiDoc = lookupHoverDoc(ALL_API_METHODS, word);
    if (apiDoc !== null) return apiDoc;

    // Module-level and language keyword docs (not in the method table)
    const docs: Record<string, string> = {
        // ── Module class docs ─────────────────────────────────────────────────
        'Aria':
            '**Aria** — AR Object Creation Module\n\n' +
            'Creates and manages 3D objects, text, occlusion geometry, and lifecycle callbacks.\n\n' +
            '**Static methods:**\n' +
            '- `createObject(name, modelPath)` — create a 3D object from a GLB model\n' +
            '- `createText(name, text, fontPath)` — create a billboard text node\n' +
            '- `createOccluder(name, modelPath)` — create a depth-only occlusion mesh\n' +
            '- `raycast(ox, oy, oz, dx, dy, dz)` — cast a ray, return first hit object\n' +
            '- `onLoad(handler)` — callback when world loading completes\n' +
            '- `onUnload(handler)` — callback before world unloads\n' +
            '- `onUpdate(handler)` — per-frame callback (receives `dt` in seconds)',

        'GPS':
            '**GPS** — Positioning and Anchoring Module\n\n' +
            'GPS anchors, player position, solar direction, and ground calibration.\n\n' +
            '**Static methods:**\n' +
            '- `createAnchor(lat, lon, alt)` — create GPS anchor\n' +
            '- `getPlayerPosition()` — get current WGS84 position or null\n' +
            '- `distance(anchor1, anchor2)` — great-circle distance in meters\n' +
            '- `bearing(anchor1, anchor2)` — compass bearing (0–360°)\n' +
            '- `getSolarPosition()` — sun azimuth/elevation/direction from GPS + time\n' +
            '- `calibrateGroundLevel()` — record current GPS altitude as ground reference',

        'Input':
            '**Input** — Touch and Gesture Module\n\n' +
            'Gesture event callbacks. Maximum 16 handlers per gesture type.\n\n' +
            '**Static methods:**\n' +
            '- `onTap(handler)` — single tap\n' +
            '- `onDoubleTap(handler)` — double tap\n' +
            '- `onLongPress(handler)` — hold > 500ms\n' +
            '- `onSwipe(handler)` — fast swipe with velocity\n' +
            '- `onPan(handler)` — continuous drag with dx/dy\n' +
            '- `onPinch(handler)` — two-finger pinch/spread',

        'Audio':
            '**Audio** — Spatial and Stereo Audio Module\n\n' +
            'Play 3D spatial audio and stereo sounds. Decoding via miniaudio (OGG/WAV).\n\n' +
            '**Static methods:**\n' +
            '- `play(filePath)` — play stereo audio, returns AudioSource\n' +
            '- `play3D(filePath, x, y, z)` — play spatially positioned audio, returns AudioSource\n' +
            '- `setMasterVolume(volume)` — set master volume (0.0–1.0)\n' +
            '- `getMasterVolume()` — get current master volume',

        'Material':
            '**Material** — PBR Material Module\n\n' +
            'Create and configure PBR materials for runtime application to objects.\n\n' +
            '**Static methods:**\n' +
            '- `create(name)` — create a Material instance\n\n' +
            '**Instance methods:** `setColor`, `setMetallic`, `setRoughness`, `setTexture`\n\n' +
            '**Apply:** `object.setMaterial(material)`',

        'Light':
            '**Light** — Scene Lighting Module\n\n' +
            'Create directional and point lights. Creating a directional light suspends' +
            ' automatic solar lighting.\n\n' +
            '**Static methods:**\n' +
            '- `createDirectional(name)` — directional light (sun-like)\n' +
            '- `createPoint(name)` — point light (⚠ rendering DEFERRED in v1.0)\n\n' +
            '**Instance methods:** `setColor`, `setIntensity`, `setDirection`, `setPosition`',

        'System':
            '**System** — System Utilities Module\n\n' +
            '**Methods:**\n- `print(message)` — print to console',

        'Math':
            '**Math** — Mathematical Functions Module\n\n' +
            '**Methods:** `sqrt`, `sin`, `cos`',

        // ── Language keywords ─────────────────────────────────────────────────
        'func':
            '**func** — Function Definition\n\n' +
            '**Syntax:**\n```gravity\nfunc functionName(param1, param2) {\n    return value;\n}\n```',
        'var':
            '**var** — Variable Declaration\n\n' +
            '**Syntax:**\n```gravity\nvar name = value;\n```',
        'class':
            '**class** — Class Definition\n\n' +
            '**Syntax:**\n```gravity\nclass ClassName {\n    // class body\n}\n```',
        'extern':
            '**extern** — External Class Declaration\n\n' +
            'Declares a class registered by the host application (THerD) at runtime.\n\n' +
            '**Required at script top:**\n```gravity\nextern class Aria;\nextern class GPS;\nextern class Input;\nextern class Audio;\n```',
        'if':
            '**if** — Conditional Statement\n\n' +
            '**Syntax:**\n```gravity\nif (condition) {\n    // code\n}\n```',
        'else':
            '**else** — Else Clause\n\n' +
            '**Syntax:**\n```gravity\nif (condition) {\n    // code\n} else {\n    // alternative\n}\n```',
        'while':
            '**while** — While Loop\n\n' +
            '**Syntax:**\n```gravity\nwhile (condition) {\n    // code\n}\n```',
        'for':
            '**for** — For Loop\n\n' +
            '**Syntax:**\n```gravity\nfor (var i = 0; i < 10; i = i + 1) {\n    // code\n}\n```',
        'return':
            '**return** — Return Statement\n\n' +
            '**Syntax:**\n```gravity\nreturn value;\n```',
    };

    return docs[word] ?? null;
}
