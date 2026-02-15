# Contributing to Aria Studio

Aria Studio is part of the THerD AR platform. Contributions welcome!

## Development Setup

### Blender Addon

Install in development mode:
1. Symlink blender-addon/ to Blender's addons directory
2. Enable in Blender preferences
3. Reload addon after changes

### VSCode Extension

```bash
cd vscode-extension
npm install
npm run compile
code --extensionDevelopmentPath=.
```

### Packaging Tool

```bash
cd packaging
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Debug
make
```

## Testing

Run existing tests:
```bash
# Blender tests (unit tests for coordinate math)
cd blender-addon
python -m pytest tests/

# VSCode extension tests
cd vscode-extension
npm test
```

## Pull Request Process

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Ensure all tests pass
5. Submit PR with clear description

## Code Style

- Python: PEP 8
- TypeScript: Standard TypeScript style
- C: K&R style with 4-space indentation

## License

By contributing, you agree to license your contributions under the MIT License.
