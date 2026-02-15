import * as path from 'path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

import { registerCommands } from './commands';

let client: LanguageClient;

/**
 * Extension activation entry point
 * Called when .grav files are opened
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('GravityAR extension activated');

    // Server module path
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

    // Server options
    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: {
                execArgv: ['--nolazy', '--inspect=6009'],
            },
        },
    };

    // Client options
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'gravityar' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.grav'),
            configurationSection: 'gravityar',
        },
    };

    // Create LSP client
    client = new LanguageClient(
        'gravityarLanguageServer',
        'GravityAR Language Server',
        serverOptions,
        clientOptions
    );

    // Register commands
    registerCommands(context);

    // Start LSP client
    client.start();

    // Push to subscriptions for cleanup
    context.subscriptions.push(client);
}

/**
 * Extension deactivation
 */
export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
