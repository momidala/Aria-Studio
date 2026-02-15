# Desktop Simulator (Coming Soon)

Desktop development environment for testing AR experiences without hardware.

## Planned Features

- Window-based rendering (no AR glasses required)
- Mouse → GPS position simulation
- Keyboard → gesture input mapping
- Hot reload for rapid iteration
- Debug visualizations (anchors, transforms, audio sources)

## Architecture

Shares THerD client codebase with conditional compilation:
- Same Aria library and scene graph
- Same renderer (OpenGL → window instead of AR display)
- Mocked hardware (GPS, input, audio)

## Status

Desktop simulator is captured for planning but not yet scheduled.
Will be built as separate subproject reusing client code.
