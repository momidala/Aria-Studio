"""
Unit tests for occlusion geometry export — Phase 26.8 (Blender side).

Validates that the code generator emits Aria.createOccluder() for objects
with is_occluder=True and Aria.createObject() for all others.

Covered per SPEC-GRAVITYAR-API.md §2.3 and 26.8-CONTEXT.md Decision 7:
  - createOccluder emitted when is_occluder flag is True
  - createObject emitted when is_occluder flag is False or absent
  - Mixed scene: both call forms in correct positions
  - Name deduplication still applies to occluder objects
  - Exact call signature: Aria.createOccluder("name", "models/name.glb")
  - setPosition/setRotation calls emitted for occluders same as regular objects

No Blender required — tests run against the pure code_generator module.
"""

import sys
import os
import unittest

# Ensure blender-addon/ is on the path so 'core' resolves as a package.
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), '..', '..', 'blender-addon'),
)

from core import code_generator


# ---------------------------------------------------------------------------
# Shared test helpers — same MockMatrix / MockScene as test_code_generator.py
# ---------------------------------------------------------------------------

class MockMatrix:
    """Mock Blender Matrix for testing without mathutils."""

    def __init__(self, location=(0, 0, 0)):
        self._location = location

    def to_translation(self):
        class Vec3:
            def __init__(self, x, y, z):
                self.x, self.y, self.z = x, y, z
        return Vec3(*self._location)

    def __getitem__(self, index):
        """Support matrix indexing for the fallback code path."""
        if index == 0:
            return [1, 0, 0, self._location[0]]
        elif index == 1:
            return [0, 1, 0, self._location[1]]
        elif index == 2:
            return [0, 0, 1, self._location[2]]
        elif index == 3:
            return [0, 0, 0, 1]


class MockScene:
    """Mock Blender Scene for testing."""

    def __init__(self, name="TestScene"):
        self.name = name


def _make_obj(original_name, var_name, is_occluder=False, location=(0, 0, 0)):
    """Build a minimal object-data dict as scene_traversal.traverse_scene() would."""
    return {
        'original_name': original_name,
        'name': var_name,
        'model_ref': f"models/{var_name}.glb",
        'world_matrix': MockMatrix(location=location),
        'is_occluder': is_occluder,
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestOccluderCodeGeneration(unittest.TestCase):
    """Aria.createOccluder() vs Aria.createObject() dispatch."""

    def test_createObject_emitted_for_regular_object(self):
        """Objects with is_occluder=False must produce Aria.createObject()."""
        scene = MockScene()
        obj = _make_obj('Wall', 'Wall', is_occluder=False)
        code = code_generator.generate([obj], scene)

        self.assertIn('Aria.createObject("Wall", "models/Wall.glb")', code)
        self.assertNotIn('Aria.createOccluder', code)

    def test_createObject_emitted_when_flag_absent(self):
        """Objects missing the is_occluder key default to Aria.createObject()."""
        scene = MockScene()
        obj = {
            'original_name': 'Tree',
            'name': 'Tree',
            'model_ref': 'models/Tree.glb',
            'world_matrix': MockMatrix(),
            # no 'is_occluder' key
        }
        code = code_generator.generate([obj], scene)

        self.assertIn('Aria.createObject("Tree", "models/Tree.glb")', code)
        self.assertNotIn('Aria.createOccluder', code)

    def test_createOccluder_emitted_for_flagged_object(self):
        """Objects with is_occluder=True must produce Aria.createOccluder()."""
        scene = MockScene()
        obj = _make_obj('north_wall', 'north_wall', is_occluder=True)
        code = code_generator.generate([obj], scene)

        self.assertIn('Aria.createOccluder("north_wall", "models/north_wall.glb")', code)
        self.assertNotIn('Aria.createObject', code)

    def test_createOccluder_call_exact_signature(self):
        """createOccluder call must exactly match spec: Aria.createOccluder(name, modelPath)."""
        scene = MockScene()
        obj = _make_obj('roof_occluder', 'roof_occluder', is_occluder=True)
        code = code_generator.generate([obj], scene)

        # Full expected call fragment per SPEC-GRAVITYAR-API.md §2.3
        expected = 'Aria.createOccluder("roof_occluder", "models/roof_occluder.glb")'
        self.assertIn(expected, code)

    def test_occluder_variable_declaration(self):
        """Occluder must be assigned to a var with the sanitized object name."""
        scene = MockScene()
        obj = _make_obj('fence', 'fence', is_occluder=True)
        code = code_generator.generate([obj], scene)

        self.assertIn('var fence = Aria.createOccluder(', code)

    def test_occluder_gets_setPosition(self):
        """setPosition must be emitted for occluders same as regular objects."""
        scene = MockScene()
        obj = _make_obj('occluder_a', 'occluder_a', is_occluder=True, location=(1, 2, 3))
        code = code_generator.generate([obj], scene)

        self.assertIn('occluder_a.setPosition(', code)

    def test_occluder_gets_setRotation(self):
        """setRotation must be emitted for occluders same as regular objects."""
        scene = MockScene()
        obj = _make_obj('occluder_b', 'occluder_b', is_occluder=True)
        code = code_generator.generate([obj], scene)

        self.assertIn('occluder_b.setRotation(', code)


class TestMixedSceneOcclusion(unittest.TestCase):
    """Scenes with a mix of occluder and regular objects."""

    def test_mixed_scene_both_call_forms(self):
        """A scene with one occluder and one regular object must emit both call forms."""
        scene = MockScene("MixedScene")
        objects = [
            _make_obj('visible_tree', 'visible_tree', is_occluder=False),
            _make_obj('wall_occluder', 'wall_occluder', is_occluder=True),
        ]
        code = code_generator.generate(objects, scene)

        self.assertIn('Aria.createObject("visible_tree", "models/visible_tree.glb")', code)
        self.assertIn('Aria.createOccluder("wall_occluder", "models/wall_occluder.glb")', code)

    def test_mixed_scene_both_variables_declared(self):
        """Both objects must have var declarations in the generated code."""
        scene = MockScene()
        objects = [
            _make_obj('bench', 'bench', is_occluder=False),
            _make_obj('ground_occ', 'ground_occ', is_occluder=True),
        ]
        code = code_generator.generate(objects, scene)

        self.assertIn('var bench =', code)
        self.assertIn('var ground_occ =', code)

    def test_multiple_occluders_in_scene(self):
        """Multiple flagged occluders in the same scene all use createOccluder."""
        scene = MockScene()
        objects = [
            _make_obj('occ_a', 'occ_a', is_occluder=True),
            _make_obj('occ_b', 'occ_b', is_occluder=True),
        ]
        code = code_generator.generate(objects, scene)

        self.assertIn('Aria.createOccluder("occ_a"', code)
        self.assertIn('Aria.createOccluder("occ_b"', code)
        self.assertNotIn('Aria.createObject', code)

    def test_occluder_order_preserved(self):
        """Occluder variable appears before later regular object in output."""
        scene = MockScene()
        objects = [
            _make_obj('first_occ', 'first_occ', is_occluder=True),
            _make_obj('second_visible', 'second_visible', is_occluder=False),
        ]
        code = code_generator.generate(objects, scene)

        occ_pos = code.index('Aria.createOccluder')
        obj_pos = code.index('Aria.createObject')
        self.assertLess(occ_pos, obj_pos,
                        "Occluder declared first must appear before regular object in output")


class TestOccluderNameDeduplication(unittest.TestCase):
    """Name deduplication must work correctly for occluder objects (Fix #8 compatibility).

    scene_traversal.traverse_scene() applies deduplication before producing the
    object-data dicts, so code_generator receives already-unique names.
    These tests verify that the is_occluder flag is preserved through the dict
    and that the emitted call uses the deduplicated name.
    """

    def test_occluder_deduplicated_name_used_in_call(self):
        """If traverse_scene deduped the name, the createOccluder call uses the deduped name."""
        scene = MockScene()
        # Simulate what traverse_scene produces after deduplication:
        # two objects both sanitize to 'Wall', second gets 'Wall_1'
        objects = [
            _make_obj('Wall', 'Wall', is_occluder=False),
            _make_obj('Wall', 'Wall_1', is_occluder=True),   # deduplicated by traverse_scene
        ]
        code = code_generator.generate(objects, scene)

        # Regular object keeps its name
        self.assertIn('Aria.createObject("Wall", "models/Wall.glb")', code)
        # Occluder gets its deduplicated name
        self.assertIn('Aria.createOccluder("Wall", "models/Wall_1.glb")', code)
        self.assertIn('var Wall_1 =', code)

    def test_occluder_dedup_no_variable_collision(self):
        """Two objects with colliding sanitized names produce unique var declarations."""
        scene = MockScene()
        objects = [
            _make_obj('Cube.001', 'Cube_001', is_occluder=True),
            _make_obj('Cube_001', 'Cube_001_1', is_occluder=True),
        ]
        code = code_generator.generate(objects, scene)

        self.assertIn('var Cube_001 =', code)
        self.assertIn('var Cube_001_1 =', code)
        # Both must emit createOccluder
        self.assertEqual(code.count('Aria.createOccluder'), 2)
        self.assertNotIn('Aria.createObject', code)

    def test_occluder_name_in_model_ref(self):
        """model_ref for an occluder must use the (potentially deduped) var name."""
        scene = MockScene()
        obj = _make_obj('MyWall', 'MyWall', is_occluder=True)
        code = code_generator.generate([obj], scene)

        # model_ref is built as models/{var_name}.glb by traverse_scene
        self.assertIn('"models/MyWall.glb"', code)


if __name__ == '__main__':
    unittest.main()
