// detector.test.ts — Unit tests for all Aria API instance-method detectors.
// Verifies factory-pattern matching for every handle kind:
//   AriaObject  → detectAriaInstanceMethod  (Aria.create* wildcard)
//   Occluder    → detectOccluderInstanceMethod (Aria.createOccluder specific)
//   AudioSource → detectAudioSourceInstanceMethod (Audio.play / Audio.play3D)
//   Material    → detectMaterialInstanceMethod (Material.create)
//   Light       → detectLightInstanceMethod (Light.create* wildcard)
//   GPSAnchor   → detectGPSAnchorInstanceMethod (GPS.createAnchor)
//
// Run via: node --test out/test/detector.test.js

import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import {
    detectAriaInstanceMethod,
    detectOccluderInstanceMethod,
    detectAudioSourceInstanceMethod,
    detectMaterialInstanceMethod,
    detectLightInstanceMethod,
    detectGPSAnchorInstanceMethod,
} from '../completion';

// Helper: simulate cursor being at the very end of text.
function atEnd(text: string): number {
    return text.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// detectAriaInstanceMethod — wildcard (matches all Aria.create* factories)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// detectOccluderInstanceMethod — specific to Aria.createOccluder
// ─────────────────────────────────────────────────────────────────────────────

test('detectOccluderInstanceMethod: matches Aria.createOccluder', () => {
    const fullText = 'var wall = Aria.createOccluder("north_wall", "models/wall.glb");\nwall.';
    const lineText = 'wall.';
    strictEqual(detectOccluderInstanceMethod(lineText, fullText, atEnd(fullText)), true);
});

test('detectOccluderInstanceMethod: rejects Aria.createObject (not occluder)', () => {
    const fullText = 'var tree = Aria.createObject("oak", "models/tree.glb");\ntree.';
    const lineText = 'tree.';
    strictEqual(detectOccluderInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

test('detectOccluderInstanceMethod: rejects Aria.createText (not occluder)', () => {
    const fullText = 'var lbl = Aria.createText("lbl", "Hi", "");\nlbl.';
    const lineText = 'lbl.';
    strictEqual(detectOccluderInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

test('detectOccluderInstanceMethod: rejects GPS.createAnchor (wrong module)', () => {
    const fullText = 'var a = GPS.createAnchor(0.0, 0.0, 0.0);\na.';
    const lineText = 'a.';
    strictEqual(detectOccluderInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// detectAudioSourceInstanceMethod — Audio.play and Audio.play3D
// ─────────────────────────────────────────────────────────────────────────────

test('detectAudioSourceInstanceMethod: matches Audio.play', () => {
    const fullText = 'var music = Audio.play("audio/bg.ogg");\nmusic.';
    const lineText = 'music.';
    strictEqual(detectAudioSourceInstanceMethod(lineText, fullText, atEnd(fullText)), true);
});

test('detectAudioSourceInstanceMethod: matches Audio.play3D', () => {
    const fullText = 'var sfx = Audio.play3D("audio/boom.ogg", 0.0, 0.0, 0.0);\nsfx.';
    const lineText = 'sfx.';
    strictEqual(detectAudioSourceInstanceMethod(lineText, fullText, atEnd(fullText)), true);
});

test('detectAudioSourceInstanceMethod: rejects Aria.createObject', () => {
    const fullText = 'var obj = Aria.createObject("name", "models/m.glb");\nobj.';
    const lineText = 'obj.';
    strictEqual(detectAudioSourceInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// detectMaterialInstanceMethod — Material.create
// ─────────────────────────────────────────────────────────────────────────────

test('detectMaterialInstanceMethod: matches Material.create', () => {
    const fullText = 'var mat = Material.create("glow");\nmat.';
    const lineText = 'mat.';
    strictEqual(detectMaterialInstanceMethod(lineText, fullText, atEnd(fullText)), true);
});

test('detectMaterialInstanceMethod: rejects Aria.createObject', () => {
    const fullText = 'var obj = Aria.createObject("name", "models/m.glb");\nobj.';
    const lineText = 'obj.';
    strictEqual(detectMaterialInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

test('detectMaterialInstanceMethod: rejects Light.createDirectional (wrong module)', () => {
    const fullText = 'var light = Light.createDirectional("sun");\nlight.';
    const lineText = 'light.';
    strictEqual(detectMaterialInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// detectLightInstanceMethod — Light.createDirectional and Light.createPoint
// ─────────────────────────────────────────────────────────────────────────────

test('detectLightInstanceMethod: matches Light.createDirectional', () => {
    const fullText = 'var sun = Light.createDirectional("sun");\nsun.';
    const lineText = 'sun.';
    strictEqual(detectLightInstanceMethod(lineText, fullText, atEnd(fullText)), true);
});

test('detectLightInstanceMethod: matches Light.createPoint', () => {
    const fullText = 'var lamp = Light.createPoint("lamp");\nlamp.';
    const lineText = 'lamp.';
    strictEqual(detectLightInstanceMethod(lineText, fullText, atEnd(fullText)), true);
});

test('detectLightInstanceMethod: rejects Material.create (wrong module)', () => {
    const fullText = 'var mat = Material.create("glow");\nmat.';
    const lineText = 'mat.';
    strictEqual(detectLightInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

test('detectLightInstanceMethod: rejects Aria.createObject (wrong module)', () => {
    const fullText = 'var obj = Aria.createObject("name", "models/m.glb");\nobj.';
    const lineText = 'obj.';
    strictEqual(detectLightInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// detectGPSAnchorInstanceMethod — GPS.createAnchor
// ─────────────────────────────────────────────────────────────────────────────

test('detectGPSAnchorInstanceMethod: matches GPS.createAnchor', () => {
    const fullText = 'var anchor = GPS.createAnchor(37.77, -122.4, 0.0);\nanchor.';
    const lineText = 'anchor.';
    strictEqual(detectGPSAnchorInstanceMethod(lineText, fullText, atEnd(fullText)), true);
});

test('detectGPSAnchorInstanceMethod: rejects Aria.createObject (wrong module)', () => {
    const fullText = 'var obj = Aria.createObject("name", "models/m.glb");\nobj.';
    const lineText = 'obj.';
    strictEqual(detectGPSAnchorInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

test('detectGPSAnchorInstanceMethod: rejects Audio.play (wrong module)', () => {
    const fullText = 'var s = Audio.play("audio/bg.ogg");\ns.';
    const lineText = 's.';
    strictEqual(detectGPSAnchorInstanceMethod(lineText, fullText, atEnd(fullText)), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch priority: occluder checked before generic Aria (critical ordering)
// ─────────────────────────────────────────────────────────────────────────────

test('Aria.createOccluder is detected by BOTH detectAriaInstanceMethod AND detectOccluderInstanceMethod', () => {
    // This is intentional: the dispatcher checks detectOccluderInstanceMethod FIRST
    // and only falls through to detectAriaInstanceMethod if that returns false.
    const fullText = 'var wall = Aria.createOccluder("w", "models/w.glb");\nwall.';
    const lineText = 'wall.';
    const offset = atEnd(fullText);

    // Both return true — the caller must check occluder first
    strictEqual(detectOccluderInstanceMethod(lineText, fullText, offset), true,
        'occluder detector must match createOccluder (checked first in dispatch)');
    strictEqual(detectAriaInstanceMethod(lineText, fullText, offset), true,
        'generic Aria detector also matches createOccluder (wildcard)');
});
