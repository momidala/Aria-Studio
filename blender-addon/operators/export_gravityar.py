"""
GravityAR Export Operator

Exports Blender scene to GravityAR world files (.grav + .glb + manifest.json)
"""

import bpy
import os
import json
from bpy.props import StringProperty, BoolProperty
from bpy_extras.io_utils import ExportHelper
from ..core import scene_traversal, code_generator, validator
from ..utils.error_messages import ERROR, WARNING


class ExportGravityAR(bpy.types.Operator, ExportHelper):
    """Export scene to GravityAR world definition"""

    bl_idname = "export_scene.gravityar"
    bl_label = "Export GravityAR"
    bl_options = {'PRESET'}

    # File extension
    filename_ext = ".grav"

    # File browser filter
    filter_glob: StringProperty(
        default="*.grav",
        options={'HIDDEN'}
    )

    # Export options
    export_selected: BoolProperty(
        name="Selected Only",
        description="Export only selected objects",
        default=False
    )

    def execute(self, context):
        """Execute export operation"""

        # Get preferences
        prefs = context.preferences.addons.get("blender-addon")
        if prefs:
            prefs = prefs.preferences
        else:
            prefs = None

        # 0. Validate scene before export
        errors = validator.validate_scene(context.scene, self.export_selected)
        blocking_errors = [e for e in errors if e['severity'] == ERROR]
        warnings = [e for e in errors if e['severity'] == WARNING]

        # Block export if ERROR-severity issues exist
        if blocking_errors:
            self.report(
                {'ERROR'},
                f"Export blocked: {len(blocking_errors)} errors. Check GravityAR panel in sidebar."
            )
            return {'CANCELLED'}

        # Warn if warnings exist
        if warnings:
            self.report(
                {'WARNING'},
                f"Exported with {len(warnings)} warnings. Check GravityAR panel for details."
            )

        # 1. Traverse scene and collect mesh objects
        objects = scene_traversal.traverse_scene(
            context.scene,
            selected_only=self.export_selected
        )

        # Handle empty scene
        if not objects:
            self.report(
                {'WARNING'},
                "No mesh objects found in scene"
            )
            # Still create empty .grav file
            empty_code = self._generate_empty_world(context.scene)
            self._write_grav_file(self.filepath, empty_code)
            return {'FINISHED'}

        # 2. Generate Gravity code
        gravity_code = code_generator.generate(objects, context.scene)

        # 3. Write .grav file
        self._write_grav_file(self.filepath, gravity_code)

        # 4. Export glTF model alongside (if enabled in preferences)
        gltf_path = None
        if prefs is None or prefs.auto_export_gltf:
            gltf_path = self._get_gltf_path(self.filepath)
            self._export_gltf(gltf_path)

        # 5. Generate manifest.json
        manifest_path = self._get_manifest_path(self.filepath)
        self._write_manifest(manifest_path, context.scene, gltf_path, prefs)

        # 6. Report success
        self.report(
            {'INFO'},
            f"Exported {len(objects)} objects to {self.filepath}"
        )

        return {'FINISHED'}

    def _generate_empty_world(self, scene):
        """Generate empty main() function for scenes with no mesh objects"""
        return "\n".join([
            "// GravityAR World - Exported from Blender",
            f"// Scene: {scene.name}",
            "// Objects: 0",
            "",
            "func main() {",
            "    // No mesh objects in scene",
            "    return null;",
            "}",
            ""
        ])

    def _write_grav_file(self, filepath, content):
        """Write Gravity source code to file"""
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    def _get_gltf_path(self, grav_filepath):
        """Get glTF file path from .grav file path"""
        base = os.path.splitext(grav_filepath)[0]
        return base + ".glb"

    def _export_gltf(self, gltf_path):
        """Export glTF model using Blender's built-in exporter"""
        try:
            bpy.ops.export_scene.gltf(
                filepath=gltf_path,
                export_format='GLB',
                use_selection=self.export_selected,
                export_materials='EXPORT',
                export_cameras=False,
                export_lights=False
            )
        except Exception as e:
            # If glTF export fails, log but don't block .grav export
            print(f"Warning: glTF export failed: {e}")

    def _get_manifest_path(self, grav_filepath):
        """Get manifest.json file path from .grav file path"""
        base_dir = os.path.dirname(grav_filepath)
        return os.path.join(base_dir, "manifest.json")

    def _write_manifest(self, manifest_path, scene, gltf_path, prefs):
        """
        Write manifest.json for world packaging

        Args:
            manifest_path: Path to write manifest.json
            scene: Blender scene
            gltf_path: Path to glTF model (or None if not exported)
            prefs: GravityARPreferences instance (or None)
        """
        # Base manifest data
        manifest = {
            "name": scene.name or "Untitled World",
            "version": "1.0.0",
            "entry_script": os.path.basename(self.filepath)
        }

        # Assets section
        assets = {
            "scripts": [os.path.basename(self.filepath)]
        }

        if gltf_path:
            gltf_filename = os.path.basename(gltf_path)
            assets["models"] = [f"models/{gltf_filename}"]

        manifest["assets"] = assets

        # Add positioning config based on world type
        if prefs and prefs.world_type == 'INDOOR':
            # Indoor world - AprilTag marker origin
            manifest["slam_origin"] = {
                "type": "apriltag",
                "marker_id": prefs.apriltag_marker_id,
                "family": prefs.apriltag_family,
                "tag_size_meters": prefs.apriltag_size,
                "world_position": [0, 0, 0]
            }
        else:
            # Outdoor world - GPS origin (placeholder for artist to fill)
            manifest["gps_origin"] = {
                "latitude": 0.0,
                "longitude": 0.0,
                "altitude": 0.0
            }

        # Write manifest
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)
            f.write('\n')  # Trailing newline


# Registration
def register():
    bpy.utils.register_class(ExportGravityAR)


def unregister():
    bpy.utils.unregister_class(ExportGravityAR)
