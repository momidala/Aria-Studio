"""
Scene Traversal Module

Walks Blender scene graph to collect mesh objects with transforms.
"""

import re


def sanitize_name(name):
    """
    Convert Blender object name to valid Gravity variable name.

    Replaces non-alphanumeric characters with underscores.

    Args:
        name: Original Blender object name

    Returns:
        str: Sanitized name (alphanumeric + underscore only)
    """
    # Replace non-alphanumeric characters with underscore
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name)

    # Ensure it starts with letter or underscore (not digit)
    if sanitized and sanitized[0].isdigit():
        sanitized = '_' + sanitized

    # Handle empty result
    if not sanitized:
        sanitized = 'object'

    return sanitized


def traverse_scene(scene, selected_only=False):
    """
    Walk Blender scene graph and collect mesh objects.

    For each mesh object, collects:
    - object: bpy object reference
    - name: sanitized name for Gravity variable
    - original_name: original Blender name (for comments)
    - world_matrix: frozen copy of obj.matrix_world
    - parent_name: parent object name if exists
    - model_ref: relative path for glTF model

    Args:
        scene: Blender scene object (bpy.context.scene)
        selected_only: If True, only collect selected objects

    Returns:
        list: List of dicts containing object data
    """
    try:
        import bpy
    except ImportError:
        # Fallback for testing without Blender
        return []

    # Store current mode and switch to OBJECT mode if needed
    # (accessing matrix_world in other modes can give incorrect values)
    current_mode = None
    if bpy.context.active_object:
        current_mode = bpy.context.active_object.mode
        if current_mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')

    objects = []

    try:
        # Walk scene collection recursively
        for obj in scene.collection.all_objects:
            # Filter by type
            if obj.type != 'MESH':
                continue

            # Filter by selection if requested
            if selected_only and not obj.select_get():
                continue

            # Collect object data
            obj_data = {
                'object': obj,
                'name': sanitize_name(obj.name),
                'original_name': obj.name,
                'world_matrix': obj.matrix_world.copy(),  # CRITICAL: copy to avoid invalidation
                'parent_name': obj.parent.name if obj.parent else None,
                'model_ref': f"models/{sanitize_name(obj.name)}.glb"
            }

            objects.append(obj_data)

    finally:
        # Restore original mode
        if current_mode and current_mode != 'OBJECT':
            bpy.ops.object.mode_set(mode=current_mode)

    return objects
