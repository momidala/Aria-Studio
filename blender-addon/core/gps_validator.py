"""
W7 GPS origin validation — pure function, importable without bpy.

This module contains only the W7 sentinel check so that unit tests can import
and exercise it directly without needing a Blender environment.  The full
validate_scene() pipeline in validator.py calls check_gps_origin() after the
HAS_BLENDER guard, but this module itself has no bpy dependency.
"""

# Severity constant (mirrors error_messages.WARNING — duplicated here so this
# module remains importable without the parent package).
_WARNING = 'WARNING'


def check_gps_origin(world_type, lat, lon, alt):
    """Return W7 warning when an outdoor world has the unset-origin sentinel.

    W7 spec (SPEC-ARIA-STUDIO.md §2.4):
        Trigger  : world_type is outdoor/GPS AND origin is exactly (0, 0, 0)
        Severity : WARNING (allows export)
        Message  : "World origin not set — objects will have no real-world
                   location until you set it"
        Fix      : "Enter the world's GPS origin (latitude/longitude/altitude)
                   in the export panel"
        auto_fix : None — the artist must supply real coordinates

    Args:
        world_type (str): 'OUTDOOR' or 'INDOOR'.  Non-INDOOR values are
            treated as outdoor/GPS.
        lat (float): GPS latitude read from the scene property.
        lon (float): GPS longitude read from the scene property.
        alt (float): GPS altitude read from the scene property.

    Returns:
        list: Empty list if no issue, or a one-element list containing an
        error dict compatible with create_error() output from error_messages.py.
    """
    if world_type == 'INDOOR':
        return []

    # Sentinel check: (0.0, 0.0, 0.0) means "artist has never set the origin"
    # per SPEC-MASTER.md §3.2 gps_origin field definition.
    if lat == 0.0 and lon == 0.0 and alt == 0.0:
        return [
            {
                'id': None,
                'severity': _WARNING,
                'object': None,
                'message': (
                    "World origin not set — objects will have no real-world "
                    "location until you set it"
                ),
                'fix': (
                    "Enter the world's GPS origin "
                    "(latitude/longitude/altitude) in the export panel"
                ),
                'auto_fix_op': None,
                'details': (
                    "GPS origin is (0, 0, 0) — the unset sentinel value. "
                    "Set real coordinates in the GravityAR export panel before "
                    "deploying this world outdoors."
                ),
            }
        ]

    return []
