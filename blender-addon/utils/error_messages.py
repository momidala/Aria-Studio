"""
Artist-friendly error message formatting

Philosophy: Primary message is simple, fix instruction is actionable,
details are technical (for "Details" button)
"""

# Severity levels
ERROR = 'ERROR'      # Blocks export
WARNING = 'WARNING'  # Allows export with caution
INFO = 'INFO'        # Informational only

# Counter for unique error IDs
_error_counter = 0


def create_error(severity, object_name, message, fix_instruction, auto_fix_op=None, details=None):
    """
    Create an error/warning/info dict

    Args:
        severity: ERROR, WARNING, or INFO
        object_name: Name of affected object (or None for scene-level)
        message: Simple artist-friendly message (e.g., "Mesh 'Tree' has overlapping faces")
        fix_instruction: Actionable instruction (e.g., "Select mesh > Edit Mode > Mesh > Clean Up > Merge by Distance")
        auto_fix_op: Optional operator bl_idname if auto-fixable (e.g., "gravityar.auto_fix")
        details: Optional technical details (e.g., "Non-manifold geometry: 3 vertices, 2 edges detected")

    Returns:
        Dict with id, severity, object, message, fix, auto_fix_op, details
    """
    global _error_counter
    _error_counter += 1

    return {
        'id': _error_counter,
        'severity': severity,
        'object': object_name,
        'message': message,
        'fix': fix_instruction,
        'auto_fix_op': auto_fix_op,
        'details': details
    }


def format_for_panel(error):
    """
    Format error for display in Blender panel (truncated to ~60 chars)

    Args:
        error: Error dict from create_error()

    Returns:
        String suitable for panel label
    """
    msg = error['message']
    if len(msg) > 60:
        return msg[:57] + "..."
    return msg


def format_for_report(error):
    """
    Format error for operator self.report()

    Args:
        error: Error dict from create_error()

    Returns:
        Full string for operator report
    """
    parts = [error['message']]
    if error['fix']:
        parts.append(f"Fix: {error['fix']}")
    if error['details']:
        parts.append(f"Details: {error['details']}")

    return " | ".join(parts)
