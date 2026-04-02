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

        # 4. Export per-object glTF models into models/ subdirectory
        exported_models = []
        if prefs is None or prefs.auto_export_gltf:
            exported_models = self._export_per_object_gltf(
                context, objects, self.filepath
            )

        # 5. Generate manifest.json
        manifest_path = self._get_manifest_path(self.filepath)
        self._write_manifest(
            manifest_path, context.scene, exported_models, prefs
        )

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

    def _export_per_object_gltf(self, context, objects, grav_filepath):
        """Export each mesh object as its own GLB into assets/models/ subdirectory.

        Returns list of script-relative model paths (e.g. ['models/Cube.glb']).
        Script paths are relative to the assets/ directory — the runtime prepends
        'assets/' when resolving. Physical files land at assets/models/{name}.glb.
        """
        base_dir = os.path.dirname(grav_filepath)
        models_dir = os.path.join(base_dir, "assets", "models")
        os.makedirs(models_dir, exist_ok=True)

        exported = []

        # Save current selection
        orig_selected = [o for o in context.scene.objects if o.select_get()]
        orig_active = context.view_layer.objects.active

        for obj_data in objects:
            obj = obj_data['object']
            sanitized = obj_data['name']
            glb_path = os.path.join(models_dir, f"{sanitized}.glb")

            try:
                # Select only this object
                bpy.ops.object.select_all(action='DESELECT')
                obj.select_set(True)
                context.view_layer.objects.active = obj

                bpy.ops.export_scene.gltf(
                    filepath=glb_path,
                    export_format='GLB',
                    use_selection=True,
                    export_materials='EXPORT',
                    export_cameras=False,
                    export_lights=False
                )
                exported.append(f"models/{sanitized}.glb")
            except Exception as e:
                print(f"Warning: glTF export failed for {obj.name}: {e}")

        # Restore original selection
        bpy.ops.object.select_all(action='DESELECT')
        for obj in orig_selected:
            obj.select_set(True)
        context.view_layer.objects.active = orig_active

        return exported

    def _get_manifest_path(self, grav_filepath):
        """Get manifest.json file path from .grav file path"""
        base_dir = os.path.dirname(grav_filepath)
        return os.path.join(base_dir, "manifest.json")

    def _write_manifest(self, manifest_path, scene, exported_models, prefs):
        """
        Write manifest.json for world packaging

        Args:
            manifest_path: Path to write manifest.json
            scene: Blender scene
            exported_models: List of relative model paths
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

        if exported_models:
            assets["models"] = exported_models

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
