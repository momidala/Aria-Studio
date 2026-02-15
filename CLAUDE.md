# Aria-Studio - Content Creation Tooling

**Component:** Content creation tools for THerD Platform
**Languages:** Python (Blender), TypeScript (VSCode), Python (CLI)
**Organization:** Momidala Consulting, LLC

## Auto-Load Context

Before working on this component, read these files:

@../INTEGRATION.md - How Aria-Studio integrates with the platform
@../INTERFACES.md - World package format, export contracts
@CONTEXT.md - Component architecture and design decisions

## Component Overview

Aria-Studio provides artist-friendly tools for creating AR worlds:
- **Blender Addon** - Export 3D scenes to .therd packages
- **VSCode Extension** - Gravity scripting with IntelliSense
- **CLI Tool** - Package validation and upload

**Artist-First Philosophy:**
- Use familiar tools (Blender, VSCode) - no custom UIs
- Plain language errors - no technical jargon
- Auto-fix common mistakes - coordinate conversion, texture optimization
- Fast iteration - desktop simulator, no hardware required

## Working in This Repo

**Implementation work** (here):
- Blender addon Python code
- VSCode extension TypeScript code
- CLI tool implementation
- Component-specific tests
- Tool documentation

**Planning work** (parent repo):
- `cd ../` to THerD-platform root
- Integration planning in `../.planning/`
- Cross-component coordination

## Integration Points

**Exports to:**
- .therd packages (ZIP format) containing:
  - manifest.json (validated schema)
  - .grav scripts (Gravity source)
  - .glb models (glTF 2.0)
  - .png textures
  - .ogg audio

**Consumed by:**
- THerD-Server (receives upload, compiles to bytecode)
- THerD Client (runs the exported world)

**Uses contracts from:**
- THerD-commons (world package format, manifest schema)

## Key Contracts

**World Package Format** (see ../INTERFACES.md):
- manifest.json must include: name, version, entry_script
- All asset paths must exist in package
- GPS and SLAM origins are mutually exclusive
- Package size ≤ 50MB

**Gravity API** (see ../INTERFACES.md):
- Aria class (createObject, setBackground, log)
- GPS class (createAnchor, getPosition)
- Input class (onTap, onPan, onPinch, onSwipe)
- Audio class (play, play3D)

## Development Workflow

**When changing export pipeline:**
1. Update Blender addon export logic
2. Test with example scenes
3. Validate against manifest schema
4. Test upload to THerD-Server
5. Test load in THerD Client

**When changing VSCode extension:**
1. Update Aria API definitions
2. Test IntelliSense completions
3. Test error checking
4. Update snippets library

## Testing

**Run Blender addon tests:**
```bash
blender --background --python tests/test_export.py
```

**Run VSCode extension tests:**
```bash
cd vscode-extension
npm test
```

**Run CLI tests:**
```bash
cd cli-tool
pytest tests/
```

## Artist Value Proposition

Every feature must serve the core value: **Artists create art, not fight technology**

Ask before implementing:
- Does this reduce friction for artists?
- Is the error message in plain language?
- Can we auto-fix this instead of reporting an error?
- Will this work offline (no server required)?

## Licensing

MIT licensed - must remain unencumbered (Momidala project requirement)
