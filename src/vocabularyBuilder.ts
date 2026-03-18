import * as vscode from 'vscode';

export interface VocabularyEntry {
    word: string;
    boost: number;
}

/**
 * Extract identifiers from the active document using VS Code's
 * DocumentSymbolProvider. Falls back to regex extraction if no
 * symbol provider is available.
 */
export async function extractWorkspaceVocabulary(
    maxEntries: number = 100
): Promise<VocabularyEntry[]> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return []; }

    const entries: VocabularyEntry[] = [];
    const seen = new Set<string>();

    try {
        // Try document symbol provider first
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            editor.document.uri
        );

        if (symbols && symbols.length > 0) {
            collectSymbolNames(symbols, entries, seen);
        }
    } catch {
        // Symbol provider not available — fallback to regex
    }

    // Fallback: extract identifiers from the document text via regex
    if (entries.length === 0) {
        const text = editor.document.getText();
        // Match camelCase, PascalCase, snake_case identifiers >= 4 chars
        const identifierRegex = /\b([A-Z][a-zA-Z0-9]{3,}|[a-z][a-zA-Z0-9]{3,})\b/g;
        let match;
        while ((match = identifierRegex.exec(text)) !== null) {
            const word = match[1];
            if (!seen.has(word) && !isCommonWord(word)) {
                seen.add(word);
                entries.push({ word, boost: 2.0 });
            }
        }
    }

    return entries.slice(0, maxEntries);
}

function collectSymbolNames(
    symbols: vscode.DocumentSymbol[],
    entries: VocabularyEntry[],
    seen: Set<string>
): void {
    for (const sym of symbols) {
        if (sym.name.length >= 3 && !seen.has(sym.name)) {
            seen.add(sym.name);
            entries.push({ word: sym.name, boost: 3.0 });
        }
        // Recurse into children
        if (sym.children && sym.children.length > 0) {
            collectSymbolNames(sym.children, entries, seen);
        }
    }
}

const COMMON_WORDS = new Set([
    'this', 'that', 'with', 'from', 'have', 'been', 'were', 'what',
    'when', 'where', 'which', 'their', 'there', 'then', 'than',
    'true', 'false', 'null', 'void', 'else', 'return', 'const',
    'function', 'class', 'import', 'export', 'default', 'async',
    'await', 'string', 'number', 'boolean', 'undefined', 'interface',
]);

function isCommonWord(word: string): boolean {
    return COMMON_WORDS.has(word.toLowerCase());
}
