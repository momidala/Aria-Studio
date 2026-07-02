import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

// Aria runtime classes: registered by VM at runtime, must be declared extern for compiler
const ARIA_PRECODE = 'extern var Aria;\nextern var Material;\nextern var Light;\n';
const PRECODE_LINE_COUNT = 3;

// Error message enhancements for artist-friendly output
const errorEnhancements: { pattern: RegExp; friendly: string }[] = [
    { pattern: /unexpected token/i, friendly: 'Unexpected code found. Check for missing semicolons or brackets.' },
    { pattern: /undefined variable/i, friendly: 'Variable not found. Declare it with \'var variableName = ...\' first.' },
    { pattern: /expected ;/i, friendly: 'Missing semicolon. Add \';\' at the end of this line.' },
    { pattern: /unknown identifier/i, friendly: 'This name is not recognized. Check spelling or make sure it\'s defined.' },
    { pattern: /type mismatch/i, friendly: 'Wrong type of value. The function expected a different type.' },
    { pattern: /expected \)/i, friendly: 'Missing closing parenthesis \')\'.' },
    { pattern: /expected \}/i, friendly: 'Missing closing brace \'}\'.' },
    { pattern: /expected \]/i, friendly: 'Missing closing bracket \']\'.' },
];

function enhanceErrorMessage(original: string): string {
    for (const enhancement of errorEnhancements) {
        if (enhancement.pattern.test(original)) {
            return enhancement.friendly;
        }
    }
    return original;
}

async function findCompiler(configuredPath: string): Promise<string | null> {
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

export async function validateDocument(
    document: TextDocument,
    compilerPath: string,
    enableDiagnostics: boolean
): Promise<Diagnostic[]> {
    // Return empty if diagnostics disabled
    if (!enableDiagnostics) {
        return [];
    }

    // Find compiler
    const compiler = await findCompiler(compilerPath);
    if (!compiler) {
        // Compiler not found - return helpful info diagnostic
        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Information,
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
            },
            message: 'Gravity compiler not found - install from THerD platform or set gravityar.compilerPath in settings. Syntax highlighting and snippets still work.',
            source: 'gravityar',
        };
        return [diagnostic];
    }

    // Create a collision-safe temporary file name: timestamp + random suffix prevents
    // concurrent validations of different documents from clobbering each other.
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const tempFile = join(tmpdir(), `gravityar-${uid}.grav`);
    try {
        await writeFile(tempFile, ARIA_PRECODE + document.getText(), 'utf8');

        // Run compiler
        try {
            await execFileAsync(compiler, [tempFile]);
            // Compilation successful - no errors
            return [];
        } catch (error: unknown) {
            // Parse compiler output for errors
            const err = error as { stderr?: string; stdout?: string };
            const output = (err.stderr ?? err.stdout ?? '').toString();
            return parseCompilerOutput(output, document);
        }
    } finally {
        // Clean up temp file
        try {
            await unlink(tempFile);
        } catch {
            // Ignore cleanup errors
        }
    }
}

function parseCompilerOutput(output: string, document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Expected format: "file:line:col: error: message" or "file:line: error: message"
    const errorPattern = /^.*?:(\d+):?(\d+)?:\s*(error|warning):\s*(.*)$/gm;
    let match;

    while ((match = errorPattern.exec(output)) !== null) {
        const line = Math.max(0, parseInt(match[1], 10) - 1 - PRECODE_LINE_COUNT); // LSP is 0-based; subtract injected precode lines
        const col = match[2] ? parseInt(match[2], 10) - 1 : 0;
        const severityStr = match[3];
        const message = match[4];

        const severity = severityStr === 'warning'
            ? DiagnosticSeverity.Warning
            : DiagnosticSeverity.Error;

        const enhancedMessage = enhanceErrorMessage(message);

        const diagnostic: Diagnostic = {
            severity,
            range: {
                start: { line, character: col },
                end: { line, character: col + 1 }, // Highlight at least one character
            },
            message: enhancedMessage,
            source: 'gravityar',
            relatedInformation: enhancedMessage !== message ? [{
                location: {
                    uri: document.uri,
                    range: {
                        start: { line, character: col },
                        end: { line, character: col + 1 },
                    },
                },
                message: `Technical details: ${message}`,
            }] : undefined,
        };

        diagnostics.push(diagnostic);
    }

    return diagnostics;
}
