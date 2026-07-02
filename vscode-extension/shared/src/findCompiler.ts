// findCompiler.ts — single source of truth for Gravity compiler discovery.
//
// Consumed by BOTH TypeScript compilation units of the extension:
//   - client/src/commands.ts  (manual "Compile Current File" command)
//   - server/src/validator.ts (LSP diagnostics)
//
// Import path note: both sides import '../../shared/out/findCompiler'. That
// literal path resolves to the emitted .d.ts at compile time (from client/src
// or server/src) AND to the emitted .js at runtime (from client/out or
// server/out), because src/ and out/ sit at the same depth in each project.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execFileAsync = promisify(execFile);

/**
 * Locate a working Gravity compiler executable.
 *
 * Search order:
 *   1. The user-configured path (gravityar.compilerPath), if set and runnable.
 *   2. 'gravity' on PATH.
 *   3. Common install locations (/usr/local/bin, /usr/bin, ~/.local/bin).
 *
 * Returns the first candidate that responds to '--version', or null if none do.
 */
export async function findCompiler(configuredPath: string): Promise<string | null> {
    // Try configured path first
    if (configuredPath && configuredPath.trim() !== '') {
        try {
            await execFileAsync(configuredPath, ['--version']);
            return configuredPath;
        } catch {
            // Configured path doesn't work, continue to fallbacks
        }
    }

    // Try 'gravity' in PATH
    try {
        await execFileAsync('gravity', ['--version']);
        return 'gravity';
    } catch {
        // Not in PATH
    }

    // Try common locations
    const commonPaths = [
        '/usr/local/bin/gravity',
        '/usr/bin/gravity',
        join(process.env.HOME ?? '', '.local', 'bin', 'gravity'),
    ];

    for (const path of commonPaths) {
        try {
            await execFileAsync(path, ['--version']);
            return path;
        } catch {
            // This path doesn't work
        }
    }

    return null;
}
