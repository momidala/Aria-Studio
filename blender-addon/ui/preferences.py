"""
GravityAR Addon Preferences

Configuration for export behavior and indoor positioning
"""

import bpy
from bpy.props import StringProperty, BoolProperty, EnumProperty, IntProperty, FloatProperty


class GravityARPreferences(bpy.types.AddonPreferences):
    """GravityAR addon preferences"""

    # Must match addon package name
    bl_idname = "blender-addon"

    # Export preferences
    export_path: StringProperty(
        name="Default Export Path",
        subtype='DIR_PATH',
        default="",
        description="Optional default directory for exports"
    )

    auto_export_gltf: BoolProperty(
        name="Export glTF Model",
        default=True,
        description="Also export glTF (.glb) model alongside GravityAR code"
    )

    show_blender_coords: BoolProperty(
        name="Show Blender Coordinates in Comments",
        default=True,
        description="Add comments showing original Blender coordinates in exported code"
    )

    # World type and positioning
    world_type: EnumProperty(
        name="World Type",
        items=[
            ('OUTDOOR', "Outdoor (GPS)", "GPS-anchored world for outdoor use"),
            ('INDOOR', "Indoor (AprilTag)", "AprilTag marker-anchored world for indoor use like museums/galleries")
        ],
        default='OUTDOOR',
        description="How this world establishes its origin reference point for multi-user alignment"
    )

    # AprilTag settings (for indoor worlds)
    apriltag_marker_id: IntProperty(
        name="AprilTag Marker ID",
        default=0,
        min=0,
        max=586,
        description="ID of the AprilTag marker placed at the world origin. Print this tag and place it at the physical origin point (e.g., museum entrance). All users' AR devices will detect this tag to align the world."
    )

    apriltag_family: EnumProperty(
        name="AprilTag Family",
        items=[
            ('tag36h11', "tag36h11 (recommended)", "Standard 36-bit tag family, robust detection"),
            ('tag25h9', "tag25h9", "25-bit tag family, smaller tags"),
            ('tag16h5', "tag16h5", "16-bit tag family, smallest tags but fewer IDs")
        ],
        default='tag36h11',
        description="AprilTag family. tag36h11 is recommended for best detection accuracy."
    )

    apriltag_size: FloatProperty(
        name="Tag Size (meters)",
        default=0.17,
        min=0.05,
        max=1.0,
        precision=3,
        description="Physical size of the printed AprilTag marker in meters. Measure the black square edge length."
    )

    def draw(self, context):
        layout = self.layout

        # Export settings section
        box = layout.box()
        box.label(text="Export Settings", icon='EXPORT')
        box.prop(self, "export_path")
        box.prop(self, "auto_export_gltf")
        box.prop(self, "show_blender_coords")

        # World positioning section
        layout.separator()
        box = layout.box()
        box.label(text="World Positioning", icon='WORLD')
        box.prop(self, "world_type")

        # Show AprilTag settings only for indoor worlds
        if self.world_type == 'INDOOR':
            box.separator()
            box.label(text="AprilTag Configuration", icon='ORIENTATION_VIEW')

            # Help text
            help_box = box.box()
            help_box.label(text="For indoor multi-user worlds:", icon='INFO')
            help_box.label(text="1. Print an AprilTag marker with the ID specified below")
            help_box.label(text="2. Place it at the world origin in the physical space")
            help_box.label(text="3. All users' AR devices will detect this marker to")
            help_box.label(text="   establish a shared coordinate frame")

            box.prop(self, "apriltag_marker_id")
            box.prop(self, "apriltag_family")
            box.prop(self, "apriltag_size")


# Registration
def register():
    bpy.utils.register_class(GravityARPreferences)


def unregister():
    bpy.utils.unregister_class(GravityARPreferences)
