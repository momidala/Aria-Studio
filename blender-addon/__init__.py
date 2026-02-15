"""
GravityAR Blender Exporter
Export Blender scenes to GravityAR world definitions
"""

bl_info = {
    "name": "GravityAR Exporter",
    "author": "THerD Platform",
    "version": (1, 0, 0),
    "blender": (3, 0, 0),
    "location": "File > Export, View3D > Sidebar > GravityAR",
    "description": "Export Blender scenes to GravityAR world definitions",
    "category": "Import-Export",
}

import bpy
from . import operators


def menu_func_export(self, context):
    """Add export option to File > Export menu"""
    self.layout.operator(
        operators.export_gravityar.ExportGravityAR.bl_idname,
        text="GravityAR (.grav)"
    )


def register():
    """Register addon classes and menu items"""
    # Import all classes
    from .operators.export_gravityar import ExportGravityAR
    from .utils.auto_fix import GRAVITYAR_OT_auto_fix
    from .ui.preferences import GravityARPreferences
    from .ui.export_panel import GRAVITYAR_PT_export_panel

    # Register in order: preferences first, then operators, then panels
    bpy.utils.register_class(GravityARPreferences)
    bpy.utils.register_class(GRAVITYAR_OT_auto_fix)
    bpy.utils.register_class(ExportGravityAR)
    bpy.utils.register_class(GRAVITYAR_PT_export_panel)

    # Register scene property for export panel
    bpy.types.Scene.gravityar_export_selected = bpy.props.BoolProperty(
        name="Selected Only",
        description="Export only selected objects",
        default=False
    )

    # Add to export menu
    bpy.types.TOPBAR_MT_file_export.append(menu_func_export)


def unregister():
    """Unregister addon classes and menu items"""
    from .operators.export_gravityar import ExportGravityAR
    from .utils.auto_fix import GRAVITYAR_OT_auto_fix
    from .ui.preferences import GravityARPreferences
    from .ui.export_panel import GRAVITYAR_PT_export_panel

    # Remove from export menu
    bpy.types.TOPBAR_MT_file_export.remove(menu_func_export)

    # Clean up scene property
    if hasattr(bpy.types.Scene, "gravityar_export_selected"):
        del bpy.types.Scene.gravityar_export_selected

    # Unregister classes in reverse order
    bpy.utils.unregister_class(GRAVITYAR_PT_export_panel)
    bpy.utils.unregister_class(ExportGravityAR)
    bpy.utils.unregister_class(GRAVITYAR_OT_auto_fix)
    bpy.utils.unregister_class(GravityARPreferences)


if __name__ == "__main__":
    register()
