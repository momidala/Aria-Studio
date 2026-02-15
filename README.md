# Aria Studio

Artist development environment for the THerD AR platform.

## Overview

Aria Studio provides the tools artists need to create AR experiences:
- **Blender Addon** - Export 3D scenes to GravityAR format
- **VSCode Extension** - Syntax highlighting, IntelliSense, and compilation for .grav scripts
- **Packaging Tool** - Create .therd world packages for deployment
- **Desktop Simulator** (future) - Test AR experiences on desktop before hardware deployment

## Installation

### Blender Addon

1. Open Blender → Edit → Preferences → Add-ons → Install
2. Navigate to `blender-addon/` directory and select `__init__.py`
3. Enable "GravityAR Exporter" addon
4. Export via File → Export → GravityAR (.grav)

See [blender-addon/README.md](blender-addon/README.md) for details.

### VSCode Extension

1. Install from VSIX:
   ```bash
   cd vscode-extension
   npm install
   npm run package
   code --install-extension gravityar-*.vsix
   ```

See [vscode-extension/README.md](vscode-extension/README.md) for details.

### Packaging Tool

Build the world packaging tool:

```bash
cd packaging
mkdir build && cd build
cmake ..
make
sudo make install  # Optional: install to /usr/local/bin
```

See [packaging/README.md](packaging/README.md) for usage.

## Quick Start

1. Create a 3D scene in Blender
2. Export to GravityAR format (File → Export → GravityAR)
3. Edit the generated .grav script in VSCode (with IntelliSense)
4. Package as .therd world: `therd-package create path/to/world/`
5. Upload to THerD-Server

## Documentation

- [Blender Export Guide](docs/blender-export.md)
- [GravityAR Scripting Guide](docs/gravityar-scripting.md)
- [World Package Format](docs/package-format.md)
- [Desktop Simulator](docs/desktop-simulator.md) (coming soon)

## Architecture

Aria Studio is the artist-facing layer of the THerD platform:
- Artists create content in familiar tools (Blender, VSCode)
- Export pipeline generates GravityAR scripts from 3D scenes
- Packaging tool bundles scripts + assets into deployable worlds
- Desktop simulator enables rapid iteration without hardware

## License

MIT License - See LICENSE file for details.
