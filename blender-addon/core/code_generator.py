"""
Gravity Code Generator Module

Generates GravityAR Gravity source code from Blender scene data.
"""

from . import coordinate_convert


def format_float(value, precision=4):
    """
    Format float to specified decimal places.

    Args:
        value: Float value
        precision: Number of decimal places

    Returns:
        str: Formatted float string
    """
    return f"{value:.{precision}f}"


def generate(objects, scene, options=None):
    """
    Generate complete GravityAR .grav source code file.

    Produces Gravity code matching existing patterns:
    - func main() wrapper
    - Aria.createObject() calls
    - setPosition/setRotation/setScale method calls
    - Inline comments showing original Blender coordinates

    Args:
        objects: List of object dicts from scene_traversal.traverse_scene()
        scene: Blender scene object (for metadata)
        options: Optional dict for generation settings (reserved for future)

    Returns:
        str: Complete Gravity source code
    """
    options = options or {}

    # Header
    lines = [
        "// GravityAR World - Exported from Blender",
        f"// Scene: {scene.name}",
        f"// Objects: {len(objects)}",
        "",
        "func main() {",
    ]

    # Generate code for each object
    for obj_data in objects:
        original_name = obj_data['original_name']
        var_name = obj_data['name']
        model_ref = obj_data['model_ref']
        world_matrix = obj_data['world_matrix']

        # Convert transform to THerD coordinate system
        try:
            location, rotation_euler, scale = coordinate_convert.convert_transform(world_matrix)

            # Extract original Blender position for comment
            blender_pos = world_matrix.to_translation()
            pos_comment = coordinate_convert.format_position_comment(
                (blender_pos.x, blender_pos.y, blender_pos.z),
                (location.x, location.y, location.z)
            )

            # Convert euler rotation to quaternion for Aria API
            rotation_quat = rotation_euler.to_quaternion()

            # Add comment with original name and Blender coordinates
            lines.append(f"    // {original_name} ({pos_comment})")

            # Create object
            lines.append(f'    var {var_name} = Aria.createObject("{original_name}", "{model_ref}");')

            # Set position (always include, even if 0,0,0 - explicit is better)
            lines.append(
                f"    {var_name}.setPosition("
                f"{format_float(location.x)}, "
                f"{format_float(location.y)}, "
                f"{format_float(location.z)});"
            )

            # Set rotation (quaternion x, y, z, w)
            lines.append(
                f"    {var_name}.setRotation("
                f"{format_float(rotation_quat.x)}, "
                f"{format_float(rotation_quat.y)}, "
                f"{format_float(rotation_quat.z)}, "
                f"{format_float(rotation_quat.w)});"
            )

            # Set scale (omit if uniform 1,1,1 for cleaner output)
            is_unit_scale = (
                abs(scale.x - 1.0) < 0.0001 and
                abs(scale.y - 1.0) < 0.0001 and
                abs(scale.z - 1.0) < 0.0001
            )
            if not is_unit_scale:
                lines.append(
                    f"    {var_name}.setScale("
                    f"{format_float(scale.x)}, "
                    f"{format_float(scale.y)}, "
                    f"{format_float(scale.z)});"
                )

            # Add blank line between objects
            lines.append("")

        except Exception as e:
            # Fallback if mathutils not available (testing scenario)
            # Use simple position conversion
            blender_pos = (
                world_matrix[0][3] if hasattr(world_matrix, '__getitem__') else 0,
                world_matrix[1][3] if hasattr(world_matrix, '__getitem__') else 0,
                world_matrix[2][3] if hasattr(world_matrix, '__getitem__') else 0
            )
            ar_pos = coordinate_convert.convert_position(blender_pos)
            pos_comment = coordinate_convert.format_position_comment(blender_pos, ar_pos)

            lines.append(f"    // {original_name} ({pos_comment})")
            lines.append(f'    var {var_name} = Aria.createObject("{original_name}", "{model_ref}");')
            lines.append(
                f"    {var_name}.setPosition("
                f"{format_float(ar_pos[0])}, "
                f"{format_float(ar_pos[1])}, "
                f"{format_float(ar_pos[2])});"
            )
            lines.append(f"    {var_name}.setRotation(0.0000, 0.0000, 0.0000, 1.0000);")
            lines.append("")

    # Footer
    lines.append("    return null;")
    lines.append("}")
    lines.append("")  # Trailing newline

    return "\n".join(lines)
