// ariaApi.test.ts — Tests verifying the shared API table drives both completion and hover.
// A single entry in ARIA_STATIC_METHODS must produce a CompletionItem AND a hover doc;
// no other files need changing for Phase 27 additions.
//
// Run via: node --test out/test/ariaApi.test.js

import { test } from 'node:test';
import { strictEqual, ok, notStrictEqual } from 'node:assert';
import {
    ARIA_STATIC_METHODS,
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
    ALL_API_METHODS,
    buildCompletions,
    lookupHoverDoc,
} from '../ariaApi';

// ─────────────────────────────────────────────────────────────────────────────
// Original baseline tests (must remain green)
// ─────────────────────────────────────────────────────────────────────────────

test('ARIA_STATIC_METHODS contains createObject entry', () => {
    const method = ARIA_STATIC_METHODS.find(m => m.label === 'createObject');
    ok(method !== undefined, 'createObject should be present in the shared table');
    ok(method.signature.length > 0, 'signature must be non-empty');
    ok(method.description.length > 0, 'description must be non-empty');
    ok(method.insertText.length > 0, 'insertText must be non-empty');
});

test('buildCompletions(ARIA_STATIC_METHODS) returns a CompletionItem for createObject', () => {
    const items = buildCompletions(ARIA_STATIC_METHODS);
    const item = items.find(c => c.label === 'createObject');
    notStrictEqual(item, undefined, 'createObject should appear in completions');
    ok(item !== undefined);
    ok(item.detail !== undefined && item.detail.length > 0, 'completion must have detail (signature)');
    ok(item.documentation !== undefined, 'completion must have documentation');
});

test('lookupHoverDoc returns non-null for createObject', () => {
    const doc = lookupHoverDoc(ARIA_STATIC_METHODS, 'createObject');
    notStrictEqual(doc, null, 'hover doc for createObject must not be null');
    ok(doc !== null);
    ok(doc.includes('createObject'), 'hover doc must mention the method name');
});

test('lookupHoverDoc returns null for unknown method name', () => {
    strictEqual(lookupHoverDoc(ARIA_STATIC_METHODS, 'nonExistentMethod'), null);
    strictEqual(lookupHoverDoc(ARIA_STATIC_METHODS, ''), null);
});

test('shared table is the single source: every completion label has a hover doc', () => {
    const items = buildCompletions(ARIA_STATIC_METHODS);
    ok(items.length > 0, 'must have at least one completion item');
    for (const item of items) {
        const doc = lookupHoverDoc(ARIA_STATIC_METHODS, item.label);
        notStrictEqual(
            doc,
            null,
            `hover doc missing for completion '${item.label}' — table entry is inconsistent`
        );
    }
});

test('hover doc content matches completion detail signature', () => {
    const items = buildCompletions(ARIA_STATIC_METHODS);
    for (const item of items) {
        const hoverDoc = lookupHoverDoc(ARIA_STATIC_METHODS, item.label);
        ok(hoverDoc !== null);
        ok(hoverDoc !== null && item.detail !== undefined);
        ok(hoverDoc.includes(item.label), `hover doc for '${item.label}' should mention the method name`);
        ok((item.detail ?? '').includes(item.label), `completion detail for '${item.label}' should mention the method name`);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 27 — table completeness spot-checks
// ─────────────────────────────────────────────────────────────────────────────

test('ARIA_STATIC_METHODS has all 7 Aria module methods', () => {
    const required = ['createObject', 'createText', 'createOccluder', 'raycast', 'onLoad', 'onUnload', 'onUpdate'];
    for (const name of required) {
        const found = ARIA_STATIC_METHODS.find(m => m.label === name);
        ok(found !== undefined, `ARIA_STATIC_METHODS missing '${name}'`);
    }
    strictEqual(ARIA_STATIC_METHODS.length, 7, 'ARIA_STATIC_METHODS must have exactly 7 entries');
});

test('GPS_STATIC_METHODS has all 6 GPS module methods including getSolarPosition', () => {
    const required = ['createAnchor', 'getPlayerPosition', 'distance', 'bearing', 'getSolarPosition', 'calibrateGroundLevel'];
    for (const name of required) {
        const found = GPS_STATIC_METHODS.find(m => m.label === name);
        ok(found !== undefined, `GPS_STATIC_METHODS missing '${name}'`);
    }
    strictEqual(GPS_STATIC_METHODS.length, 6, 'GPS_STATIC_METHODS must have exactly 6 entries');
});

test('GPS_STATIC_METHODS.distance signature uses GPSAnchor parameters', () => {
    const dist = GPS_STATIC_METHODS.find(m => m.label === 'distance');
    ok(dist !== undefined, 'distance must be in GPS_STATIC_METHODS');
    ok(dist !== undefined && dist.signature.includes('GPSAnchor'),
        'distance signature must reference GPSAnchor, not raw lat/lon — spec §4.3');
});

test('GPS_STATIC_METHODS.bearing signature uses GPSAnchor parameters', () => {
    const brg = GPS_STATIC_METHODS.find(m => m.label === 'bearing');
    ok(brg !== undefined, 'bearing must be in GPS_STATIC_METHODS');
    ok(brg !== undefined && brg.signature.includes('GPSAnchor'),
        'bearing signature must reference GPSAnchor, not raw lat/lon — spec §4.4');
});

test('INPUT_STATIC_METHODS has all 6 Input module methods including onLongPress', () => {
    const required = ['onTap', 'onDoubleTap', 'onLongPress', 'onSwipe', 'onPan', 'onPinch'];
    for (const name of required) {
        const found = INPUT_STATIC_METHODS.find(m => m.label === name);
        ok(found !== undefined, `INPUT_STATIC_METHODS missing '${name}'`);
    }
    strictEqual(INPUT_STATIC_METHODS.length, 6, 'INPUT_STATIC_METHODS must have exactly 6 entries');
});

test('AUDIO_STATIC_METHODS has all 4 Audio module methods', () => {
    const required = ['play', 'play3D', 'setMasterVolume', 'getMasterVolume'];
    for (const name of required) {
        const found = AUDIO_STATIC_METHODS.find(m => m.label === name);
        ok(found !== undefined, `AUDIO_STATIC_METHODS missing '${name}'`);
    }
    strictEqual(AUDIO_STATIC_METHODS.length, 4, 'AUDIO_STATIC_METHODS must have exactly 4 entries');
});

test('MATERIAL_STATIC_METHODS has Material.create', () => {
    const found = MATERIAL_STATIC_METHODS.find(m => m.label === 'create');
    ok(found !== undefined, 'Material.create must be in MATERIAL_STATIC_METHODS');
    strictEqual(MATERIAL_STATIC_METHODS.length, 1, 'MATERIAL_STATIC_METHODS must have exactly 1 entry');
});

test('LIGHT_STATIC_METHODS has createDirectional and createPoint', () => {
    const dir = LIGHT_STATIC_METHODS.find(m => m.label === 'createDirectional');
    const pt = LIGHT_STATIC_METHODS.find(m => m.label === 'createPoint');
    ok(dir !== undefined, 'LIGHT_STATIC_METHODS missing createDirectional');
    ok(pt !== undefined, 'LIGHT_STATIC_METHODS missing createPoint');
    strictEqual(LIGHT_STATIC_METHODS.length, 2, 'LIGHT_STATIC_METHODS must have exactly 2 entries');
});

test('ARIA_OBJECT_INSTANCE_METHODS has all physics methods', () => {
    const required = ['addRigidBody', 'addCollisionShape', 'setMass', 'applyForce', 'applyImpulse', 'applyTorque', 'setVelocity', 'onCollision'];
    for (const name of required) {
        const found = ARIA_OBJECT_INSTANCE_METHODS.find(m => m.label === name);
        ok(found !== undefined, `ARIA_OBJECT_INSTANCE_METHODS missing '${name}'`);
    }
});

test('ARIA_OBJECT_INSTANCE_METHODS has all animation methods', () => {
    const required = ['playAnimation', 'pauseAnimation', 'stopAnimation', 'setAnimationLoop', 'getAnimationNames', 'isAnimating'];
    for (const name of required) {
        const found = ARIA_OBJECT_INSTANCE_METHODS.find(m => m.label === name);
        ok(found !== undefined, `ARIA_OBJECT_INSTANCE_METHODS missing '${name}'`);
    }
});

test('ARIA_OBJECT_INSTANCE_METHODS has all text methods', () => {
    const required = ['setText', 'getText', 'setFontSize', 'setTextColor'];
    for (const name of required) {
        const found = ARIA_OBJECT_INSTANCE_METHODS.find(m => m.label === name);
        ok(found !== undefined, `ARIA_OBJECT_INSTANCE_METHODS missing '${name}'`);
    }
});

test('ARIA_OBJECT_INSTANCE_METHODS has network state methods', () => {
    const found1 = ARIA_OBJECT_INSTANCE_METHODS.find(m => m.label === 'setNetworkState');
    const found2 = ARIA_OBJECT_INSTANCE_METHODS.find(m => m.label === 'getNetworkState');
    ok(found1 !== undefined, 'ARIA_OBJECT_INSTANCE_METHODS missing setNetworkState');
    ok(found2 !== undefined, 'ARIA_OBJECT_INSTANCE_METHODS missing getNetworkState');
});

test('ARIA_OBJECT_INSTANCE_METHODS has setMaterial', () => {
    const found = ARIA_OBJECT_INSTANCE_METHODS.find(m => m.label === 'setMaterial');
    ok(found !== undefined, 'ARIA_OBJECT_INSTANCE_METHODS missing setMaterial');
});

test('ARIA_OBJECT_INSTANCE_METHODS has exactly 30 methods', () => {
    strictEqual(ARIA_OBJECT_INSTANCE_METHODS.length, 30,
        'Expected 30 AriaObject instance methods: 6 transform + 2 anchor + 2 network + 8 physics + 6 animation + 4 text + 1 setMaterial + 1 destroy');
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 27 — occluder method-set isolation tests
// ─────────────────────────────────────────────────────────────────────────────

test('OCCLUDER_INSTANCE_METHODS has exactly 11 methods', () => {
    strictEqual(OCCLUDER_INSTANCE_METHODS.length, 11,
        'Expected 11 occluder instance methods: 6 transform + 2 anchor + 2 network + 1 destroy');
});

test('OCCLUDER_INSTANCE_METHODS has all transform and lifecycle methods', () => {
    const required = ['setPosition', 'setRotation', 'setScale', 'getPosition', 'getRotation', 'getScale', 'setAnchor', 'getAnchorPosition', 'setNetworkState', 'getNetworkState', 'destroy'];
    for (const name of required) {
        const found = OCCLUDER_INSTANCE_METHODS.find(m => m.label === name);
        ok(found !== undefined, `OCCLUDER_INSTANCE_METHODS missing '${name}'`);
    }
});

test('OCCLUDER_INSTANCE_METHODS does NOT contain blocked physics methods', () => {
    const blocked = ['addRigidBody', 'addCollisionShape', 'setMass', 'applyForce', 'applyImpulse', 'applyTorque', 'setVelocity', 'onCollision'];
    for (const name of blocked) {
        const found = OCCLUDER_INSTANCE_METHODS.find(m => m.label === name);
        strictEqual(found, undefined, `OCCLUDER_INSTANCE_METHODS must NOT contain blocked physics method '${name}'`);
    }
});

test('OCCLUDER_INSTANCE_METHODS does NOT contain blocked animation methods', () => {
    const blocked = ['playAnimation', 'pauseAnimation', 'stopAnimation', 'setAnimationLoop', 'getAnimationNames', 'isAnimating'];
    for (const name of blocked) {
        const found = OCCLUDER_INSTANCE_METHODS.find(m => m.label === name);
        strictEqual(found, undefined, `OCCLUDER_INSTANCE_METHODS must NOT contain blocked animation method '${name}'`);
    }
});

test('OCCLUDER_INSTANCE_METHODS does NOT contain blocked text or material methods', () => {
    const blocked = ['setText', 'getText', 'setFontSize', 'setTextColor', 'setMaterial'];
    for (const name of blocked) {
        const found = OCCLUDER_INSTANCE_METHODS.find(m => m.label === name);
        strictEqual(found, undefined, `OCCLUDER_INSTANCE_METHODS must NOT contain blocked method '${name}'`);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 27 — REQUIRED-only methods must NOT appear anywhere
// ─────────────────────────────────────────────────────────────────────────────

test('No REQUIRED-only methods appear in any completion table', () => {
    // These are REQUIRED but NOT IMPLEMENTED per SPEC-GRAVITYAR-API §3.3
    const requiredNotImplemented = ['addState', 'setState', 'getState', 'onStateChange'];

    const allTables = [
        { name: 'ARIA_STATIC_METHODS', table: ARIA_STATIC_METHODS },
        { name: 'GPS_STATIC_METHODS', table: GPS_STATIC_METHODS },
        { name: 'INPUT_STATIC_METHODS', table: INPUT_STATIC_METHODS },
        { name: 'AUDIO_STATIC_METHODS', table: AUDIO_STATIC_METHODS },
        { name: 'MATERIAL_STATIC_METHODS', table: MATERIAL_STATIC_METHODS },
        { name: 'LIGHT_STATIC_METHODS', table: LIGHT_STATIC_METHODS },
        { name: 'ARIA_OBJECT_INSTANCE_METHODS', table: ARIA_OBJECT_INSTANCE_METHODS },
        { name: 'OCCLUDER_INSTANCE_METHODS', table: OCCLUDER_INSTANCE_METHODS },
        { name: 'AUDIO_SOURCE_INSTANCE_METHODS', table: AUDIO_SOURCE_INSTANCE_METHODS },
        { name: 'MATERIAL_INSTANCE_METHODS', table: MATERIAL_INSTANCE_METHODS },
        { name: 'LIGHT_INSTANCE_METHODS', table: LIGHT_INSTANCE_METHODS },
        { name: 'GPS_ANCHOR_INSTANCE_METHODS', table: GPS_ANCHOR_INSTANCE_METHODS },
    ];

    for (const { name, table } of allTables) {
        for (const label of requiredNotImplemented) {
            const found = table.find(m => m.label === label);
            strictEqual(
                found,
                undefined,
                `REQUIRED-only method '${label}' must NOT appear in ${name} — artists would get completions that fail at runtime`
            );
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 27 — hover coverage for each module
// ─────────────────────────────────────────────────────────────────────────────

test('hover lookup for Aria static method (onUpdate) works', () => {
    const doc = lookupHoverDoc(ALL_API_METHODS, 'onUpdate');
    notStrictEqual(doc, null, 'onUpdate must have hover doc');
    ok(doc !== null && doc.includes('onUpdate'));
});

test('hover lookup for GPS method (getSolarPosition) works', () => {
    const doc = lookupHoverDoc(ALL_API_METHODS, 'getSolarPosition');
    notStrictEqual(doc, null, 'getSolarPosition must have hover doc');
    ok(doc !== null && doc.includes('getSolarPosition'));
});

test('hover lookup for GPS method (calibrateGroundLevel) works', () => {
    const doc = lookupHoverDoc(ALL_API_METHODS, 'calibrateGroundLevel');
    notStrictEqual(doc, null, 'calibrateGroundLevel must have hover doc');
    ok(doc !== null && doc.includes('calibrateGroundLevel'));
});

test('hover lookup for Input method (onLongPress) works', () => {
    const doc = lookupHoverDoc(ALL_API_METHODS, 'onLongPress');
    notStrictEqual(doc, null, 'onLongPress must have hover doc');
    ok(doc !== null && doc.includes('onLongPress'));
});

test('hover lookup for Aria instance method (onCollision) works', () => {
    const doc = lookupHoverDoc(ALL_API_METHODS, 'onCollision');
    notStrictEqual(doc, null, 'onCollision must have hover doc');
    ok(doc !== null && doc.includes('onCollision'));
});

test('hover lookup for Aria instance method (playAnimation) works', () => {
    const doc = lookupHoverDoc(ALL_API_METHODS, 'playAnimation');
    notStrictEqual(doc, null, 'playAnimation must have hover doc');
    ok(doc !== null && doc.includes('playAnimation'));
});

test('hover lookup for Aria instance method (setNetworkState) works', () => {
    const doc = lookupHoverDoc(ALL_API_METHODS, 'setNetworkState');
    notStrictEqual(doc, null, 'setNetworkState must have hover doc');
    ok(doc !== null && doc.includes('setNetworkState'));
});

test('hover lookup for AudioSource method (isPlaying) works', () => {
    const doc = lookupHoverDoc(ALL_API_METHODS, 'isPlaying');
    notStrictEqual(doc, null, 'isPlaying must have hover doc');
    ok(doc !== null && doc.includes('isPlaying'));
});

test('hover lookup for Material instance method (setMetallic) works', () => {
    const doc = lookupHoverDoc(ALL_API_METHODS, 'setMetallic');
    notStrictEqual(doc, null, 'setMetallic must have hover doc');
    ok(doc !== null && doc.includes('setMetallic'));
});

test('hover lookup for Light instance method (setIntensity) works', () => {
    const doc = lookupHoverDoc(ALL_API_METHODS, 'setIntensity');
    notStrictEqual(doc, null, 'setIntensity must have hover doc');
    ok(doc !== null && doc.includes('setIntensity'));
});

test('hover lookup for GPSAnchor method (getId) works', () => {
    const doc = lookupHoverDoc(ALL_API_METHODS, 'getId');
    notStrictEqual(doc, null, 'getId must have hover doc');
    ok(doc !== null && doc.includes('getId'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 27 — generic builder produces valid CompletionItems for all tables
// ─────────────────────────────────────────────────────────────────────────────

test('buildCompletions works for every module static table', () => {
    const tables = [
        GPS_STATIC_METHODS,
        INPUT_STATIC_METHODS,
        AUDIO_STATIC_METHODS,
        MATERIAL_STATIC_METHODS,
        LIGHT_STATIC_METHODS,
    ];
    for (const table of tables) {
        const items = buildCompletions(table);
        ok(items.length > 0, 'each module table must produce at least one completion');
        for (const item of items) {
            ok(item.label.length > 0, 'completion label must be non-empty');
            ok(item.detail !== undefined && item.detail.length > 0, 'completion must have detail');
            ok(item.documentation !== undefined, 'completion must have documentation');
        }
    }
});

test('buildCompletions works for every instance method table', () => {
    const tables = [
        ARIA_OBJECT_INSTANCE_METHODS,
        OCCLUDER_INSTANCE_METHODS,
        AUDIO_SOURCE_INSTANCE_METHODS,
        MATERIAL_INSTANCE_METHODS,
        LIGHT_INSTANCE_METHODS,
        GPS_ANCHOR_INSTANCE_METHODS,
    ];
    for (const table of tables) {
        const items = buildCompletions(table);
        ok(items.length > 0, 'each instance table must produce at least one completion');
    }
});

test('ALL_API_METHODS contains createOccluder', () => {
    const found = ALL_API_METHODS.find(m => m.label === 'createOccluder');
    notStrictEqual(found, undefined, 'createOccluder must be in ALL_API_METHODS');
});

test('ALL_API_METHODS contains getSolarPosition', () => {
    const found = ALL_API_METHODS.find(m => m.label === 'getSolarPosition');
    notStrictEqual(found, undefined, 'getSolarPosition must be in ALL_API_METHODS');
});
