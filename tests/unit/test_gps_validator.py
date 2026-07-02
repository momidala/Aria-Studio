"""
Unit tests for W7 GPS origin validation.

Tests check_gps_origin() from core/gps_validator.py directly — no Blender
required.  The function is pure Python so it can be imported and exercised in
the standard pytest environment.

Coverage:
    - W7 fires for outdoor world with (0, 0, 0) origin
    - W7 does not fire when any coordinate is non-zero
    - W7 does not fire for indoor worlds regardless of origin
    - Returned error dict matches the expected spec fields
"""

import sys
import os
import unittest

# Ensure blender-addon/ is on the path so 'core' resolves as a package.
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), '..', '..', 'blender-addon'),
)

from core.gps_validator import check_gps_origin

_WARNING = 'WARNING'
_W7_MSG = "World origin not set — objects will have no real-world location until you set it"
_W7_FIX = "Enter the world's GPS origin (latitude/longitude/altitude) in the export panel"


class TestCheckGpsOriginW7Trigger(unittest.TestCase):
    """W7 should fire for outdoor worlds with the (0, 0, 0) sentinel."""

    def test_w7_fires_outdoor_zero_origin(self):
        """W7 triggers when world_type is OUTDOOR and origin is (0, 0, 0)."""
        errors = check_gps_origin('OUTDOOR', 0.0, 0.0, 0.0)
        self.assertEqual(len(errors), 1)

    def test_w7_severity_is_warning(self):
        """W7 error dict must have WARNING severity (allows export)."""
        errors = check_gps_origin('OUTDOOR', 0.0, 0.0, 0.0)
        self.assertEqual(errors[0]['severity'], _WARNING)

    def test_w7_message_text(self):
        """W7 message must match the spec verbatim (SPEC-ARIA-STUDIO.md §2.4)."""
        errors = check_gps_origin('OUTDOOR', 0.0, 0.0, 0.0)
        self.assertEqual(errors[0]['message'], _W7_MSG)

    def test_w7_fix_text(self):
        """W7 fix instruction must match the spec verbatim."""
        errors = check_gps_origin('OUTDOOR', 0.0, 0.0, 0.0)
        self.assertEqual(errors[0]['fix'], _W7_FIX)

    def test_w7_no_auto_fix(self):
        """W7 must not have an auto_fix_op — artist must supply real coordinates."""
        errors = check_gps_origin('OUTDOOR', 0.0, 0.0, 0.0)
        self.assertIsNone(errors[0]['auto_fix_op'])

    def test_w7_object_is_scene_level(self):
        """W7 is a scene-level check — object field must be None."""
        errors = check_gps_origin('OUTDOOR', 0.0, 0.0, 0.0)
        self.assertIsNone(errors[0]['object'])


class TestCheckGpsOriginW7NoTrigger(unittest.TestCase):
    """W7 must NOT fire when the origin has been set."""

    def test_no_w7_when_lat_set(self):
        """Non-zero latitude means origin is set — no W7."""
        errors = check_gps_origin('OUTDOOR', 38.4220, 0.0, 0.0)
        self.assertEqual(len(errors), 0)

    def test_no_w7_when_lon_set(self):
        """Non-zero longitude means origin is set — no W7."""
        errors = check_gps_origin('OUTDOOR', 0.0, -82.4355, 0.0)
        self.assertEqual(len(errors), 0)

    def test_no_w7_when_alt_set(self):
        """Non-zero altitude means origin is set — no W7."""
        errors = check_gps_origin('OUTDOOR', 0.0, 0.0, 260.0)
        self.assertEqual(len(errors), 0)

    def test_no_w7_when_all_set(self):
        """Fully set origin (real GPS coords) must not trigger W7."""
        errors = check_gps_origin('OUTDOOR', 38.4220, -82.4355, 260.0)
        self.assertEqual(len(errors), 0)

    def test_no_w7_negative_lat(self):
        """Negative non-zero latitude is a valid set origin — no W7."""
        errors = check_gps_origin('OUTDOOR', -33.8688, 151.2093, 5.0)
        self.assertEqual(len(errors), 0)


class TestCheckGpsOriginIndoor(unittest.TestCase):
    """W7 must NOT fire for indoor worlds — GPS origin is irrelevant indoors."""

    def test_no_w7_indoor_zero_origin(self):
        """Indoor world with (0, 0, 0) origin must NOT trigger W7."""
        errors = check_gps_origin('INDOOR', 0.0, 0.0, 0.0)
        self.assertEqual(len(errors), 0)

    def test_no_w7_indoor_any_origin(self):
        """Indoor world with any origin must NOT trigger W7."""
        errors = check_gps_origin('INDOOR', 38.4220, -82.4355, 260.0)
        self.assertEqual(len(errors), 0)


if __name__ == '__main__':
    unittest.main()
