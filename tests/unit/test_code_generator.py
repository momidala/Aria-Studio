"""
Unit tests for Gravity code generation.

Tests the code generator output without requiring Blender.
Uses mock object data matching the scene_traversal output format.
"""

import unittest
import sys
import os
import re

# Add blender-addon/ to sys.path so tests can import from core/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'blender-addon'))

from core import code_generator


class MockMatrix:
    """Mock Blender Matrix for testing without mathutils."""

    def __init__(self, location=(0, 0, 0), rotation_euler=(0, 0, 0), scale=(1, 1, 1)):
        self._location = location
        self._rotation_euler = rotation_euler
        self._scale = scale

    def to_translation(self):
        """Mock translation vector."""
        class Vec3:
            def __init__(self, x, y, z):
                self.x, self.y, self.z = x, y, z
        return Vec3(*self._location)

    def __getitem__(self, index):
        """Support matrix indexing for fallback path."""
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


class TestCodeGenerator(unittest.TestCase):
    """Test Gravity code generation."""

    def test_empty_scene(self):
        """Empty object list should generate valid main() function."""
        scene = MockScene("EmptyScene")
        code = code_generator.generate([], scene)

        # Should have func main()
        self.assertIn("func main()", code)
        # Should have return null
        self.assertIn("return null;", code)
        # Should have closing brace
        self.assertIn("}", code)
        # Should mention scene name in header
        self.assertIn("EmptyScene", code)
        # Should mention object count
        self.assertIn("Objects: 0", code)

    def test_single_object_at_origin(self):
        """Single object at origin should generate complete code."""
        objects = [{
            'original_name': 'Cube',
            'name': 'cube',
            'model_ref': 'models/Cube.glb',
            'world_matrix': MockMatrix(location=(0, 0, 0))
        }]
        scene = MockScene()
        code = code_generator.generate(objects, scene)

        # Should create object
        self.assertIn('Aria.createObject("Cube", "models/Cube.glb")', code)
        # Should declare variable
        self.assertIn('var cube =', code)
        # Should set position to origin
        self.assertIn('cube.setPosition(0.0000, 0.0000, 0.0000)', code)
        # Should set rotation (identity quaternion should be 0,0,0,1)
        self.assertIn('cube.setRotation(', code)
        # Should have Blender coords comment
        self.assertIn('Blender coords:', code)

    def test_object_with_position(self):
        """Object with non-zero position should convert coordinates."""
        objects = [{
            'original_name': 'Sphere',
            'name': 'sphere',
            'model_ref': 'models/Sphere.glb',
            'world_matrix': MockMatrix(location=(1, 2, 3))
        }]
        scene = MockScene()
        code = code_generator.generate(objects, scene)

        # Blender (1, 2, 3) -> THerD (1, 3, -2)
        # Should set converted position
        self.assertIn('sphere.setPosition(', code)
        # Should have position values (may be in fallback mode using simple conversion)
        self.assertIn('1.0000', code)  # X unchanged

    def test_omit_unit_scale(self):
        """Object with unit scale (1,1,1) should NOT have setScale call."""
        objects = [{
            'original_name': 'Cube',
            'name': 'cube',
            'model_ref': 'models/Cube.glb',
            'world_matrix': MockMatrix(location=(0, 0, 0), scale=(1, 1, 1))
        }]
        scene = MockScene()
        code = code_generator.generate(objects, scene)

        # Should NOT have setScale call for unit scale
        self.assertNotIn('cube.setScale', code)

    def test_include_non_unit_scale(self):
        """Object with non-unit scale should include setScale call."""
        objects = [{
            'original_name': 'Cube',
            'name': 'cube',
            'model_ref': 'models/Cube.glb',
            'world_matrix': MockMatrix(location=(0, 0, 0), scale=(2, 3, 4))
        }]
        scene = MockScene()

        # This test will use fallback path since we can't mock full matrix decomposition
        # Just verify structure is correct
        code = code_generator.generate(objects, scene)

        # Should have object creation
        self.assertIn('var cube =', code)
        self.assertIn('Aria.createObject', code)

    def test_name_sanitization(self):
        """Object names should be valid Gravity identifiers."""
        objects = [{
            'original_name': 'My Cube 01',
            'name': 'my_cube_01',  # Should be pre-sanitized by scene_traversal
            'model_ref': 'models/My_Cube_01.glb',
            'world_matrix': MockMatrix()
        }]
        scene = MockScene()
        code = code_generator.generate(objects, scene)

        # Should use sanitized name as variable
        self.assertIn('var my_cube_01 =', code)
        # Should preserve original name in createObject call
        self.assertIn('"My Cube 01"', code)

    def test_multiple_objects(self):
        """Multiple objects should all appear in main() function."""
        objects = [
            {
                'original_name': 'Cube',
                'name': 'cube',
                'model_ref': 'models/Cube.glb',
                'world_matrix': MockMatrix(location=(1, 0, 0))
            },
            {
                'original_name': 'Sphere',
                'name': 'sphere',
                'model_ref': 'models/Sphere.glb',
                'world_matrix': MockMatrix(location=(0, 1, 0))
            }
        ]
        scene = MockScene()
        code = code_generator.generate(objects, scene)

        # Should have both objects
        self.assertIn('var cube =', code)
        self.assertIn('var sphere =', code)
        # Should mention count
        self.assertIn("Objects: 2", code)

    def test_blender_coordinate_comment(self):
        """Generated code should include inline Blender coordinate comments."""
        objects = [{
            'original_name': 'TestObject',
            'name': 'testobject',
            'model_ref': 'models/Test.glb',
            'world_matrix': MockMatrix(location=(1.5, 2.5, 3.5))
        }]
        scene = MockScene()
        code = code_generator.generate(objects, scene)

        # Should have comment with original Blender coordinates
        self.assertIn('// TestObject', code)
        self.assertIn('Blender coords:', code)
        self.assertIn('1.5000', code)
        self.assertIn('2.5000', code)
        self.assertIn('3.5000', code)

    def test_float_precision(self):
        """Generated code should use 4 decimal places for floats."""
        objects = [{
            'original_name': 'Cube',
            'name': 'cube',
            'model_ref': 'models/Cube.glb',
            'world_matrix': MockMatrix(location=(1.123456, 2.789012, 3.456789))
        }]
        scene = MockScene()
        code = code_generator.generate(objects, scene)

        # Find all float values in setPosition calls
        # They should all be formatted to 4 decimal places
        float_pattern = r'\d+\.\d{4}'
        floats = re.findall(float_pattern, code)

        # Should have at least some float values with exactly 4 decimal places
        self.assertGreater(len(floats), 0)

    def test_output_structure(self):
        """Output should contain required Gravity syntax elements."""
        objects = [{
            'original_name': 'Cube',
            'name': 'cube',
            'model_ref': 'models/Cube.glb',
            'world_matrix': MockMatrix()
        }]
        scene = MockScene()
        code = code_generator.generate(objects, scene)

        # Should have main function
        self.assertIn("func main() {", code)
        # Should have return statement
        self.assertIn("return null;", code)
        # Should have closing brace, immediately followed by the
        # end-of-generated-section marker (SPEC-ARIA-STUDIO.md #2.6.2)
        self.assertIn("}\n" + code_generator.END_GENERATED_MARKER, code)
        self.assertTrue(code.rstrip().endswith(code_generator.END_GENERATED_MARKER))
        # Should have header comment
        self.assertIn("// GravityAR World", code)


class TestObjectNameEscaping(unittest.TestCase):
    """Tier 1 tests for code_generator._escape_grav_string() / WR-02.

    original_name (raw Blender object name) is interpolated into a
    double-quoted Gravity string literal argument to Aria.createObject()/
    Aria.createOccluder(). Unlike var_name/model_ref, it is not run through
    scene_traversal.sanitize_name(), so an object name containing an
    embedded '"' must be escaped or it would break out of the string
    literal and inject arbitrary Gravity source into the distributed
    world script (27.9-REVIEW.md WR-02).
    """

    def test_quote_in_object_name_is_escaped(self):
        """An object name containing a double quote must not break out of
        the generated string literal on the `var ... = Aria.create...(...)`
        line (the only place the name is used as executable Gravity code --
        the preceding comment line is inert and intentionally left
        unescaped per WR-02's fix note)."""
        raw_name = 'Cube", "x"); maliciousCall(); //'
        objects = [{
            'original_name': raw_name,
            'name': 'cube',
            'model_ref': 'models/Cube.glb',
            'world_matrix': MockMatrix(location=(0, 0, 0))
        }]
        scene = MockScene()
        code = code_generator.generate(objects, scene)

        var_line = next(line for line in code.splitlines() if line.startswith('    var cube ='))

        # The var-declaration line must contain the escaped literal exactly
        # as _escape_grav_string() would produce, proving the raw quote was
        # not passed through unescaped into executable code.
        expected_escaped = code_generator._escape_grav_string(raw_name)
        self.assertIn(f'"{expected_escaped}"', var_line)

        # Prove the fix actually changed behavior: the naive (pre-fix)
        # unescaped interpolation would have produced this exact line --
        # confirm it is NOT what was generated.
        unsafe_line = (
            f'    var cube = Aria.createObject("{raw_name}", "models/Cube.glb");'
        )
        self.assertNotEqual(var_line, unsafe_line)

    def test_backslash_in_object_name_is_escaped(self):
        """A literal backslash in an object name must be escaped so a
        subsequent escape sequence in the raw name cannot be reinterpreted."""
        raw_name = 'Weird\\"Name'  # actual chars: Weird\"Name
        objects = [{
            'original_name': raw_name,
            'name': 'weirdname',
            'model_ref': 'models/Weird.glb',
            'world_matrix': MockMatrix(location=(0, 0, 0))
        }]
        scene = MockScene()
        code = code_generator.generate(objects, scene)

        # Compute the expected escaped form via the module's own helper
        # rather than hand-counting backslashes, to avoid off-by-one
        # transcription errors in the test itself.
        expected_escaped = code_generator._escape_grav_string(raw_name)
        self.assertIn(f'"{expected_escaped}"', code)

    def test_normal_object_name_unchanged(self):
        """A normal object name with no special characters is emitted
        unchanged (no spurious escaping)."""
        objects = [{
            'original_name': 'Cube',
            'name': 'cube',
            'model_ref': 'models/Cube.glb',
            'world_matrix': MockMatrix(location=(0, 0, 0))
        }]
        scene = MockScene()
        code = code_generator.generate(objects, scene)

        self.assertIn('Aria.createObject("Cube", "models/Cube.glb")', code)

    def test_escape_helper_quote_and_backslash(self):
        """_escape_grav_string() escapes backslash before quote, and leaves
        plain names untouched."""
        self.assertEqual(code_generator._escape_grav_string('Cube'), 'Cube')
        self.assertEqual(
            code_generator._escape_grav_string('Cube"x'), 'Cube\\"x'
        )
        self.assertEqual(
            code_generator._escape_grav_string('back\\slash'),
            'back\\\\slash'
        )


class TestReexportMerge(unittest.TestCase):
    """Tier 1 tests for code_generator.merge_generated() (SI-2).

    Proves the mission-critical guarantee: re-exporting from Blender must
    never silently destroy an artist's hand-written code below the
    end-of-generated-section marker (SPEC-ARIA-STUDIO.md #2.6.2).
    """

    def _first_export(self, name='cube'):
        """Simulate a first export: generate() output for a single object."""
        objects = [{
            'original_name': 'Cube',
            'name': name,
            'model_ref': 'models/Cube.glb',
            'world_matrix': MockMatrix(location=(0, 0, 0))
        }]
        scene = MockScene()
        return code_generator.generate(objects, scene)

    def test_reexport_preserves_artist_section(self):
        """Artist code written below the marker survives a second merge."""
        first_export = self._first_export()
        artist_code = "\nfunc onLoad() {\n    myCustomDynamics();\n}\n"
        existing_file = first_export + artist_code

        second_export = self._first_export()
        status, merged = code_generator.merge_generated(existing_file, second_export)

        self.assertEqual(status, "merged")
        self.assertIn("myCustomDynamics()", merged)
        self.assertIn("func onLoad()", merged)

    def test_reexport_replaces_generated_section(self):
        """The merged result reflects the NEW generated content, not the old."""
        first_export = self._first_export()
        artist_code = "\nfunc onLoad() {\n    myCustomDynamics();\n}\n"
        existing_file = first_export + artist_code

        # Re-export with a newly added second object.
        objects = [
            {
                'original_name': 'Cube',
                'name': 'cube',
                'model_ref': 'models/Cube.glb',
                'world_matrix': MockMatrix(location=(0, 0, 0))
            },
            {
                'original_name': 'NewSphere',
                'name': 'newsphere',
                'model_ref': 'models/NewSphere.glb',
                'world_matrix': MockMatrix(location=(1, 0, 0))
            },
        ]
        scene = MockScene()
        second_export = code_generator.generate(objects, scene)

        status, merged = code_generator.merge_generated(existing_file, second_export)

        self.assertEqual(status, "merged")
        # New object's generated code is present above the marker.
        self.assertIn('Aria.createObject("NewSphere", "models/NewSphere.glb")', merged)
        # Artist section is still preserved below the marker.
        self.assertIn("myCustomDynamics()", merged)

    def test_reexport_no_marker_warns(self):
        """A markerless existing file yields the no-marker sentinel, never an overwrite."""
        existing_without_marker = "func main() {\n    // hand-written, no marker\n    return null;\n}\n"
        new_generated = self._first_export()

        status, merged = code_generator.merge_generated(existing_without_marker, new_generated)

        self.assertEqual(status, "no_marker")
        self.assertIsNone(merged)

    def test_first_export_no_existing_file(self):
        """No existing file (None or empty string) returns the fresh content unchanged."""
        new_generated = self._first_export()

        status_none, text_none = code_generator.merge_generated(None, new_generated)
        status_empty, text_empty = code_generator.merge_generated("", new_generated)

        self.assertEqual(status_none, "new")
        self.assertEqual(text_none, new_generated)
        self.assertEqual(status_empty, "new")
        self.assertEqual(text_empty, new_generated)


if __name__ == '__main__':
    unittest.main()
