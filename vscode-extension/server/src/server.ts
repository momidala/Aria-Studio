import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    TextDocumentSyncKind,
    InitializeResult,
    CompletionItem,
    Hover,
    DidChangeConfigurationNotification,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { validateDocument } from './validator';
import { getCompletions } from './completion';
import { getHoverInfo } from './hover';

// Create LSP connection
const connection = createConnection(ProposedFeatures.all);

// Text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Configuration settings
interface GravityARSettings {
    compilerPath: string;
    enableDiagnostics: boolean;
}

const defaultSettings: GravityARSettings = {
    compilerPath: '',
    enableDiagnostics: true,
};

let globalSettings: GravityARSettings = defaultSettings;

// Initialize handler
connection.onInitialize((params: InitializeParams) => {
    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                triggerCharacters: ['.'],
            },
            hoverProvider: true,
        },
    };
    return result;
});

connection.onInitialized(() => {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
});

// Configuration change handler
connection.onDidChangeConfiguration(change => {
    globalSettings = change.settings.gravityar || defaultSettings;
    // Revalidate all open documents
    documents.all().forEach(validateTextDocument);
});

// Document change handler
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const diagnostics = await validateDocument(textDocument, globalSettings.compilerPath, globalSettings.enableDiagnostics);
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Completion handler
connection.onCompletion((params): CompletionItem[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }
    return getCompletions(params, document);
});

// Hover handler
connection.onHover((params): Hover | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }
    return getHoverInfo(params, document);
});

// Listen for document events
documents.listen(connection);

// Start listening
connection.listen();
