"""
Pytest configuration for Aria-Studio.

Adds blender-addon/ to sys.path so test files in tests/unit/ and
tests/regression/ can import from blender-addon/core/ without Blender
installed. The blender-addon/__init__.py is never imported here — only
the core/ subpackage is exposed via sys.path.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "blender-addon"))
