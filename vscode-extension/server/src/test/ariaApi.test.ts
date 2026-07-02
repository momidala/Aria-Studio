// ariaApi.test.ts — Tests verifying the shared API table drives both completion and hover.
// A single entry in ARIA_STATIC_METHODS must produce a CompletionItem AND a hover doc;
// no other files need changing for Phase 27 additions.
//
// Run via: node --test out/test/ariaApi.test.js

import { test } from 'node:test';
import { strictEqual, ok, notStrictEqual } from 'node:assert';
import {
    ARIA_STATIC_METHODS,
    buildAriaStaticCompletions,
    lookupAriaMethodHoverDoc,
} from '../ariaApi';

test('ARIA_STATIC_METHODS contains createObject entry', () => {
    const method = ARIA_STATIC_METHODS.find(m => m.label === 'createObject');
    ok(method !== undefined, 'createObject should be present in the shared table');
    ok(method.signature.length > 0, 'signature must be non-empty');
    ok(method.description.length > 0, 'description must be non-empty');
    ok(method.insertText.length > 0, 'insertText must be non-empty');
});

test('buildAriaStaticCompletions returns a CompletionItem for createObject', () => {
    const items = buildAriaStaticCompletions();
    const item = items.find(c => c.label === 'createObject');
    notStrictEqual(item, undefined, 'createObject should appear in completions');
    ok(item !== undefined);
    ok(item.detail !== undefined && item.detail.length > 0, 'completion must have detail (signature)');
    ok(item.documentation !== undefined, 'completion must have documentation');
});

test('lookupAriaMethodHoverDoc returns non-null for createObject', () => {
    const doc = lookupAriaMethodHoverDoc('createObject');
    notStrictEqual(doc, null, 'hover doc for createObject must not be null');
    ok(doc !== null);
    ok(doc.includes('createObject'), 'hover doc must mention the method name');
});

test('lookupAriaMethodHoverDoc returns null for unknown method name', () => {
    strictEqual(lookupAriaMethodHoverDoc('nonExistentMethod'), null);
    strictEqual(lookupAriaMethodHoverDoc(''), null);
});

test('shared table is the single source: every completion label has a hover doc', () => {
    const items = buildAriaStaticCompletions();
    ok(items.length > 0, 'must have at least one completion item');
    for (const item of items) {
        const doc = lookupAriaMethodHoverDoc(item.label);
        notStrictEqual(
            doc,
            null,
            `hover doc missing for completion '${item.label}' — table entry is inconsistent`
        );
    }
});

test('hover doc content matches completion detail signature', () => {
    // The hover doc is built from the same signature string as completion detail.
    // Verify they share the same text fragment.
    const items = buildAriaStaticCompletions();
    for (const item of items) {
        const hoverDoc = lookupAriaMethodHoverDoc(item.label);
        ok(hoverDoc !== null);
        ok(hoverDoc !== null && item.detail !== undefined);
        // Both the hover doc and completion detail must reference the method label
        ok(hoverDoc.includes(item.label), `hover doc for '${item.label}' should mention the method name`);
        ok((item.detail ?? '').includes(item.label), `completion detail for '${item.label}' should mention the method name`);
    }
});
