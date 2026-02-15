import { CompletionItem, CompletionItemKind, InsertTextFormat, CompletionParams, MarkupKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function getCompletions(params: CompletionParams, document: TextDocument): CompletionItem[] {
    const position = params.position;
    const text = document.getText();
    const offset = document.offsetAt(position);

    // Get text before cursor on current line
    const lineStart = document.offsetAt({ line: position.line, character: 0 });
    const lineText = text.substring(lineStart, offset);

    // Detect completion context
    if (lineText.match(/\bAria\.$/)) {
        return getAriaStaticMethods();
    } else if (lineText.match(/\bGPS\.$/)) {
        return getGPSMethods();
    } else if (lineText.match(/\bInput\.$/)) {
        return getInputMethods();
    } else if (lineText.match(/\bAudio\.$/)) {
        return getAudioMethods();
    } else if (lineText.match(/\bSystem\.$/)) {
        return getSystemMethods();
    } else if (lineText.match(/\bMath\.$/)) {
        return getMathMethods();
    } else if (detectAriaInstanceMethod(lineText, text, offset)) {
        return getAriaInstanceMethods();
    } else if (detectAudioSourceInstanceMethod(lineText, text, offset)) {
        return getAudioSourceInstanceMethods();
    } else {
        // Top-level context: classes + keywords
        return getTopLevelCompletions();
    }
}

function detectAriaInstanceMethod(lineText: string, fullText: string, offset: number): boolean {
    // Simple heuristic: look for pattern like "var x = Aria.createObject" earlier in file
    // Then detect "x." pattern
    const varMatch = lineText.match(/(\w+)\.$/);
    if (!varMatch) return false;

    const varName = varMatch[1];
    const pattern = new RegExp(`var\\s+${varName}\\s*=\\s*Aria\\.createObject`, 'i');
    return pattern.test(fullText.substring(0, offset));
}

function detectAudioSourceInstanceMethod(lineText: string, fullText: string, offset: number): boolean {
    const varMatch = lineText.match(/(\w+)\.$/);
    if (!varMatch) return false;

    const varName = varMatch[1];
    const pattern = new RegExp(`var\\s+${varName}\\s*=\\s*Audio\\.(play3D|play)`, 'i');
    return pattern.test(fullText.substring(0, offset));
}

function getAriaStaticMethods(): CompletionItem[] {
    return [
        {
            label: 'createObject',
            kind: CompletionItemKind.Method,
            detail: 'Aria.createObject(name: String, model: String) -> AriaObject',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Create a new 3D object in the AR world.\n\n**Parameters:**\n- `name` - Display name for the object\n- `model` - Path to glTF model file (relative to models/)\n\n**Returns:** AriaObject instance with transform methods\n\n**Example:**\n```gravity\nvar tree = Aria.createObject("oak", "models/tree.glb");\ntree.setPosition(5.0, 0.0, -3.0);\n```',
            },
            insertText: 'createObject("${1:name}", "${2:models/model.glb}")',
            insertTextFormat: InsertTextFormat.Snippet,
        },
    ];
}

function getAriaInstanceMethods(): CompletionItem[] {
    return [
        {
            label: 'setPosition',
            kind: CompletionItemKind.Method,
            detail: 'setPosition(x: Float, y: Float, z: Float)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Set object position in meters.\n\n**Y-up coordinate system:** X=right, Y=up, Z=back\n\n**Example:**\n```gravity\nobj.setPosition(5.0, 1.5, -3.0); // 5m right, 1.5m up, 3m forward\n```',
            },
            insertText: 'setPosition(${1:0.0}, ${2:0.0}, ${3:0.0})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'setRotation',
            kind: CompletionItemKind.Method,
            detail: 'setRotation(x: Float, y: Float, z: Float, w: Float)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Set object rotation as quaternion.\n\n**Quaternion format:** x, y, z, w components\n\n**Identity (no rotation):** 0, 0, 0, 1\n\n**Example:**\n```gravity\nobj.setRotation(0.0, 0.707, 0.0, 0.707); // 90 degrees around Y\n```',
            },
            insertText: 'setRotation(${1:0.0}, ${2:0.0}, ${3:0.0}, ${4:1.0})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'setScale',
            kind: CompletionItemKind.Method,
            detail: 'setScale(x: Float, y: Float, z: Float)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Set object scale.\n\n**1.0 = original size**\n\n**Example:**\n```gravity\nobj.setScale(2.0, 2.0, 2.0); // Twice as large\n```',
            },
            insertText: 'setScale(${1:1.0}, ${2:1.0}, ${3:1.0})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'getPosition',
            kind: CompletionItemKind.Method,
            detail: 'getPosition() -> Map{x, y, z}',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Get current position.\n\n**Returns:** Map with x, y, z fields\n\n**Example:**\n```gravity\nvar pos = obj.getPosition();\nSystem.print("X: " + pos.x);\n```',
            },
            insertText: 'getPosition()',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'getRotation',
            kind: CompletionItemKind.Method,
            detail: 'getRotation() -> Map{x, y, z, w}',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Get current rotation as quaternion.\n\n**Returns:** Map with x, y, z, w fields\n\n**Example:**\n```gravity\nvar rot = obj.getRotation();\nSystem.print("W: " + rot.w);\n```',
            },
            insertText: 'getRotation()',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'getScale',
            kind: CompletionItemKind.Method,
            detail: 'getScale() -> Map{x, y, z}',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Get current scale.\n\n**Returns:** Map with x, y, z fields\n\n**Example:**\n```gravity\nvar scale = obj.getScale();\n```',
            },
            insertText: 'getScale()',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'setAnchor',
            kind: CompletionItemKind.Method,
            detail: 'setAnchor(anchor: GPSAnchor)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Attach object to GPS anchor for real-world positioning.\n\n**Example:**\n```gravity\nvar anchor = GPS.createAnchor(37.7749, -122.4194, 0.0);\nobj.setAnchor(anchor);\n```',
            },
            insertText: 'setAnchor(${1:anchor})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'destroy',
            kind: CompletionItemKind.Method,
            detail: 'destroy()',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Remove object from world.\n\n**Example:**\n```gravity\nobj.destroy();\n```',
            },
            insertText: 'destroy()',
            insertTextFormat: InsertTextFormat.Snippet,
        },
    ];
}

function getGPSMethods(): CompletionItem[] {
    return [
        {
            label: 'createAnchor',
            kind: CompletionItemKind.Method,
            detail: 'GPS.createAnchor(lat: Float, lon: Float, alt: Float) -> GPSAnchor',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Create GPS anchor at real-world location.\n\n**Altitude defaults to terrain height**\n\n**Example:**\n```gravity\nvar anchor = GPS.createAnchor(37.7749, -122.4194, 0.0);\n```',
            },
            insertText: 'createAnchor(${1:latitude}, ${2:longitude}, ${3:0.0})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'distance',
            kind: CompletionItemKind.Method,
            detail: 'GPS.distance(lat1: Float, lon1: Float, lat2: Float, lon2: Float) -> Float',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Distance in meters between two GPS points.\n\n**Example:**\n```gravity\nvar dist = GPS.distance(37.7749, -122.4194, 37.7750, -122.4193);\n```',
            },
            insertText: 'distance(${1:lat1}, ${2:lon1}, ${3:lat2}, ${4:lon2})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'bearing',
            kind: CompletionItemKind.Method,
            detail: 'GPS.bearing(lat1: Float, lon1: Float, lat2: Float, lon2: Float) -> Float',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Compass bearing in degrees from point 1 to point 2.\n\n**Returns:** 0-360 degrees (0=North, 90=East)\n\n**Example:**\n```gravity\nvar bearing = GPS.bearing(37.7749, -122.4194, 37.7750, -122.4193);\n```',
            },
            insertText: 'bearing(${1:lat1}, ${2:lon1}, ${3:lat2}, ${4:lon2})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'getPlayerPosition',
            kind: CompletionItemKind.Method,
            detail: 'GPS.getPlayerPosition() -> Map{lat, lon, alt}',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Get user\'s current GPS position.\n\n**Returns:** Map with lat, lon, alt fields\n\n**Example:**\n```gravity\nvar pos = GPS.getPlayerPosition();\nSystem.print("Latitude: " + pos.lat);\n```',
            },
            insertText: 'getPlayerPosition()',
            insertTextFormat: InsertTextFormat.Snippet,
        },
    ];
}

function getInputMethods(): CompletionItem[] {
    return [
        {
            label: 'onTap',
            kind: CompletionItemKind.Method,
            detail: 'Input.onTap(callback: Closure)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Called when user taps.\n\n**Event fields:** x, y\n\n**Example:**\n```gravity\nInput.onTap(func(event) {\n    System.print("Tapped at: " + event.x + ", " + event.y);\n});\n```',
            },
            insertText: 'onTap(func(event) {\n\t${1:// Handle tap}\n})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'onDoubleTap',
            kind: CompletionItemKind.Method,
            detail: 'Input.onDoubleTap(callback: Closure)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Called on double-tap.\n\n**Event fields:** x, y\n\n**Example:**\n```gravity\nInput.onDoubleTap(func(event) {\n    System.print("Double tap!");\n});\n```',
            },
            insertText: 'onDoubleTap(func(event) {\n\t${1:// Handle double tap}\n})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'onSwipe',
            kind: CompletionItemKind.Method,
            detail: 'Input.onSwipe(callback: Closure)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Called on swipe.\n\n**Event fields:** x, y, dx, dy, velocity\n\n**Example:**\n```gravity\nInput.onSwipe(func(event) {\n    System.print("Swipe velocity: " + event.velocity);\n});\n```',
            },
            insertText: 'onSwipe(func(event) {\n\t${1:// Handle swipe}\n})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'onPinch',
            kind: CompletionItemKind.Method,
            detail: 'Input.onPinch(callback: Closure)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Called on pinch.\n\n**Event fields:** x, y, scale (scale > 1.0 = zoom in)\n\n**Example:**\n```gravity\nInput.onPinch(func(event) {\n    obj.setScale(event.scale, event.scale, event.scale);\n});\n```',
            },
            insertText: 'onPinch(func(event) {\n\t${1:// Handle pinch}\n})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'onPan',
            kind: CompletionItemKind.Method,
            detail: 'Input.onPan(callback: Closure)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Called on drag.\n\n**Event fields:** x, y, dx, dy\n\n**Example:**\n```gravity\nInput.onPan(func(event) {\n    System.print("Dragged by: " + event.dx + ", " + event.dy);\n});\n```',
            },
            insertText: 'onPan(func(event) {\n\t${1:// Handle pan}\n})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
    ];
}

function getAudioMethods(): CompletionItem[] {
    return [
        {
            label: 'play3D',
            kind: CompletionItemKind.Method,
            detail: 'Audio.play3D(file: String, x: Float, y: Float, z: Float) -> AudioSource',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Play 3D spatial audio at position.\n\n**Sound gets louder as you approach**\n\n**Example:**\n```gravity\nvar sound = Audio.play3D("sounds/waterfall.mp3", 10.0, 0.0, 5.0);\n```',
            },
            insertText: 'play3D("${1:sounds/audio.mp3}", ${2:0.0}, ${3:0.0}, ${4:0.0})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'play',
            kind: CompletionItemKind.Method,
            detail: 'Audio.play(file: String) -> AudioSource',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Play non-spatial (stereo) audio.\n\n**Same volume everywhere**\n\n**Example:**\n```gravity\nvar music = Audio.play("sounds/background.mp3");\n```',
            },
            insertText: 'play("${1:sounds/audio.mp3}")',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'setMasterVolume',
            kind: CompletionItemKind.Method,
            detail: 'Audio.setMasterVolume(volume: Float)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Set master volume.\n\n**Range:** 0.0 to 1.0\n\n**Example:**\n```gravity\nAudio.setMasterVolume(0.7);\n```',
            },
            insertText: 'setMasterVolume(${1:0.7})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'getMasterVolume',
            kind: CompletionItemKind.Method,
            detail: 'Audio.getMasterVolume() -> Float',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Get current master volume.\n\n**Example:**\n```gravity\nvar vol = Audio.getMasterVolume();\n```',
            },
            insertText: 'getMasterVolume()',
            insertTextFormat: InsertTextFormat.Snippet,
        },
    ];
}

function getAudioSourceInstanceMethods(): CompletionItem[] {
    return [
        {
            label: 'pause',
            kind: CompletionItemKind.Method,
            detail: 'pause()',
            documentation: { kind: MarkupKind.Markdown, value: 'Pause audio playback.' },
            insertText: 'pause()',
        },
        {
            label: 'stop',
            kind: CompletionItemKind.Method,
            detail: 'stop()',
            documentation: { kind: MarkupKind.Markdown, value: 'Stop audio playback.' },
            insertText: 'stop()',
        },
        {
            label: 'resume',
            kind: CompletionItemKind.Method,
            detail: 'resume()',
            documentation: { kind: MarkupKind.Markdown, value: 'Resume audio playback.' },
            insertText: 'resume()',
        },
        {
            label: 'setVolume',
            kind: CompletionItemKind.Method,
            detail: 'setVolume(gain: Float)',
            documentation: { kind: MarkupKind.Markdown, value: 'Set source volume (0.0 to 1.0).' },
            insertText: 'setVolume(${1:0.7})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'setPosition',
            kind: CompletionItemKind.Method,
            detail: 'setPosition(x: Float, y: Float, z: Float)',
            documentation: { kind: MarkupKind.Markdown, value: 'Update 3D position of audio source.' },
            insertText: 'setPosition(${1:0.0}, ${2:0.0}, ${3:0.0})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'setLoop',
            kind: CompletionItemKind.Method,
            detail: 'setLoop(loop: Bool)',
            documentation: { kind: MarkupKind.Markdown, value: 'Enable or disable looping.' },
            insertText: 'setLoop(${1:true})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'isPlaying',
            kind: CompletionItemKind.Method,
            detail: 'isPlaying() -> Bool',
            documentation: { kind: MarkupKind.Markdown, value: 'Check if audio is currently playing.' },
            insertText: 'isPlaying()',
        },
    ];
}

function getSystemMethods(): CompletionItem[] {
    return [
        {
            label: 'print',
            kind: CompletionItemKind.Method,
            detail: 'System.print(message: String)',
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Print message to console.\n\n**Example:**\n```gravity\nSystem.print("World loaded");\n```',
            },
            insertText: 'print("${1:message}")',
            insertTextFormat: InsertTextFormat.Snippet,
        },
    ];
}

function getMathMethods(): CompletionItem[] {
    return [
        {
            label: 'sqrt',
            kind: CompletionItemKind.Method,
            detail: 'Math.sqrt(x: Float) -> Float',
            documentation: { kind: MarkupKind.Markdown, value: 'Square root.' },
            insertText: 'sqrt(${1:x})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'sin',
            kind: CompletionItemKind.Method,
            detail: 'Math.sin(x: Float) -> Float',
            documentation: { kind: MarkupKind.Markdown, value: 'Sine (radians).' },
            insertText: 'sin(${1:x})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
        {
            label: 'cos',
            kind: CompletionItemKind.Method,
            detail: 'Math.cos(x: Float) -> Float',
            documentation: { kind: MarkupKind.Markdown, value: 'Cosine (radians).' },
            insertText: 'cos(${1:x})',
            insertTextFormat: InsertTextFormat.Snippet,
        },
    ];
}

function getTopLevelCompletions(): CompletionItem[] {
    const classes: CompletionItem[] = [
        {
            label: 'Aria',
            kind: CompletionItemKind.Class,
            detail: 'Aria AR object creation',
            documentation: { kind: MarkupKind.Markdown, value: 'Create and manipulate 3D AR objects.' },
        },
        {
            label: 'GPS',
            kind: CompletionItemKind.Class,
            detail: 'GPS positioning and anchoring',
            documentation: { kind: MarkupKind.Markdown, value: 'GPS anchors and location utilities.' },
        },
        {
            label: 'Input',
            kind: CompletionItemKind.Class,
            detail: 'Touch and gesture input',
            documentation: { kind: MarkupKind.Markdown, value: 'Respond to user touch gestures.' },
        },
        {
            label: 'Audio',
            kind: CompletionItemKind.Class,
            detail: 'Spatial and stereo audio',
            documentation: { kind: MarkupKind.Markdown, value: 'Play 3D and stereo audio.' },
        },
        {
            label: 'System',
            kind: CompletionItemKind.Class,
            detail: 'System utilities',
            documentation: { kind: MarkupKind.Markdown, value: 'System functions like print.' },
        },
        {
            label: 'Math',
            kind: CompletionItemKind.Class,
            detail: 'Math utilities',
            documentation: { kind: MarkupKind.Markdown, value: 'Mathematical functions.' },
        },
    ];

    const keywords: CompletionItem[] = [
        { label: 'func', kind: CompletionItemKind.Keyword, detail: 'Define function' },
        { label: 'var', kind: CompletionItemKind.Keyword, detail: 'Declare variable' },
        { label: 'class', kind: CompletionItemKind.Keyword, detail: 'Define class' },
        { label: 'if', kind: CompletionItemKind.Keyword, detail: 'Conditional' },
        { label: 'else', kind: CompletionItemKind.Keyword, detail: 'Else clause' },
        { label: 'while', kind: CompletionItemKind.Keyword, detail: 'While loop' },
        { label: 'for', kind: CompletionItemKind.Keyword, detail: 'For loop' },
        { label: 'return', kind: CompletionItemKind.Keyword, detail: 'Return value' },
        { label: 'true', kind: CompletionItemKind.Keyword, detail: 'Boolean true' },
        { label: 'false', kind: CompletionItemKind.Keyword, detail: 'Boolean false' },
        { label: 'null', kind: CompletionItemKind.Keyword, detail: 'Null value' },
    ];

    return [...classes, ...keywords];
}
