"""
Unit tests for manifest GPS origin builder.

Tests build_gps_origin() from core/manifest_utils.py directly — no Blender
required.  The function is pure Python and produces the dict that lands
verbatim in manifest.json under the "gps_origin" key.

Coverage:
    - Return dict has the correct keys
    - Artist-supplied coordinates are passed through unchanged
    - Sentinel (0, 0, 0) is preserved (client interprets it as "unset")
    - Values are coerced to float regardless of int input
    - Negative longitude (western hemisphere) works correctly
"""

import sys
import os
import unittest

# Ensure blender-addon/ is on the path so 'core' resolves as a package.
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), '..', '..', 'blender-addon'),
)

from core.manifest_utils import build_gps_origin


class TestBuildGpsOrigin(unittest.TestCase):
    """build_gps_origin() must produce a correctly shaped dict."""

    def test_returns_dict_with_three_keys(self):
        """Return value must have latitude, longitude, and altitude keys."""
        result = build_gps_origin(0.0, 0.0, 0.0)
        self.assertIn('latitude', result)
        self.assertIn('longitude', result)
        self.assertIn('altitude', result)
        self.assertEqual(len(result), 3)

    def test_sentinel_zero_preserved(self):
        """Sentinel (0, 0, 0) must be preserved verbatim."""
        result = build_gps_origin(0.0, 0.0, 0.0)
        self.assertEqual(result['latitude'], 0.0)
        self.assertEqual(result['longitude'], 0.0)
        self.assertEqual(result['altitude'], 0.0)

    def test_artist_coords_passed_through(self):
        """Real GPS coordinates must appear in the output unchanged."""
        lat, lon, alt = 38.4220, -82.4355, 260.0
        result = build_gps_origin(lat, lon, alt)
        self.assertAlmostEqual(result['latitude'], lat, places=4)
        self.assertAlmostEqual(result['longitude'], lon, places=4)
        self.assertAlmostEqual(result['altitude'], alt, places=1)

    def test_negative_longitude(self):
        """Negative longitude (western hemisphere) must survive intact."""
        result = build_gps_origin(0.0, -82.4355, 0.0)
        self.assertAlmostEqual(result['longitude'], -82.4355, places=4)

    def test_negative_latitude(self):
        """Negative latitude (southern hemisphere) must survive intact."""
        result = build_gps_origin(-33.8688, 151.2093, 5.0)
        self.assertAlmostEqual(result['latitude'], -33.8688, places=4)

    def test_values_are_floats(self):
        """All values must be Python floats (JSON serialisable as number)."""
        result = build_gps_origin(38, -82, 260)  # int inputs
        self.assertIsInstance(result['latitude'], float)
        self.assertIsInstance(result['longitude'], float)
        self.assertIsInstance(result['altitude'], float)

    def test_high_precision_coords(self):
        """High-precision coords must not be silently truncated by this function."""
        lat = 38.4220123
        lon = -82.4355456
        alt = 260.789
        result = build_gps_origin(lat, lon, alt)
        self.assertAlmostEqual(result['latitude'], lat, places=6)
        self.assertAlmostEqual(result['longitude'], lon, places=6)
        self.assertAlmostEqual(result['altitude'], alt, places=2)


if __name__ == '__main__':
    unittest.main()
