# GravityAR VSCode Extension

Language support for GravityAR scripting in Visual Studio Code.

## Features

- Syntax highlighting for .grav and .gravity files
- IntelliSense (autocomplete) for Aria API
- Real-time compilation diagnostics
- Hover documentation for API functions
- Code snippets for common patterns
- Example gallery command

## Installation

```bash
npm install
npm run compile
npm run package
code --install-extension gravityar-*.vsix
```

## Configuration

Set Gravity compiler path in settings:

```json
{
  "gravityar.compilerPath": "/path/to/gravity"
}
```

Extension will auto-detect if in PATH.

## Usage

1. Open .grav or .gravity file
2. Start typing Aria API (e.g., `Aria.createObject`)
3. Use Ctrl+Space for autocomplete
4. Hover over functions for documentation
5. Compile errors appear in Problems panel

See main Aria Studio docs for complete workflow.
