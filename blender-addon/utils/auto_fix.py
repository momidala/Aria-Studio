"""
Auto-fix implementations for common Blender scene issues

Each function handles mode switching safety and returns True on success
"""

try:
    import bpy
    import bmesh
    HAS_BLENDER = True
except ImportError:
    HAS_BLENDER = False


def _select_only(obj):
    """
    Deselect everything, select and activate obj, and ensure object mode.

    Returns the prior selection list so the caller can pass it to
    _restore_selection() after the operator runs. Restore is intentionally
    NOT automatic (no context manager / finally): if an operator raises,
    the selection is left as-is, matching the original per-fix behavior.
    """
    original_selection = bpy.context.selected_objects[:]

    # Deselect all and select only target object
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    # Switch to object mode if needed
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')

    return original_selection


def _restore_selection(original_selection):
    """Restore a selection previously captured by _select_only()"""
    bpy.ops.object.select_all(action='DESELECT')
    for selected_obj in original_selection:
        selected_obj.select_set(True)


def auto_apply_transforms(obj):
    """
    Apply all transforms (location, rotation, scale) to object

    Args:
        obj: Blender object

    Returns:
        True on success, False on failure
    """
    if not HAS_BLENDER:
        return False

    try:
        original_selection = _select_only(obj)

        # Apply transforms
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

        _restore_selection(original_selection)

        return True

    except Exception as e:
        print(f"Auto-fix error (apply transforms): {e}")
        return False


def auto_triangulate(obj):
    """
    Triangulate mesh using bmesh (converts N-gons to triangles)

    Args:
        obj: Blender mesh object

    Returns:
        True on success, False on failure
    """
    if not HAS_BLENDER:
        return False

    try:
        # Create bmesh from mesh
        bm = bmesh.new()
        bm.from_mesh(obj.data)

        # Triangulate all faces
        bmesh.ops.triangulate(bm, faces=bm.faces)

        # Write back to mesh
        bm.to_mesh(obj.data)
        bm.free()

        # Update mesh
        obj.data.update()

        return True

    except Exception as e:
        print(f"Auto-fix error (triangulate): {e}")
        return False


def auto_set_metric_units(scene):
    """
    Set scene units to metric with 1.0 scale

    Args:
        scene: Blender scene

    Returns:
        True (always succeeds)
    """
    if not HAS_BLENDER:
        return False

    try:
        scene.unit_settings.system = 'METRIC'
        scene.unit_settings.scale_length = 1.0
        return True

    except Exception as e:
        print(f"Auto-fix error (set metric units): {e}")
        return False


def auto_recalculate_normals(obj):
    """
    Recalculate normals pointing outside

    Args:
        obj: Blender mesh object

    Returns:
        True on success, False on failure
    """
    if not HAS_BLENDER:
        return False

    try:
        original_selection = _select_only(obj)

        # Enter edit mode
        bpy.ops.object.mode_set(mode='EDIT')

        # Select all
        bpy.ops.mesh.select_all(action='SELECT')

        # Recalculate normals outside
        bpy.ops.mesh.normals_make_consistent(inside=False)

        # Return to object mode
        bpy.ops.object.mode_set(mode='OBJECT')

        _restore_selection(original_selection)

        return True

    except Exception as e:
        print(f"Auto-fix error (recalculate normals): {e}")
        return False


# Blender operator for auto-fix
if HAS_BLENDER:
    class GRAVITYAR_OT_auto_fix(bpy.types.Operator):
        """Auto-fix common scene issues"""

        bl_idname = "gravityar.auto_fix"
        bl_label = "Auto-Fix"
        bl_options = {'REGISTER', 'UNDO'}

        fix_type: bpy.props.StringProperty(name="Fix Type")
        object_name: bpy.props.StringProperty(name="Object Name")

        def execute(self, context):
            """Execute auto-fix based on fix_type"""

            # Handle scene-level fixes
            if self.fix_type == "set_metric_units":
                if auto_set_metric_units(context.scene):
                    self.report({'INFO'}, "Set scene units to metric")
                    return {'FINISHED'}
                else:
                    self.report({'ERROR'}, "Failed to set metric units")
                    return {'CANCELLED'}

            # Handle object-level fixes
            if not self.object_name:
                self.report({'ERROR'}, "No object specified")
                return {'CANCELLED'}

            # Find object
            obj = bpy.data.objects.get(self.object_name)
            if not obj:
                self.report({'ERROR'}, f"Object '{self.object_name}' not found")
                return {'CANCELLED'}

            # Dispatch to appropriate fix function
            success = False
            message = ""

            if self.fix_type == "apply_transforms":
                success = auto_apply_transforms(obj)
                message = f"Applied transforms to '{self.object_name}'"

            elif self.fix_type == "triangulate":
                success = auto_triangulate(obj)
                message = f"Triangulated '{self.object_name}'"

            elif self.fix_type == "recalculate_normals":
                success = auto_recalculate_normals(obj)
                message = f"Recalculated normals for '{self.object_name}'"

            elif self.fix_type == "apply_transforms_and_normals":
                # Combined fix for negative scale
                success = auto_apply_transforms(obj)
                if success:
                    success = auto_recalculate_normals(obj)
                message = f"Applied transforms and recalculated normals for '{self.object_name}'"

            else:
                self.report({'ERROR'}, f"Unknown fix type: {self.fix_type}")
                return {'CANCELLED'}

            # Report result
            if success:
                self.report({'INFO'}, message)
                return {'FINISHED'}
            else:
                self.report({'ERROR'}, f"Failed: {message}")
                return {'CANCELLED'}


    # Registration
    def register():
        bpy.utils.register_class(GRAVITYAR_OT_auto_fix)


    def unregister():
        bpy.utils.unregister_class(GRAVITYAR_OT_auto_fix)
