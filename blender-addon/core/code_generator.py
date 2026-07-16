"""
Gravity Code Generator Module

Generates GravityAR Gravity source code from Blender scene data.
"""

from . import coordinate_convert

# End-of-generated-section marker. Must match SPEC-ARIA-STUDIO.md #2.6.2
# verbatim (including the em-dash) -- merge_generated() locates this exact
# line to decide what is safe to regenerate vs. what is artist-owned.
END_GENERATED_MARKER = "// === END GENERATED — YOUR CODE BELOW ==="


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

        # Determine the Aria API call to use.
        # Objects flagged therd_occlusion=True generate Aria.createOccluder()
        # (depth-write-only pass); all others generate Aria.createObject().
        # SPEC-GRAVITYAR-API.md §2.3, 26.8-CONTEXT.md Decision 7.
        is_occluder = obj_data.get('is_occluder', False)
        aria_create_call = "Aria.createOccluder" if is_occluder else "Aria.createObject"

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

            # Create object or occluder depending on the therd_occlusion flag
            lines.append(f'    var {var_name} = {aria_create_call}("{original_name}", "{model_ref}");')

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
            lines.append(f'    var {var_name} = {aria_create_call}("{original_name}", "{model_ref}");')
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
    lines.append(END_GENERATED_MARKER)
    lines.append("")  # Trailing newline

    return "\n".join(lines)


def merge_generated(existing_text, new_generated):
    """
    Merge freshly generated code with the artist section of an existing
    .grav file, per SPEC-ARIA-STUDIO.md #2.6.2.

    On re-export, an artist may have hand-written code below the
    END_GENERATED_MARKER line in the file already on disk. This function
    preserves that artist section byte-for-byte by splicing the newly
    generated content (which already ends with the marker) together with
    everything that followed the marker in existing_text.

    This is a pure text operation -- no file I/O, no bpy. Safe to unit test
    without Blender.

    Args:
        existing_text (str or None): Current on-disk .grav file contents.
            None or "" means there is no existing file (first export).
        new_generated (str): Freshly generated code from generate(). Must
            already end with END_GENERATED_MARKER.

    Returns:
        tuple: (status, text)
            ("new", new_generated) -- no existing file; caller should write
                new_generated as-is.
            ("merged", text) -- existing_text contained the marker; text is
                the new generated section spliced with the preserved artist
                section and is safe to write.
            ("no_marker", None) -- existing_text is non-empty but does NOT
                contain the marker. The caller MUST NOT overwrite the file;
                it must warn the artist instead so hand-written code with no
                recognizable boundary is never silently destroyed.
    """
    if not existing_text:
        return ("new", new_generated)

    marker_index = existing_text.find(END_GENERATED_MARKER)
    if marker_index == -1:
        return ("no_marker", None)

    # Everything after the marker line in the existing file is the artist's.
    artist_section = existing_text[marker_index + len(END_GENERATED_MARKER):]

    # new_generated already ends with "...MARKER\n" (see generate()'s
    # footer). Strip that trailing newline before appending the preserved
    # artist section verbatim so we don't duplicate or lose a byte of it.
    merged = new_generated.rstrip("\n") + artist_section
    return ("merged", merged)
