/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import * as sinon from 'sinon';
import * as assert from 'assert';
import { createMockVscode } from './helpers';

const proxyquire = require('proxyquire').noCallThru();

describe('VocabularyBuilder', () => {
    let mockVscode: any;
    let extractWorkspaceVocabulary: any;

    beforeEach(() => {
        mockVscode = createMockVscode();
        const mod = proxyquire('../vocabularyBuilder', {
            'vscode': mockVscode,
        });
        extractWorkspaceVocabulary = mod.extractWorkspaceVocabulary;
    });

    afterEach(() => {
        sinon.restore();
    });

    /**
     * Helper: create a mock editor with document.uri and document.getText.
     */
    function createMockEditor(text: string = '') {
        return {
            document: {
                uri: { scheme: 'file', path: '/mock/file.ts' },
                getText: sinon.stub().returns(text),
            },
            selection: {
                active: { line: 0, character: 0 },
                isEmpty: true,
            },
        };
    }

    /**
     * Helper: create a mock DocumentSymbol.
     */
    function createMockSymbol(name: string, children: any[] = []) {
        return { name, children };
    }

    it('should return empty array when no active editor', async () => {
        // activeTextEditor is undefined by default in createMockVscode
        const result = await extractWorkspaceVocabulary();
        assert.deepStrictEqual(result, []);
    });

    it('should extract symbols from document symbol provider', async () => {
        const editor = createMockEditor();
        mockVscode.window.activeTextEditor = editor;

        mockVscode.commands.executeCommand.resolves([
            createMockSymbol('MyComponent', [
                createMockSymbol('handleClick'),
            ]),
        ]);

        const result = await extractWorkspaceVocabulary();

        assert.ok(result.length >= 2,
            `expected at least 2 entries, got ${result.length}`);
        const words = result.map((e: any) => e.word);
        assert.ok(words.includes('MyComponent'),
            'expected "MyComponent" in vocabulary');
        assert.ok(words.includes('handleClick'),
            'expected "handleClick" in vocabulary');
        // Symbol entries should have boost 3.0
        const myComp = result.find((e: any) => e.word === 'MyComponent');
        assert.strictEqual(myComp.boost, 3.0,
            'expected symbol boost of 3.0');
    });

    it('should fall back to regex extraction when no symbols available', async () => {
        const editor = createMockEditor(
            'function calculateTotal() { const myVariable = 1; }',
        );
        mockVscode.window.activeTextEditor = editor;

        // executeCommand returns null (no symbol provider)
        mockVscode.commands.executeCommand.resolves(null);

        const result = await extractWorkspaceVocabulary();

        const words = result.map((e: any) => e.word);
        assert.ok(words.includes('calculateTotal'),
            'expected "calculateTotal" in regex fallback');
        assert.ok(words.includes('myVariable'),
            'expected "myVariable" in regex fallback');
        // Regex entries should have boost 2.0
        const calcEntry = result.find((e: any) => e.word === 'calculateTotal');
        assert.strictEqual(calcEntry.boost, 2.0,
            'expected regex boost of 2.0');
    });

    it('should filter common keywords', async () => {
        const editor = createMockEditor(
            'const function return async await string number boolean undefined',
        );
        mockVscode.window.activeTextEditor = editor;

        // No symbol provider
        mockVscode.commands.executeCommand.resolves(null);

        const result = await extractWorkspaceVocabulary();
        const words = result.map((e: any) => e.word.toLowerCase());

        assert.ok(!words.includes('const'), 'should filter "const"');
        assert.ok(!words.includes('function'), 'should filter "function"');
        assert.ok(!words.includes('return'), 'should filter "return"');
        assert.ok(!words.includes('async'), 'should filter "async"');
        assert.ok(!words.includes('string'), 'should filter "string"');
        assert.ok(!words.includes('undefined'), 'should filter "undefined"');
    });

    it('should respect maxEntries limit', async () => {
        const editor = createMockEditor();
        mockVscode.window.activeTextEditor = editor;

        // Create many symbols
        const symbols = Array.from({ length: 20 }, (_, i) =>
            createMockSymbol(`SymbolName${i}`),
        );
        mockVscode.commands.executeCommand.resolves(symbols);

        const result = await extractWorkspaceVocabulary(5);

        assert.ok(result.length <= 5,
            `expected at most 5 entries, got ${result.length}`);
    });

    it('should skip short identifiers (< 3 chars)', async () => {
        const editor = createMockEditor();
        mockVscode.window.activeTextEditor = editor;

        mockVscode.commands.executeCommand.resolves([
            createMockSymbol('ab'),
            createMockSymbol('x'),
            createMockSymbol('LongEnough'),
        ]);

        const result = await extractWorkspaceVocabulary();
        const words = result.map((e: any) => e.word);

        assert.ok(!words.includes('ab'),
            'should skip 2-char identifier "ab"');
        assert.ok(!words.includes('x'),
            'should skip 1-char identifier "x"');
        assert.ok(words.includes('LongEnough'),
            'should include 10-char identifier "LongEnough"');
    });
});
