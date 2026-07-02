import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    CompletionParams,
    MarkupKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    buildCompletions,
    GPS_STATIC_METHODS,
    INPUT_STATIC_METHODS,
    AUDIO_STATIC_METHODS,
    MATERIAL_STATIC_METHODS,
    LIGHT_STATIC_METHODS,
    ARIA_OBJECT_INSTANCE_METHODS,
    OCCLUDER_INSTANCE_METHODS,
    AUDIO_SOURCE_INSTANCE_METHODS,
    MATERIAL_INSTANCE_METHODS,
    LIGHT_INSTANCE_METHODS,
    GPS_ANCHOR_INSTANCE_METHODS,
    ARIA_STATIC_METHODS,
} from './ariaApi';

export function getCompletions(params: CompletionParams, document: TextDocument): CompletionItem[] {
    const position = params.position;
    const text = document.getText();
    const offset = document.offsetAt(position);

    // Get text before cursor on current line
    const lineStart = document.offsetAt({ line: position.line, character: 0 });
    const lineText = text.substring(lineStart, offset);

    // Detect completion context — ordered from most specific to most general.

    // Static module completions
    if (lineText.match(/\bAria\.$/)) {
        return buildCompletions(ARIA_STATIC_METHODS);
    } else if (lineText.match(/\bGPS\.$/)) {
        return buildCompletions(GPS_STATIC_METHODS);
    } else if (lineText.match(/\bInput\.$/)) {
        return buildCompletions(INPUT_STATIC_METHODS);
    } else if (lineText.match(/\bAudio\.$/)) {
        return buildCompletions(AUDIO_STATIC_METHODS);
    } else if (lineText.match(/\bMaterial\.$/)) {
        return buildCompletions(MATERIAL_STATIC_METHODS);
    } else if (lineText.match(/\bLight\.$/)) {
        return buildCompletions(LIGHT_STATIC_METHODS);
    } else if (lineText.match(/\bSystem\.$/)) {
        return getSystemMethods();
    } else if (lineText.match(/\bMath\.$/)) {
        return getMathMethods();
    }

    // Instance method completions — check occluder BEFORE generic Aria object
    // so that createOccluder-derived variables get the restricted method set.
    if (detectOccluderInstanceMethod(lineText, text, offset)) {
        return buildCompletions(OCCLUDER_INSTANCE_METHODS);
    } else if (detectAriaInstanceMethod(lineText, text, offset)) {
        return buildCompletions(ARIA_OBJECT_INSTANCE_METHODS);
    } else if (detectAudioSourceInstanceMethod(lineText, text, offset)) {
        return buildCompletions(AUDIO_SOURCE_INSTANCE_METHODS);
    } else if (detectMaterialInstanceMethod(lineText, text, offset)) {
        return buildCompletions(MATERIAL_INSTANCE_METHODS);
    } else if (detectLightInstanceMethod(lineText, text, offset)) {
        return buildCompletions(LIGHT_INSTANCE_METHODS);
    } else if (detectGPSAnchorInstanceMethod(lineText, text, offset)) {
        return buildCompletions(GPS_ANCHOR_INSTANCE_METHODS);
    }

    // Top-level context: classes + keywords
    return getTopLevelCompletions();
}

// ─────────────────────────────────────────────────────────────────────────────
// Instance-method detectors
// All exported so they can be unit-tested from detector.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect whether the variable being dotted into was assigned from any Aria.create* factory.
 *
 * Uses a wildcard pattern (Aria\.create\w+) so that Aria.createText, Aria.createOccluder,
 * and future factory methods all activate instance-method completions without requiring a
 * code change here. (Phase 27 adds new entries only to ariaApi.ts.)
 *
 * Exported for unit testing.
 */
export function detectAriaInstanceMethod(lineText: string, fullText: string, offset: number): boolean {
    const varMatch = lineText.match(/(\w+)\.$/);
    if (!varMatch) return false;

    const varName = varMatch[1];
    // Wildcard: matches createObject, createText, createOccluder, and any future Aria.create* method
    const pattern = new RegExp(`var\\s+${varName}\\s*=\\s*Aria\\.create\\w+`, 'i');
    return pattern.test(fullText.substring(0, offset));
}

/**
 * Detect whether the variable was specifically assigned from Aria.createOccluder.
 *
 * Must be checked BEFORE detectAriaInstanceMethod in getCompletions() so that
 * occluder-derived variables receive the restricted method set rather than the full
 * AriaObject set.
 *
 * Exported for unit testing.
 */
export function detectOccluderInstanceMethod(lineText: string, fullText: string, offset: number): boolean {
    const varMatch = lineText.match(/(\w+)\.$/);
    if (!varMatch) return false;

    const varName = varMatch[1];
    const pattern = new RegExp(`var\\s+${varName}\\s*=\\s*Aria\\.createOccluder`, 'i');
    return pattern.test(fullText.substring(0, offset));
}

/**
 * Detect whether the variable was assigned from Audio.play or Audio.play3D.
 *
 * Audio.play and Audio.play3D are the only AudioSource-returning methods per spec.
 *
 * Exported for unit testing.
 */
export function detectAudioSourceInstanceMethod(lineText: string, fullText: string, offset: number): boolean {
    const varMatch = lineText.match(/(\w+)\.$/);
    if (!varMatch) return false;

    const varName = varMatch[1];
    const pattern = new RegExp(`var\\s+${varName}\\s*=\\s*Audio\\.(play3D|play)`, 'i');
    return pattern.test(fullText.substring(0, offset));
}

/**
 * Detect whether the variable was assigned from Material.create.
 * Exported for unit testing.
 */
export function detectMaterialInstanceMethod(lineText: string, fullText: string, offset: number): boolean {
    const varMatch = lineText.match(/(\w+)\.$/);
    if (!varMatch) return false;

    const varName = varMatch[1];
    const pattern = new RegExp(`var\\s+${varName}\\s*=\\s*Material\\.create`, 'i');
    return pattern.test(fullText.substring(0, offset));
}

/**
 * Detect whether the variable was assigned from Light.createDirectional or Light.createPoint.
 * Exported for unit testing.
 */
export function detectLightInstanceMethod(lineText: string, fullText: string, offset: number): boolean {
    const varMatch = lineText.match(/(\w+)\.$/);
    if (!varMatch) return false;

    const varName = varMatch[1];
    const pattern = new RegExp(`var\\s+${varName}\\s*=\\s*Light\\.create\\w+`, 'i');
    return pattern.test(fullText.substring(0, offset));
}

/**
 * Detect whether the variable was assigned from GPS.createAnchor.
 * Exported for unit testing.
 */
export function detectGPSAnchorInstanceMethod(lineText: string, fullText: string, offset: number): boolean {
    const varMatch = lineText.match(/(\w+)\.$/);
    if (!varMatch) return false;

    const varName = varMatch[1];
    const pattern = new RegExp(`var\\s+${varName}\\s*=\\s*GPS\\.createAnchor`, 'i');
    return pattern.test(fullText.substring(0, offset));
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility completions (System, Math)
// ─────────────────────────────────────────────────────────────────────────────

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
            detail: 'Aria — AR object creation module',
            documentation: {
                kind: MarkupKind.Markdown,
                value:
                    '**Aria** module — creates and manages 3D objects, text, occlusion geometry, and lifecycle callbacks.\n\n' +
                    '**Methods:** `createObject`, `createText`, `createOccluder`, `raycast`,' +
                    ' `onLoad`, `onUnload`, `onUpdate`',
            },
        },
        {
            label: 'GPS',
            kind: CompletionItemKind.Class,
            detail: 'GPS — positioning and anchoring module',
            documentation: {
                kind: MarkupKind.Markdown,
                value:
                    '**GPS** module — GPS anchors, player position, solar position, and ground calibration.\n\n' +
                    '**Methods:** `createAnchor`, `getPlayerPosition`, `distance`, `bearing`,' +
                    ' `getSolarPosition`, `calibrateGroundLevel`',
            },
        },
        {
            label: 'Input',
            kind: CompletionItemKind.Class,
            detail: 'Input — touch and gesture input module',
            documentation: {
                kind: MarkupKind.Markdown,
                value:
                    '**Input** module — gesture event callbacks. Max 16 handlers per gesture type.\n\n' +
                    '**Methods:** `onTap`, `onDoubleTap`, `onLongPress`, `onSwipe`, `onPan`, `onPinch`',
            },
        },
        {
            label: 'Audio',
            kind: CompletionItemKind.Class,
            detail: 'Audio — spatial and stereo audio module',
            documentation: {
                kind: MarkupKind.Markdown,
                value:
                    '**Audio** module — play 3D spatial audio and stereo sounds.\n\n' +
                    '**Methods:** `play`, `play3D`, `setMasterVolume`, `getMasterVolume`',
            },
        },
        {
            label: 'Material',
            kind: CompletionItemKind.Class,
            detail: 'Material — PBR material module',
            documentation: {
                kind: MarkupKind.Markdown,
                value:
                    '**Material** module — create PBR materials to override GLB materials at runtime.\n\n' +
                    '**Methods:** `create(name)`\n\n' +
                    '**Instance methods:** `setColor`, `setMetallic`, `setRoughness`, `setTexture`',
            },
        },
        {
            label: 'Light',
            kind: CompletionItemKind.Class,
            detail: 'Light — scene lighting module',
            documentation: {
                kind: MarkupKind.Markdown,
                value:
                    '**Light** module — create directional and point lights.\n\n' +
                    '**Methods:** `createDirectional`, `createPoint`\n\n' +
                    '**Instance methods:** `setColor`, `setIntensity`, `setDirection`, `setPosition`\n\n' +
                    '**Note:** Creating a directional light suspends automatic solar lighting.' +
                    ' Point-light rendering is DEFERRED in v1.0.',
            },
        },
        {
            label: 'System',
            kind: CompletionItemKind.Class,
            detail: 'System — system utilities',
            documentation: {
                kind: MarkupKind.Markdown,
                value: '**System** module.\n\n**Methods:** `print(message)`',
            },
        },
        {
            label: 'Math',
            kind: CompletionItemKind.Class,
            detail: 'Math — mathematical functions',
            documentation: {
                kind: MarkupKind.Markdown,
                value: '**Math** module.\n\n**Methods:** `sqrt`, `sin`, `cos`',
            },
        },
    ];

    const keywords: CompletionItem[] = [
        { label: 'func', kind: CompletionItemKind.Keyword, detail: 'Define function' },
        { label: 'var', kind: CompletionItemKind.Keyword, detail: 'Declare variable' },
        { label: 'class', kind: CompletionItemKind.Keyword, detail: 'Define class' },
        { label: 'extern', kind: CompletionItemKind.Keyword, detail: 'External class declaration' },
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

