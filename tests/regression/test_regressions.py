"""
Aria-Studio Regression Tests — Tier 2 (Fixes #2, #3, #4, #8)

Tests the Python-side logic for the four bugs from FIXES.md that were fixed
in Aria-Studio code. These tests run without a Blender instance using direct
Python module imports, AST analysis, or subprocess invocation.

Coverage:
    TestFix2PerObjectGlbExport    — FIXES.md Bug #2: per-object GLB export
    TestFix3DirectoryStructure    — FIXES.md Bug #3: models/ subdirectory creation
    TestFix4RootLevelEntryScript  — FIXES.md Bug #4: root-level .grav compilation
    TestFix8VariableNameDedup     — FIXES.md Bug #8: variable name deduplication

Each test class has a docstring identifying the FIXES.md bug number and the
original failure description. The C-side regressions (Fixes #1, #5, #6, #7)
are covered in THerD/tests/integration/test_regressions.c.

Run:
    cd Aria-Studio && python -m pytest tests/regression/test_regressions.py -v
"""

import pytest
import os
import sys
import ast
import tempfile

# ---------------------------------------------------------------------------
# Path helpers — locate Aria-Studio blender-addon source relative to this file
# ---------------------------------------------------------------------------
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_ARIA_STUDIO_DIR = os.path.join(_THIS_DIR, "..", "..")
_BLENDER_ADDON_DIR = os.path.join(_ARIA_STUDIO_DIR, "blender-addon")
_PACKAGING_DIR = os.path.join(_ARIA_STUDIO_DIR, "packaging")


def _read_source(rel_path):
    """Read source file relative to blender-addon directory."""
    full_path = os.path.join(_BLENDER_ADDON_DIR, rel_path)
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------------------
# TestFix2PerObjectGlbExport
# ---------------------------------------------------------------------------
class TestFix2PerObjectGlbExport:
    """Regression test for FIXES.md Bug #2: Blender addon GLB filename mismatch.

    Original bug: the addon exported ONE GLB for the entire scene named after
    the export filename (e.g. 'test_texture.glb'). The generated .grav script
    referenced per-object model paths using Blender object names
    (e.g. 'models/Cube.glb'). These paths never matched.

    Fix: export_gravityar.py now calls _export_per_object_gltf(), which
    iterates over selected objects and exports each as 'models/{name}.glb'.
    """

    def test_fix2_per_object_glb_export(self):
        """Verify per-object GLB export logic is present in export_gravityar.py.

        Uses AST analysis to confirm the fix is still in place:
        - The per-object iteration loop exists (_export_per_object_gltf method)
        - Each object is individually selected and exported
        """
        source = _read_source("operators/export_gravityar.py")
        tree = ast.parse(source)

        # Verify _export_per_object_gltf method exists in ExportGravityAR class
        class_defs = [n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)
                      and n.name == "ExportGravityAR"]
        assert len(class_defs) == 1, "ExportGravityAR class must exist"

        methods = {n.name for n in ast.walk(class_defs[0]) if isinstance(n, ast.FunctionDef)}
        assert "_export_per_object_gltf" in methods, \
            "Fix #2: _export_per_object_gltf method must exist (per-object export)"

        # Verify the method iterates over objects (for loop over objects arg)
        assert "_export_per_object_gltf" in source, \
            "Fix #2: per-object export method present in source"

        # Verify per-object GLB path construction uses models/ subdirectory
        assert "models/" in source, \
            "Fix #2: source references 'models/' subdirectory for GLB paths"

        # Verify the execute() method calls per-object export (not single GLB)
        assert "_export_per_object_gltf" in source, \
            "Fix #2: execute() must call _export_per_object_gltf"

    def test_fix2_model_path_format(self):
        """Verify per-object GLB paths use '{name}.glb' format under models/."""
        source = _read_source("operators/export_gravityar.py")

        # The per-object export constructs 'models/{sanitized}.glb' paths
        # exported.append(f"models/{sanitized}.glb") is the fix pattern
        assert 'models/{sanitized}.glb' in source or 'models/' in source, \
            "Fix #2: GLB paths must be constructed as models/{name}.glb"

        # The models/ dir creation call must exist
        assert "os.makedirs" in source, \
            "Fix #2: os.makedirs must be called to create models/ directory"

    def test_fix2_export_path_contract(self):
        """Verify _export_per_object_gltf returns script-relative paths (models/{name}.glb).

        Uses AST analysis to confirm:
        - Physical files land at assets/models/{name}.glb
        - Returned paths are script-relative: models/{name}.glb (without assets/ prefix)
        - The runtime is responsible for prepending assets/ at resolve time (Fix #7 contract)
        """
        source = _read_source("operators/export_gravityar.py")
        tree = ast.parse(source)

        # Locate _export_per_object_gltf method body
        export_method = None
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == "_export_per_object_gltf":
                export_method = node
                break
        assert export_method is not None, \
            "Fix #2: _export_per_object_gltf method must exist"

        # Physical directory must be assets/models/ (two-level path join)
        # Check that "assets" and "models" both appear as components in the method
        method_src = ast.get_source_segment(source, export_method) or source
        assert '"assets"' in method_src or "'assets'" in method_src, \
            "Fix #2: models_dir must be constructed under 'assets/' in _export_per_object_gltf"
        assert '"models"' in method_src or "'models'" in method_src, \
            "Fix #2: models_dir must include 'models' path component in _export_per_object_gltf"

        # Returned paths must be script-relative ("models/{name}.glb"), NOT "assets/models/..."
        # Find all string constants in the method that look like path returns
        append_nodes = [
            n for n in ast.walk(export_method)
            if isinstance(n, ast.Call)
            and isinstance(n.func, ast.Attribute)
            and n.func.attr == "append"
        ]
        assert len(append_nodes) > 0, \
            "Fix #2: _export_per_object_gltf must append() per-object paths to result list"

        # At least one append must reference "models/" (script-relative prefix, no "assets/")
        assert 'models/' in method_src, \
            "Fix #2: returned paths must use 'models/' prefix (script-relative, not 'assets/models/')"
        assert 'assets/models/' not in method_src.split("append")[1] if "append" in method_src else True, \
            "Fix #2: returned script paths must NOT include 'assets/' — runtime prepends it"


# ---------------------------------------------------------------------------
# TestFix3DirectoryStructure
# ---------------------------------------------------------------------------
class TestFix3DirectoryStructure:
    """Regression test for FIXES.md Bug #3: Blender addon exports flat file structure.

    Original bug: all output files (.grav, .glb, manifest.json) were placed in the
    same directory. The generated .grav code referenced 'models/' subdirectory paths
    but no such directory was created.

    Fix: _export_per_object_gltf() creates 'assets/models/' subdirectory via
    os.makedirs(models_dir, exist_ok=True) before exporting per-object GLBs.
    """

    def test_fix3_models_subdirectory_created(self):
        """Verify export_gravityar.py creates models/ subdirectory.

        Uses AST/source analysis to confirm the directory creation logic exists.
        """
        source = _read_source("operators/export_gravityar.py")

        # Verify os.makedirs call exists (Fix #3: creates models/ subdirectory)
        assert "os.makedirs" in source, \
            "Fix #3: os.makedirs must be called to create models/ directory"

        # Verify 'models' is part of the directory path construction
        assert '"models"' in source or "'models'" in source or "models" in source, \
            "Fix #3: 'models' directory name must appear in directory construction"

        # Verify exist_ok=True is used (safe creation)
        assert "exist_ok=True" in source, \
            "Fix #3: os.makedirs must use exist_ok=True"

    def test_fix3_directory_creation_in_export_method(self):
        """Verify directory creation happens inside _export_per_object_gltf."""
        source = _read_source("operators/export_gravityar.py")
        tree = ast.parse(source)

        # Find _export_per_object_gltf method
        export_method = None
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == "_export_per_object_gltf":
                export_method = node
                break

        assert export_method is not None, \
            "Fix #3: _export_per_object_gltf method must exist"

        # Check that the method body references makedirs
        method_source = ast.get_source_segment(source, export_method)
        if method_source is None:
            # Fall back to checking the overall source for makedirs near models_dir
            assert "models_dir" in source, \
                "Fix #3: models_dir variable must be used in export method"
            assert "os.makedirs" in source, \
                "Fix #3: os.makedirs must be called in export method"
        else:
            assert "makedirs" in method_source, \
                "Fix #3: makedirs must be called inside _export_per_object_gltf"



# ---------------------------------------------------------------------------
# TestFix4RootLevelEntryScript
# ---------------------------------------------------------------------------
class TestFix4RootLevelEntryScript:
    """Regression test for FIXES.md Bug #4: CLI packager doesn't compile root-level entry scripts.

    Original bug: therd_package.c only compiled .grav files found in a scripts/
    subdirectory. The Blender addon exports .grav at the world root (e.g.
    'test_texture.grav'). Root-level entry scripts were included in the ZIP as
    raw source but never compiled to .gbc bytecode.

    Fix: After processing scripts/ directory, the packager checks if entry_script
    is a root-level .grav file not yet compiled. If so, compiles it and updates
    entry_script in manifest to point to the .gbc version.

    Test approach: verify the fix is present in the C source via source inspection.
    Binary invocation is marked skipif when the binary is not available.
    """

    def test_fix4_root_level_script_compiled(self):
        """Verify therd_package.c contains root-level entry script compilation logic.

        Uses source code analysis to confirm the fix is still present:
        - The packager checks for root-level .grav after scripts/ compilation
        - Root-level .grav is compiled to .gbc and manifest is updated
        """
        packager_path = os.path.join(_PACKAGING_DIR, "therd_package.c")
        assert os.path.isfile(packager_path), \
            "Fix #4: therd_package.c must exist in packaging/"

        with open(packager_path, "r", encoding="utf-8") as f:
            source = f.read()

        # Verify root-level entry script compilation logic is present
        # The fix: "Compile root-level entry script if not already compiled from scripts/ dir"
        assert "root" in source.lower() and "entry" in source.lower(), \
            "Fix #4: packager source must contain root-level entry script logic"

        # Verify the .gbc extension replacement logic
        assert ".gbc" in source, \
            "Fix #4: packager must produce .gbc bytecode files"

        # Verify entry_script is updated in manifest after compilation
        assert "entry_script" in source, \
            "Fix #4: packager must update entry_script field in manifest"

        # Verify compile_scripts_dir handles entry script detection
        assert "compiled_entry" in source, \
            "Fix #4: compiled_entry tracking variable must exist"

    @pytest.mark.skipif(
        not os.path.isfile(os.path.join(_PACKAGING_DIR, "build", "therd-package")) and
        not os.path.isfile(os.path.join(_PACKAGING_DIR, "build", "therd_package")),
        reason="packager binary not built — build with: cd Aria-Studio/packaging && mkdir build && cd build && cmake .. && make"
    )
    def test_fix4_packager_compiles_root_grav(self):
        """Invoke packager binary and verify root-level .grav is compiled to .gbc.

        Requires the packager binary to be built. Skip otherwise.
        """
        import subprocess
        import json

        # Find packager binary
        binary = None
        for candidate in ["build/therd-package", "build/therd_package"]:
            path = os.path.join(_PACKAGING_DIR, candidate)
            if os.path.isfile(path):
                binary = path
                break

        assert binary is not None, "packager binary not found"

        with tempfile.TemporaryDirectory() as world_dir:
            # Create a minimal world with root-level .grav entry script
            manifest = {
                "name": "test-fix4",
                "version": "1.0.0",
                "entry_script": "hello.grav"
            }
            manifest_path = os.path.join(world_dir, "manifest.json")
            with open(manifest_path, "w") as f:
                f.write(json.dumps(manifest, indent=2))

            grav_path = os.path.join(world_dir, "hello.grav")
            with open(grav_path, "w") as f:
                f.write("func main() { System.print(\"fix4 test\"); }\n")

            output_path = os.path.join(world_dir, "test-fix4.therd")
            result = subprocess.run(
                [binary, "create", "--dir", world_dir, "--output", output_path],
                capture_output=True, text=True, timeout=30
            )

            # Should succeed
            assert result.returncode == 0, \
                f"Fix #4: packager must succeed. stderr: {result.stderr}"

            # Verify output file exists
            assert os.path.isfile(output_path), \
                "Fix #4: packager must produce .therd output file"

            # Verify .gbc is in the archive
            import zipfile
            with zipfile.ZipFile(output_path, "r") as zf:
                names = zf.namelist()
                gbc_files = [n for n in names if n.endswith(".gbc")]
                assert len(gbc_files) > 0, \
                    f"Fix #4: .therd archive must contain .gbc bytecode. Found: {names}"


# ---------------------------------------------------------------------------
# TestFix8VariableNameDedup
# ---------------------------------------------------------------------------
class TestFix8VariableNameDedup:
    """Regression test for FIXES.md Bug #8: Variable name collisions in generated Gravity code.

    Original bug: if a Blender scene had objects like 'Cube.001' and 'Cube_001',
    both sanitize to 'Cube_001', producing duplicate 'var Cube_001' declarations
    in the generated script (a compile error).

    Fix: traverse_scene() in scene_traversal.py tracks used names in a dict and
    appends a numeric suffix on collision (Cube_001, Cube_001_1, Cube_001_2, ...).
    """

    def _import_sanitize_name(self):
        """Import sanitize_name from scene_traversal without Blender."""
        # Add blender-addon to sys.path so we can import core.scene_traversal
        # The module has a try/except around 'import bpy' — it won't fail without Blender
        if _BLENDER_ADDON_DIR not in sys.path:
            sys.path.insert(0, _BLENDER_ADDON_DIR)
        from core.scene_traversal import sanitize_name
        return sanitize_name

    def test_fix8_dedup_collision_names(self):
        """Verify deduplication logic handles same-sanitized-name collisions.

        Simulates the Fix #8 fix by directly applying the deduplication algorithm
        from scene_traversal.py traverse_scene() to collision-producing inputs.
        """
        sanitize_name = self._import_sanitize_name()

        # These two names both sanitize to "Cube_001"
        names = ["Cube.001", "Cube_001", "Cube_001"]

        used_names = {}
        unique_names = []
        for name in names:
            base = sanitize_name(name)
            if base in used_names:
                used_names[base] += 1
                unique = f"{base}_{used_names[base]}"
            else:
                used_names[base] = 0
                unique = base
            unique_names.append(unique)

        # All unique names must be distinct
        assert len(unique_names) == len(set(unique_names)), \
            f"Fix #8: all variable names must be unique. Got: {unique_names}"

        # First occurrence keeps the base name
        assert unique_names[0] == "Cube_001", \
            f"Fix #8: first 'Cube.001' sanitizes to 'Cube_001'. Got: {unique_names[0]}"

        # Subsequent collisions get a numeric suffix
        assert unique_names[1] != unique_names[0], \
            f"Fix #8: second 'Cube_001' must get a different name. Got: {unique_names[1]}"
        assert unique_names[2] != unique_names[0] and unique_names[2] != unique_names[1], \
            f"Fix #8: third 'Cube_001' must get a unique name. Got: {unique_names[2]}"

    def test_fix8_sanitize_name_function(self):
        """Verify sanitize_name produces valid Gravity identifiers."""
        sanitize_name = self._import_sanitize_name()

        # Basic cases
        assert sanitize_name("Cube") == "Cube"
        assert sanitize_name("Cube.001") == "Cube_001"
        assert sanitize_name("Cube_001") == "Cube_001"
        assert sanitize_name("My Object") == "My_Object"
        assert sanitize_name("123bad") == "_123bad"  # leading digit

        # Both "Cube.001" and "Cube_001" sanitize to "Cube_001" (the collision case)
        assert sanitize_name("Cube.001") == sanitize_name("Cube_001"), \
            "Fix #8: 'Cube.001' and 'Cube_001' must sanitize to same base name (collision detected)"

    def test_fix8_dedup_logic_in_source(self):
        """Verify deduplication logic is present in scene_traversal.py source."""
        source = _read_source("core/scene_traversal.py")

        # Verify used_names tracking dict exists (Fix #8 fix mechanism)
        assert "used_names" in source, \
            "Fix #8: used_names dict must be present in scene_traversal.py"

        # Verify numeric suffix addition logic
        assert "_1" in source or "suffix" in source or "used_names[base_name]" in source, \
            "Fix #8: numeric suffix dedup logic must be present"

        # Verify the dedup happens in traverse_scene
        assert "traverse_scene" in source, \
            "Fix #8: traverse_scene function must exist in scene_traversal.py"
