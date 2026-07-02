"""
Manifest building helpers — pure functions, importable without bpy.

These utilities build Python dicts that are serialised to manifest.json by the
export operator.  Keeping them here (rather than inside operators/) lets unit
tests import and exercise them without triggering the unconditional `import bpy`
at the top of export_gravityar.py.
"""


def build_gps_origin(lat, lon, alt):
    """Return a gps_origin dict for manifest.json.

    The dict is embedded verbatim under the "gps_origin" key.  When all three
    values are 0.0 the client treats the origin as unset (SPEC-MASTER.md §3.2)
    and validator W7 will flag the world as missing its real-world location.

    Note on precision: Blender's FloatProperty stores 32-bit floats, giving
    approximately 7 significant figures.  For GPS coordinates in the range
    ±180 this translates to roughly 0.1 m accuracy — acceptable for outdoor AR
    applications.  The values are passed through as-is; no rounding is applied
    here.

    Args:
        lat (float): Latitude in decimal degrees, -90 to 90.
        lon (float): Longitude in decimal degrees, -180 to 180.
        alt (float): Altitude in metres above sea level.

    Returns:
        dict: {"latitude": float, "longitude": float, "altitude": float}
    """
    return {
        "latitude": float(lat),
        "longitude": float(lon),
        "altitude": float(alt),
    }
