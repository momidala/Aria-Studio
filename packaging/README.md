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
./therd-package validate --dir /path/to/world/
```

Create .therd package:

```bash
./therd-package create --dir /path/to/world/ --output world.therd
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

## Vendored Dependencies

- `miniz.c` / `miniz.h` — miniz **v11.0.2** (ZIP archive I/O). This is a
  vendored copy, byte-identical to `THerD/third_party/miniz.[ch]` in the
  client repo. **The two copies MUST be updated in sync** — a security
  patch to miniz applies to both locations.
- `cjson/` — bundled cJSON (manifest parsing).
