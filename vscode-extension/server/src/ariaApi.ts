// ariaApi.ts — Shared Aria static method definitions.
// Single source of truth consumed by both completion.ts and hover.ts.
// To add new API methods (Phase 27): append entries to ARIA_STATIC_METHODS only.
// Both completion and hover automatically reflect additions with no other code changes.

import { CompletionItem, CompletionItemKind, InsertTextFormat, MarkupKind } from 'vscode-languageserver/node';

/** Definition of a single Aria static method — drives both IntelliSense and hover docs. */
export interface AriaMethodDef {
    /** The method name, e.g. 'createObject'. Used as completion label and hover lookup key. */
    readonly label: string;
    /** Full signature string shown in completion detail line and hover heading. */
    readonly signature: string;
    /** Markdown body used for both the completion documentation popup and hover content body. */
    readonly description: string;
    /** VSCode snippet insertion text (may contain ${N:placeholder} tokens). */
    readonly insertText: string;
}

/**
 * Aria static method table — the only place method definitions live.
 *
 * Current entries: methods IMPLEMENTED or REQUIRED through Phase 26.8
 * (SPEC-GRAVITYAR-API.md §2). Phase 27 adds further entries here; no
 * other files need changes to surface them in completion or hover.
 */
export const ARIA_STATIC_METHODS: readonly AriaMethodDef[] = [
    {
        label: 'createObject',
        signature: 'Aria.createObject(name: String, modelPath: String) -> AriaObject | null',
        description:
            'Create a new 3D object in the AR world from a GLB model.\n\n' +
            '**Parameters:**\n' +
            '- `name` — unique identifier for this object within the world\n' +
            '- `modelPath` — path to GLB file relative to the package\'s `assets/` directory\n\n' +
            '**Returns:** AriaObject with transform, anchor, state, and lifecycle methods.' +
            ' Returns `null` if platform context is unavailable or scene node allocation fails.\n\n' +
            '**Example:**\n```gravity\n' +
            'var tree = Aria.createObject("oak_tree", "models/tree.glb");\n' +
            'if (tree != null) {\n' +
            '    tree.setPosition(0.0, 0.0, -5.0);\n' +
            '}\n```',
        insertText: 'createObject("${1:name}", "${2:models/model.glb}")',
    },
];

/**
 * Build a CompletionItem array from the shared method table.
 * Consumed by completion.ts — do not call directly from hover.ts.
 */
export function buildAriaStaticCompletions(): CompletionItem[] {
    return ARIA_STATIC_METHODS.map((m): CompletionItem => ({
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
 * Look up hover documentation for an Aria static method by name.
 * Returns null if the method is not in the shared table.
 * Consumed by hover.ts.
 */
export function lookupAriaMethodHoverDoc(methodName: string): string | null {
    const method = ARIA_STATIC_METHODS.find(m => m.label === methodName);
    if (!method) return null;
    return `**${method.signature}**\n\n${method.description}`;
}
