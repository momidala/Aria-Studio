# Aria-Studio Context

**Component:** Content Creation Tooling
**Languages:** Python (Blender), TypeScript (VSCode), C (CLI packager)
**Purpose:** Enable artists to create AR worlds using familiar tools

## Architecture Decisions

**Why Blender?**
- Industry-standard 3D tool (artists already know it)
- Powerful scripting API (bpy) for export automation
- Native glTF 2.0 export support
- Free and open source

**Why VSCode?**
- Most popular code editor for web developers
- Excellent extension API (Language Server Protocol)
- IntelliSense for Gravity API autocomplete
- Live validation and error checking

**Why CLI Packaging Tool?**
- Command-line validation before upload
- Offline world creation (no server required)
- Integration with artist workflows (make, scripts)
- Fast feedback loop

**Artist-First Design:**
- No custom UI to learn
- Plain language error messages
- Auto-fix common mistakes (coordinate conversion, texture compression)
- Desktop simulator for fast iteration (no hardware required)

## Key Responsibilities

- **Blender Addon:** Export scenes to .therd package format
  - Scene graph → glTF 2.0 models
  - Auto-generate Gravity script template
  - GPS anchor placement UI
  - Texture optimization (resize, compress)

- **VSCode Extension:** Gravity scripting environment
  - Syntax highlighting for .grav files
  - IntelliSense (Aria API autocomplete)
  - Real-time error checking
  - Snippet library (common patterns)

- **CLI Packager:** Package validation and creation (`packaging/therd_package.c`, C/CMake)
  - Validate manifest.json schema
  - Check asset references (no missing files)
  - Compile .grav scripts to .gbc bytecode
  - Create .therd ZIP with compression

## Integration

**Export Pipeline:**
```
Blender (3D scene)
  ↓ Export addon
.grav script + .glb models + textures
  ↓ VSCode (edit script)
.grav script (validated)
  ↓ CLI tool (package)
world.therd (ZIP package)
  ↓ Upload to server
Bytecode package (distributed to clients)
```

**Protocol Contract:** Uses `THerD-commons` for:
- World package format (.therd structure)
- manifest.json schema validation
- Aria API bindings reference

**Planning:** Managed from `THerD-platform/.planning/`
- Tooling features planned as platform phases
- Component-specific context documented here
- See: `../INTEGRATION.md` for complete system architecture

## Components

### Blender Addon

**Installation:**
- Copy `blender-addon/` to Blender addons directory
- Enable "THerD AR Exporter" in preferences

**Features:**
- One-click export to .therd package
- GPS anchor placement (drag markers in 3D view)
- SLAM marker setup (AprilTag ID, size)
- Auto-generate script template from scene
- Coordinate conversion (Blender Z-up → THerD Y-up)

### VSCode Extension

**Installation:**
```bash
cd vscode-extension
npm install
npm run compile
code --install-extension therd-gravity-*.vsix
```

**Features:**
- Syntax highlighting for .grav files
- Aria API autocomplete (`Aria.`, `GPS.`, `Input.`, `Audio.`)
- Error checking (undefined variables, type mismatches)
- Quick fixes (import library, add callback)

### CLI Packager

The packaging tool is a C program at `packaging/therd_package.c`, built with CMake.
There is no Python CLI tool (`cli-tool/` does not exist; `pip install therd-cli` is not how this works).

**Build:**
```bash
cd packaging && mkdir -p build && cd build && cmake .. && make
```

**Usage:**
```bash
./build/therd-package create --dir world/ --output world.therd
./build/therd-package validate world.therd
```

**Validation Checks:**
- manifest.json schema compliance
- entry_script exists and is valid Gravity code
- All asset references exist in package
- Model sizes ≤ 10MB each
- Package size ≤ 50MB total

## Dependencies

**Blender Addon:**
- Blender 3.0+ (bpy API)
- Python 3.9+

**VSCode Extension:**
- VSCode 1.60+
- TypeScript 4.5+
- vscode-languageclient

**CLI Packager:**
- C99 compiler (gcc/clang)
- CMake 3.10+
- cJSON (bundled at `packaging/cjson/`)
- miniz (bundled at `packaging/miniz.c`)

## Testing

**Blender Addon + Regression Tests (no Blender needed):**
```bash
python3 -m pytest
```
Collects 30 tests: 20 unit tests in `tests/unit/` (coordinate conversion,
code generation) and 10 regression tests in `tests/regression/` (Fixes #2, #3, #4, #8).
Run from the `Aria-Studio/` directory.

**VSCode Extension Tests:**
```bash
cd vscode-extension
npm test
```

**CLI Packager (C/CMake — build first, no Python involved):**
```bash
cd packaging && mkdir -p build && cd build && cmake .. && make
```
The Fix #4 regression test (`tests/regression/test_regressions.py`) invokes
the packager binary automatically when it is present at `packaging/build/therd-package`.

## Related Components

- **THerD-commons:** `../THerD-commons/` - Defines world package format
- **THerD-Server:** `../THerD-Server/` - Receives uploaded packages
- **THerD (Client):** `../THerD/` - Runs exported worlds
- **Gravity VM:** Embedded in THerD client

---

*Component context maintained separately from platform planning*
*Platform integration: See `../INTEGRATION.md`*
