# GravityAR Blender Addon

Export Blender scenes to GravityAR format for THerD AR platform.

## Features

- Coordinate conversion (Blender Z-up → AR Y-up)
- Automatic glTF model export
- Gravity script generation with Aria API
- Validation with auto-fix suggestions
- GPS and SLAM positioning modes

## Installation

1. Open Blender → Edit → Preferences → Add-ons
2. Click "Install" button
3. Navigate to this directory and select `__init__.py`
4. Enable "GravityAR Exporter" checkbox

## Usage

1. Create your 3D scene in Blender
2. Select objects to export (or leave all selected for full scene)
3. Open sidebar panel (N key) → GravityAR tab
4. Review validation warnings/errors
5. Click "Export GravityAR" or use File → Export → GravityAR (.grav)

See main Aria Studio docs for complete workflow.
