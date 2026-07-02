// detector.test.ts — Unit tests for the Aria instance-method detector.
// Verifies the wildcard Aria.create\w+ pattern matches all current and future
// factory methods (createObject, createText, createOccluder) and rejects non-create calls.
//
// Run via: node --test out/test/detector.test.js

import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { detectAriaInstanceMethod } from '../completion';

// Helper: simulate cursor being at the very end of text (searches entire file).
function atEnd(text: string): number {
    return text.length;
}

test('matches variable assigned from Aria.createObject', () => {
    const fullText = 'var tree = Aria.createObject("oak_tree", "models/tree.glb");\ntree.';
    const lineText = 'tree.';
    strictEqual(detectAriaInstanceMethod(lineText, fullText, atEnd(fullText)), true);
});

test('matches variable assigned from Aria.createText', () => {
    const fullText = 'var label = Aria.createText("lbl", "Hello", "");\nlabel.';
    const lineText = 'label.';
    strictEqual(detectAriaInstanceMethod(lineText, fullText, atEnd(fullText)), true);
});

test('matches variable assigned from Aria.createOccluder', () => {
    const fullText = 'var wall = Aria.createOccluder("north_wall", "models/wall.glb");\nwall.';
    const lineText = 'wall.';
    strictEqual(detectAriaInstanceMethod(lineText, fullText, atEnd(fullText)), true);
});

test('rejects variable assigned from GPS.createAnchor (not Aria)', () => {
    const fullText = 'var anchor = GPS.createAnchor(37.77, -122.4, 0.0);\nanchor.';
    const lineText = 'anchor.';
    strictEqual(detectAriaInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

test('rejects variable assigned from Aria.raycast (not a create method)', () => {
    const fullText = 'var hit = Aria.raycast(0.0, 0.0, 0.0, 0.0, 0.0, -1.0);\nhit.';
    const lineText = 'hit.';
    strictEqual(detectAriaInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

test('rejects call with no dot-variable pattern in lineText', () => {
    const fullText = 'var tree = Aria.createObject("oak", "models/tree.glb");\nsetPosition';
    const lineText = 'setPosition'; // no trailing dot
    strictEqual(detectAriaInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

test('offset limit is respected — assignment after cursor is ignored', () => {
    // The assignment is AFTER the cursor offset — detector must not see it
    const assignment = 'var tree = Aria.createObject("oak", "models/tree.glb");';
    const before = 'tree.';
    const fullText = before + '\n' + assignment;
    const lineText = 'tree.';
    // offset set to length of 'tree.' only — the assignment comes after
    strictEqual(detectAriaInstanceMethod(lineText, fullText, before.length), false);
});
