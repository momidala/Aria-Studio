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
    from .ui.export_panel import GRAVITYAR_PT_export_panel, GRAVITYAR_PT_object_panel

    # Register in order: preferences first, then operators, then panels.
    # GRAVITYAR_PT_object_panel must come after its parent GRAVITYAR_PT_export_panel.
    bpy.utils.register_class(GravityARPreferences)
    bpy.utils.register_class(GRAVITYAR_OT_auto_fix)
    bpy.utils.register_class(ExportGravityAR)
    bpy.utils.register_class(GRAVITYAR_PT_export_panel)
    bpy.utils.register_class(GRAVITYAR_PT_object_panel)

    # Register scene property for export panel
    bpy.types.Scene.gravityar_export_selected = bpy.props.BoolProperty(
        name="Selected Only",
        description="Export only selected objects",
        default=False
    )

    # Per-object occlusion property.
    # Registered on bpy.types.Object (not material) — one mesh can have multiple
    # materials but only one occlusion designation (SPEC-ARIA-STUDIO.md §2.11,
    # 26.8-CONTEXT.md Decision 7).  Default False — normal visible object.
    bpy.types.Object.therd_occlusion = bpy.props.BoolProperty(
        name="THerD Occluder",
        description=(
            "Mark this object as occlusion geometry. Exported as "
            "Aria.createOccluder() — depth-write only, hides AR content "
            "behind real-world surfaces. Materials are not rendered."
        ),
        default=False,
    )

    # GPS origin scene properties (outdoor worlds).
    # Stored as Blender FloatProperty (32-bit); precision=7 gives ~7 decimal
    # places in the UI, which is the practical limit of single-precision floats
    # (≈0.1 m accuracy at typical lat/lon magnitudes).  Values persist in the
    # .blend file.  Default 0.0 is the "unset" sentinel per SPEC-MASTER.md §3.2.
    bpy.types.Scene.gravityar_gps_latitude = bpy.props.FloatProperty(
        name="Latitude",
        description=(
            "World GPS origin latitude in decimal degrees (-90 to 90). "
            "Maps to local coordinate [0, 0, 0]. Set before deploying outdoors."
        ),
        default=0.0,
        min=-90.0,
        max=90.0,
        precision=7,
        unit='NONE',
    )
    bpy.types.Scene.gravityar_gps_longitude = bpy.props.FloatProperty(
        name="Longitude",
        description=(
            "World GPS origin longitude in decimal degrees (-180 to 180). "
            "Maps to local coordinate [0, 0, 0]. Set before deploying outdoors."
        ),
        default=0.0,
        min=-180.0,
        max=180.0,
        precision=7,
        unit='NONE',
    )
    bpy.types.Scene.gravityar_gps_altitude = bpy.props.FloatProperty(
        name="Altitude (m)",
        description=(
            "World GPS origin altitude in metres above sea level. "
            "Maps to local coordinate [0, 0, 0]. Set before deploying outdoors."
        ),
        default=0.0,
        min=-500.0,
        max=9000.0,
        precision=2,
        unit='NONE',
    )

    # Add to export menu
    bpy.types.TOPBAR_MT_file_export.append(menu_func_export)


def unregister():
    """Unregister addon classes and menu items"""
    from .operators.export_gravityar import ExportGravityAR
    from .utils.auto_fix import GRAVITYAR_OT_auto_fix
    from .ui.preferences import GravityARPreferences
    from .ui.export_panel import GRAVITYAR_PT_export_panel, GRAVITYAR_PT_object_panel

    # Remove from export menu
    bpy.types.TOPBAR_MT_file_export.remove(menu_func_export)

    # Clean up object property
    if hasattr(bpy.types.Object, "therd_occlusion"):
        del bpy.types.Object.therd_occlusion

    # Clean up scene properties
    if hasattr(bpy.types.Scene, "gravityar_export_selected"):
        del bpy.types.Scene.gravityar_export_selected
    for _prop in (
        "gravityar_gps_latitude",
        "gravityar_gps_longitude",
        "gravityar_gps_altitude",
    ):
        if hasattr(bpy.types.Scene, _prop):
            delattr(bpy.types.Scene, _prop)

    # Unregister classes in reverse order (child panel before parent)
    bpy.utils.unregister_class(GRAVITYAR_PT_object_panel)
    bpy.utils.unregister_class(GRAVITYAR_PT_export_panel)
    bpy.utils.unregister_class(ExportGravityAR)
    bpy.utils.unregister_class(GRAVITYAR_OT_auto_fix)
    bpy.utils.unregister_class(GravityARPreferences)


if __name__ == "__main__":
    register()
