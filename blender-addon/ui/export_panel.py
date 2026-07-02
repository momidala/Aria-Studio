"""
GravityAR Sidebar Panel

Continuous validation display with auto-fix buttons and export control
"""

import bpy
from ..core import validator
from ..utils.error_messages import ERROR, WARNING, INFO


class GRAVITYAR_PT_export_panel(bpy.types.Panel):
    """GravityAR Export Panel in 3D View Sidebar"""

    bl_label = "GravityAR Export"
    bl_idname = "VIEW3D_PT_gravityar"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'GravityAR'

    def draw(self, context):
        layout = self.layout
        scene = context.scene

        # Resolve addon preferences (may be absent during first-install frame)
        addon_prefs = context.preferences.addons.get("blender-addon")
        prefs = addon_prefs.preferences if addon_prefs else None
        world_type = prefs.world_type if prefs else 'OUTDOOR'

        # 1. Run validation (pass world_type so W7 can fire for outdoor worlds)
        errors = validator.validate_scene(scene, selected_only=False, world_type=world_type)

        # Separate by severity
        blocking_errors = [e for e in errors if e['severity'] == ERROR]
        warnings = [e for e in errors if e['severity'] == WARNING]
        infos = [e for e in errors if e['severity'] == INFO]

        # 2. Validation status section
        box = layout.box()

        if not errors:
            # All good - green checkmark
            row = box.row()
            row.label(text="Scene ready to export", icon='CHECKMARK')

        elif blocking_errors:
            # Errors - red box
            row = box.row()
            row.alert = True
            row.label(text=f"{len(blocking_errors)} Errors (blocks export)", icon='ERROR')

            # Show first 3 errors with auto-fix buttons
            for error in blocking_errors[:3]:
                error_box = box.box()
                error_box.label(text=error['message'])
                error_box.label(text=f"Fix: {error['fix']}", icon='INFO')

                # Auto-fix button if available
                if error['auto_fix_op']:
                    op = error_box.operator("gravityar.auto_fix", text="Auto-Fix", icon='TOOL_SETTINGS')
                    op.fix_type = error['auto_fix_op']
                    op.object_name = error['object'] or ""

            if len(blocking_errors) > 3:
                box.label(text=f"... and {len(blocking_errors) - 3} more errors")

        elif warnings:
            # Warnings only - yellow box
            row = box.row()
            row.label(text=f"{len(warnings)} Warnings", icon='INFO')

            # Show first 3 warnings
            for warning in warnings[:3]:
                warning_box = box.box()
                warning_box.label(text=warning['message'])
                warning_box.label(text=f"Fix: {warning['fix']}", icon='INFO')

                # Auto-fix button if available
                if warning['auto_fix_op']:
                    op = warning_box.operator("gravityar.auto_fix", text="Auto-Fix", icon='TOOL_SETTINGS')
                    op.fix_type = warning['auto_fix_op']
                    op.object_name = warning['object'] or ""

            if len(warnings) > 3:
                box.label(text=f"... and {len(warnings) - 3} more warnings")

        # 3. Separator
        layout.separator()

        # 4. Export section
        export_box = layout.box()
        export_box.label(text="Export", icon='EXPORT')

        # Selected Only toggle
        export_box.prop(scene, "gravityar_export_selected", text="Selected Only")

        # Export button - disabled if blocking errors exist
        row = export_box.row()
        row.enabled = len(blocking_errors) == 0
        row.operator("export_scene.gravityar", text="Export to GravityAR", icon='EXPORT')

        if len(blocking_errors) > 0:
            export_box.label(text="Fix errors above to enable export", icon='ERROR')

        # 5. Info section
        layout.separator()
        info_box = layout.box()
        info_box.label(text="Scene Info", icon='INFO')

        # Count mesh objects
        mesh_count = len([obj for obj in scene.objects if obj.type == 'MESH'])
        info_box.label(text=f"{mesh_count} mesh objects")

        # Total polygons
        total_polys = sum(len(obj.data.polygons) for obj in scene.objects if obj.type == 'MESH')
        info_box.label(text=f"{total_polys} polygons total")

        # Coordinate system info
        info_box.label(text="Blender Z-up → THerD Y-up (automatic)")

        # 6. GPS origin (outdoor/GPS worlds only — hidden for INDOOR worlds)
        if world_type != 'INDOOR':
            layout.separator()
            gps_box = layout.box()
            gps_box.label(text="World GPS Origin", icon='WORLD')
            gps_box.label(
                text="Real-world location of scene [0,0,0]",
                icon='INFO',
            )
            gps_box.prop(scene, "gravityar_gps_latitude")
            gps_box.prop(scene, "gravityar_gps_longitude")
            gps_box.prop(scene, "gravityar_gps_altitude")


class GRAVITYAR_PT_object_panel(bpy.types.Panel):
    """THerD Object Properties sub-panel — occlusion designation per object."""

    bl_label = "THerD Object"
    bl_idname = "VIEW3D_PT_gravityar_object"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'GravityAR'
    bl_parent_id = "VIEW3D_PT_gravityar"
    bl_options = {'DEFAULT_CLOSED'}

    @classmethod
    def poll(cls, context):
        """Show only when a mesh object is active."""
        return context.active_object is not None and context.active_object.type == 'MESH'

    def draw(self, context):
        layout = self.layout
        obj = context.active_object
        layout.prop(obj, "therd_occlusion")


# NOTE: Registration is centralized in the addon's __init__.py (register()/
# unregister()), which registers both panel classes and all scene/object
# properties. Do not add a local register() here.
