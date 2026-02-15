"""
Pre-export validation rules

Checks scene for common issues that will cause problems in AR
Returns list of error dicts with severity, message, fix instructions, and auto-fix ops
"""

try:
    import bpy
    HAS_BLENDER = True
except ImportError:
    HAS_BLENDER = False

from ..utils.error_messages import create_error, ERROR, WARNING, INFO


def validate_scene(scene, selected_only=False):
    """
    Run all validation rules on scene

    Args:
        scene: Blender scene to validate
        selected_only: If True, validate only selected objects

    Returns:
        List of error dicts from error_messages.create_error()
    """
    if not HAS_BLENDER:
        return []

    errors = []

    # Get objects to validate
    if selected_only:
        objects = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
    else:
        objects = [obj for obj in scene.objects if obj.type == 'MESH']

    # 1. Unit system check
    if scene.unit_settings.system == 'NONE':
        errors.append(create_error(
            WARNING,
            None,
            "Scene units set to 'None' - world scale may be incorrect",
            "Set Properties > Scene > Units to 'Metric' for meter-based export",
            auto_fix_op="set_metric_units",
            details="Unit system is NONE - objects may appear at unexpected scale in AR"
        ))

    # 2. Unit scale check
    if scene.unit_settings.system == 'METRIC' and abs(scene.unit_settings.scale_length - 1.0) > 0.001:
        scale = scene.unit_settings.scale_length
        errors.append(create_error(
            WARNING,
            None,
            f"Unit scale is {scale:.3f}x - objects will be {scale:.3f}x size in AR",
            "Check Properties > Scene > Units > Unit Scale is 1.000",
            auto_fix_op=None,
            details=f"Scene unit scale is {scale} (expected 1.0 for 1:1 meter export)"
        ))

    # 3. No mesh objects check
    if len(objects) == 0:
        errors.append(create_error(
            WARNING,
            None,
            "No mesh objects in scene - export will create empty world",
            "Add 3D objects to your scene before exporting",
            auto_fix_op=None,
            details="No MESH type objects found in scene"
        ))
        # No point checking per-object rules if no objects
        return errors

    # 4. Per-object checks
    for obj in objects:
        # 4a. Unapplied transforms check
        tolerance = 0.001
        scale_unapplied = any(abs(s - 1.0) > tolerance for s in obj.scale)
        rotation_unapplied = any(abs(r) > tolerance for r in obj.rotation_euler)

        if scale_unapplied or rotation_unapplied:
            errors.append(create_error(
                WARNING,
                obj.name,
                f"'{obj.name}' has unapplied transforms - may look different in AR",
                "Select object > Object > Apply > All Transforms (Ctrl+A)",
                auto_fix_op="apply_transforms",
                details=f"Scale: {tuple(obj.scale)}, Rotation: {tuple(obj.rotation_euler)}"
            ))

        # 4b. N-gon check (polygons with >4 vertices)
        ngon_count = len([f for f in obj.data.polygons if len(f.vertices) > 4])
        if ngon_count > 0:
            errors.append(create_error(
                WARNING,
                obj.name,
                f"'{obj.name}' has {ngon_count} N-gons (5+ sided faces) - may render differently in AR",
                "Select mesh > Edit Mode > Face > Triangulate Faces (Ctrl+T)",
                auto_fix_op="triangulate",
                details=f"{ngon_count} polygons with more than 4 vertices found"
            ))

        # 4c. Negative scale check (ERROR - blocks export)
        has_negative_scale = any(s < 0 for s in obj.scale)
        if has_negative_scale:
            errors.append(create_error(
                ERROR,
                obj.name,
                f"'{obj.name}' has negative scale - will appear inside-out in AR",
                "Select object > Object > Apply > Scale, then fix normals",
                auto_fix_op="apply_transforms_and_normals",
                details=f"Negative scale components: {tuple(obj.scale)}"
            ))

        # 4d. Very high poly count
        poly_count = len(obj.data.polygons)
        if poly_count > 100000:
            errors.append(create_error(
                WARNING,
                obj.name,
                f"'{obj.name}' has {poly_count} polygons - may cause performance issues on AR hardware (Raspberry Pi 5)",
                "Consider using Decimate modifier to reduce polygon count",
                auto_fix_op=None,
                details=f"Polygon count: {poly_count} (recommended <100k for mobile AR)"
            ))

        # 4e. Zero-scale object (ERROR - blocks export)
        has_zero_scale = any(abs(s) < 0.0001 for s in obj.scale)
        if has_zero_scale:
            axes = [axis for axis, s in zip(['X', 'Y', 'Z'], obj.scale) if abs(s) < 0.0001]
            axes_str = ", ".join(axes)
            errors.append(create_error(
                ERROR,
                obj.name,
                f"'{obj.name}' has zero scale on {axes_str} axis - invisible in AR",
                "Set scale to non-zero value in Properties > Object > Transform",
                auto_fix_op=None,
                details=f"Zero scale on {axes_str}: {tuple(obj.scale)}"
            ))

        # 4f. Unnamed/duplicate name check (INFO only)
        if obj.name.startswith("Cube") or obj.name.startswith("Sphere") or \
           obj.name.startswith("Plane") or obj.name.startswith("Cylinder"):
            # Check for .001, .002 pattern indicating duplicates
            if "." in obj.name and obj.name.split(".")[-1].isdigit():
                errors.append(create_error(
                    INFO,
                    obj.name,
                    f"'{obj.name}' uses default Blender name - consider renaming for clarity in AR code",
                    "Double-click object name in Outliner to rename",
                    auto_fix_op=None,
                    details=f"Default name pattern detected: {obj.name}"
                ))

    return errors
