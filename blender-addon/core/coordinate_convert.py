"""
Coordinate System Conversion Module

Converts between Blender's Z-up coordinate system and THerD's Y-up coordinate system.

Blender uses Z-up (standard for 3D modeling): +X right, +Y forward, +Z up
THerD uses Y-up (standard for AR/game engines): +X right, +Y up, +Z forward

Conversion is achieved by rotating -90 degrees around the X axis.
"""

import math


def blender_to_ar_matrix():
    """
    Returns 4x4 rotation matrix for Z-up to Y-up conversion.

    Rotates -90 degrees around X axis to convert:
    - Blender +Z (up) becomes THerD +Y (up)
    - Blender +Y (forward) becomes THerD -Z (forward)

    Returns:
        mathutils.Matrix: 4x4 rotation matrix
    """
    try:
        from mathutils import Matrix
        return Matrix.Rotation(math.radians(-90), 4, 'X')
    except ImportError:
        # Fallback for testing without Blender
        return None


def convert_transform(blender_matrix):
    """
    Convert a Blender world matrix to THerD coordinate system.

    Args:
        blender_matrix: 4x4 matrix from Blender (obj.matrix_world)

    Returns:
        tuple: (location, rotation_euler_xyz, scale) as mathutils vectors
    """
    try:
        from mathutils import Matrix

        # Apply conversion matrix
        conversion = blender_to_ar_matrix()
        converted_matrix = conversion @ blender_matrix

        # Decompose into components
        location, rotation, scale = converted_matrix.decompose()

        # Convert quaternion to euler (XYZ order)
        rotation_euler = rotation.to_euler('XYZ')

        return (location, rotation_euler, scale)
    except ImportError:
        # Fallback for testing without Blender
        return None


def convert_position(blender_vec3):
    """
    Convert a single position vector from Blender to THerD coordinates.

    Direct coordinate swap for Z-up to Y-up:
    - X stays X (right direction unchanged)
    - Y becomes -Z (forward becomes backward for camera-relative coords)
    - Z becomes Y (up direction)

    Args:
        blender_vec3: Tuple or vector (x, y, z) in Blender coordinates

    Returns:
        tuple: (x, y, z) in THerD coordinates

    Examples:
        Blender (0, 0, 1) Z-up -> THerD (0, 1, 0) Y-up
        Blender (1, 2, 3) -> THerD (1, 3, -2)
    """
    x, y, z = blender_vec3[0], blender_vec3[1], blender_vec3[2]
    return (x, z, -y)


def format_position_comment(original_blender_pos, converted_pos):
    """
    Generate inline comment showing coordinate conversion for learning.

    Helps artists understand the relationship between Blender and THerD coordinates.

    Args:
        original_blender_pos: (x, y, z) in Blender space
        converted_pos: (x, y, z) in THerD space

    Returns:
        str: Comment string showing both coordinate systems

    Example:
        "Blender coords: x=1.0, y=2.0, z=3.0"
    """
    bx, by, bz = original_blender_pos
    return f"Blender coords: x={bx:.4f}, y={by:.4f}, z={bz:.4f}"
