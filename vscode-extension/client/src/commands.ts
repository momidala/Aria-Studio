import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { findCompiler } from '../../shared/out/findCompiler';

const execFileAsync = promisify(execFile);

export function registerCommands(context: vscode.ExtensionContext) {
    // Register example gallery command
    const openExamplesCommand = vscode.commands.registerCommand('gravityar.openExamples', async () => {
        await openExampleGallery(context);
    });

    // Register compile command
    const compileCommand = vscode.commands.registerCommand('gravityar.compile', async () => {
        await compileCurrentFile();
    });

    context.subscriptions.push(openExamplesCommand, compileCommand);
}

async function openExampleGallery(context: vscode.ExtensionContext) {
    try {
        // Path to examples directory
        const examplesPath = context.asAbsolutePath('examples');

        // Read example files
        const files = await readdir(examplesPath);
        const gravFiles = files.filter(f => f.endsWith('.grav'));

        if (gravFiles.length === 0) {
            vscode.window.showInformationMessage('No example files found');
            return;
        }

        // Build quick pick items
        const items: vscode.QuickPickItem[] = [];

        for (const file of gravFiles) {
            const filePath = join(examplesPath, file);
            const content = await readFile(filePath, 'utf8');

            // Extract first comment line as description
            const lines = content.split('\n');
            let description = '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('//')) {
                    description = trimmed.substring(2).trim();
                    break;
                }
            }

            // Add icon based on content keywords
            let icon = '$(file-code)';
            if (content.includes('GPS.createAnchor')) {
                icon = '$(location)';
            } else if (content.includes('Audio.play')) {
                icon = '$(unmute)';
            } else if (content.includes('Input.on')) {
                icon = '$(hand)';
            }

            items.push({
                label: `${icon} ${file.replace('.grav', '')}`,
                description: description,
                detail: filePath,
            });
        }

        // Show quick pick
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an example world to open',
            matchOnDescription: true,
        });

        if (selected && selected.detail) {
            // Open the selected file
            const document = await vscode.workspace.openTextDocument(selected.detail);
            await vscode.window.showTextDocument(document);
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to open examples: ${error.message}`);
    }
}

async function compileCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No file is currently open');
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'gravityar') {
        vscode.window.showWarningMessage('Current file is not a .grav file');
        return;
    }

    // Save document first
    if (document.isDirty) {
        await document.save();
    }

    // Find compiler
    const config = vscode.workspace.getConfiguration('gravityar');
    const configuredPath = config.get<string>('compilerPath', '');

    const compiler = await findCompiler(configuredPath);
    if (!compiler) {
        vscode.window.showErrorMessage(
            'Gravity compiler not found. Install from THerD platform or set gravityar.compilerPath in settings.',
            'Open Settings'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'gravityar.compilerPath');
            }
        });
        return;
    }

    // Run compiler
    try {
        await execFileAsync(compiler, [document.fileName]);
        vscode.window.showInformationMessage('✓ Compilation successful - no errors found');
    } catch (error: any) {
        const output = (error.stderr || error.stdout || '').toString();
        const firstError = extractFirstError(output);
        if (firstError) {
            vscode.window.showErrorMessage(`Compilation failed: ${firstError}`);
        } else {
            vscode.window.showErrorMessage('Compilation failed - see Problems panel for details');
        }
    }
}

function extractFirstError(output: string): string | null {
    const errorPattern = /^.*?:\d+:?\d*?:\s*error:\s*(.*)$/m;
    const match = output.match(errorPattern);
    return match ? match[1] : null;
}
