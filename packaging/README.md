# THerD World Packager

CLI tool to create and validate .therd world packages.

## Build

```bash
mkdir build && cd build
cmake ..
make
```

## Usage

Validate world directory:

```bash
./therd-package validate /path/to/world/
```

Create .therd package:

```bash
./therd-package create /path/to/world/
```

## World Structure

A valid world directory contains:

```
my-world/
├── manifest.json       # Required metadata
├── scripts/
│   └── main.grav      # Entry script
├── models/
│   └── *.glb          # 3D models
├── textures/
│   └── *.png          # Texture files
└── audio/
    └── *.ogg          # Audio files
```

See docs/package-format.md for manifest.json schema.
