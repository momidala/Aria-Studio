"""
Unit tests for coordinate conversion logic.

Tests the Z-up to Y-up conversion math without requiring Blender.
The conversion is: Blender (x, y, z) -> THerD (x, z, -y)
"""

import unittest
import sys
import os

# Add parent directory to path to import from core
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from core.coordinate_convert import convert_position, format_position_comment


class TestCoordinateConversion(unittest.TestCase):
    """Test coordinate system conversion from Blender Z-up to THerD Y-up."""

    def test_origin_unchanged(self):
        """Origin (0, 0, 0) should remain (0, 0, 0)."""
        result = convert_position((0, 0, 0))
        self.assertEqual(result, (0, 0, 0))

    def test_z_up_to_y_up(self):
        """Blender Z-up (0, 0, 1) should become THerD Y-up (0, 1, 0)."""
        result = convert_position((0, 0, 1))
        self.assertEqual(result, (0, 1, 0))

    def test_y_forward_to_z_backward(self):
        """Blender Y-forward (0, 1, 0) should become THerD Z-backward (0, 0, -1)."""
        result = convert_position((0, 1, 0))
        self.assertEqual(result, (0, 0, -1))

    def test_x_unchanged(self):
        """X axis (1, 0, 0) should remain (1, 0, 0)."""
        result = convert_position((1, 0, 0))
        self.assertEqual(result, (1, 0, 0))

    def test_general_case(self):
        """General position (1, 2, 3) should convert to (1, 3, -2)."""
        result = convert_position((1, 2, 3))
        self.assertEqual(result, (1, 3, -2))

    def test_negative_values(self):
        """Negative values (-1, -2, -3) should convert to (-1, -3, 2)."""
        result = convert_position((-1, -2, -3))
        self.assertEqual(result, (-1, -3, 2))

    def test_scale_preservation(self):
        """Scale values (2, 3, 4) should remap correctly to (2, 4, -3)."""
        result = convert_position((2, 3, 4))
        self.assertEqual(result, (2, 4, -3))

    def test_conversion_reversibility(self):
        """Applying inverse conversion should return to original."""
        original = (5, 7, 11)
        # First conversion: Blender (x, y, z) -> THerD (x, z, -y)
        first = convert_position(original)
        # Should get (5, 11, -7)
        self.assertEqual(first, (5, 11, -7))

        # Inverse: THerD (a, b, c) -> Blender (a, -c, b)
        # So from (5, 11, -7) we get (5, -(-7), 11) = (5, 7, 11)
        inverse = (first[0], -first[2], first[1])
        self.assertEqual(inverse, original)

    def test_format_comment(self):
        """Position comment should show Blender coordinates."""
        blender_pos = (1.5, 2.5, 3.5)
        ar_pos = (1.5, 3.5, -2.5)
        comment = format_position_comment(blender_pos, ar_pos)

        self.assertIn("Blender coords", comment)
        self.assertIn("1.5000", comment)
        self.assertIn("2.5000", comment)
        self.assertIn("3.5000", comment)

    def test_format_comment_precision(self):
        """Position comment should use 4 decimal places."""
        blender_pos = (1.123456, 2.789012, 3.456789)
        ar_pos = convert_position(blender_pos)
        comment = format_position_comment(blender_pos, ar_pos)

        # Should round to 4 decimal places
        self.assertIn("1.1235", comment)
        self.assertIn("2.7890", comment)
        self.assertIn("3.4568", comment)


if __name__ == '__main__':
    unittest.main()
